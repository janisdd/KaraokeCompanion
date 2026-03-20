import type { OnlineSongInfo, OnlineSongInfoPlain } from "../allOnlineSongsIndexer";
import path from "path";
import fs from "fs";
import { chromium, type Browser, type Page } from "playwright";
import { ConfigHelper } from "~/helpers/configHelper";
import { Logger } from "~/helpers/logger";
import { ChildProcess, exec } from "child_process";
import { SongsIndexer } from "../songsIndexer";
import { AllOnlineSongsIndexer } from "../allOnlineSongsIndexer";

type AudioVideoFileNamesTuple = {
  audioName: string;
  videoName: string;
};

const SLOW_MO = 100;
// just so we know we are downloading (or downloaded) the song
const LOCK_FILE_EXTENSION = ".lock";

export class UsdbAnimuxHelper {


  // key is songId
  //contains downloading and downloaded song ids
  private static _downloadingOrDownloadedSongIds: Set<string> = new Set();

  private static _indexingFinished = false;

	public static isIndexingFinished(): boolean {
		return this._indexingFinished;
	}

  public static async checkAlreadyDownloadedSongs() {
    this._downloadingOrDownloadedSongIds.clear();
    const downloadSongsDir = ConfigHelper.getDownloadSongsDir();
    if (!downloadSongsDir) {
      throw new Error("Download songs directory not set");
    }

    //check all files in the download songs dir
    const files = fs.readdirSync(downloadSongsDir);
    for (const file of files) {
      if (!file.endsWith(LOCK_FILE_EXTENSION)) {
        continue;
      }
      // we don't need the file content here, just the id (file anme)
      const songId = path.parse(file).name;
      const songIdFilePath = path.resolve(downloadSongsDir, file);
      this._downloadingOrDownloadedSongIds.add(songId);
    }
    this._indexingFinished = true;
  }

  public static isSongDownloadingOrDownloaded(songId: string): boolean {
    return this._downloadingOrDownloadedSongIds.has(songId);
  }


  public static async downloadSong(song: OnlineSongInfo, forceDownload: boolean = false): Promise<void> {
    const downloadSongsDir = ConfigHelper.getDownloadSongsDir();

    if (!downloadSongsDir) {
      throw new Error("Download songs directory not set");
    }

    // const songUrl = `${ConfigHelper.getUsdbAnimuxUrl()}/index.php?link=detail&id=4978`;
    const songUrl = `${ConfigHelper.getUsdbAnimuxUrl()}/index.php?link=detail&id=${song.songId}`;

    // e.g. url is https://usdb.animux.de/index.php?link=detail&id=4978
    // we need to get the id from the url
    const urlParams = new URLSearchParams(songUrl);
    const id = urlParams.get("id");
    if (!id) {
      throw new Error("ID not found in URL");
    }
    const songId = `${id}`;

    const songIdFile = `${songId}${LOCK_FILE_EXTENSION}`;
    const songIdFilePath = path.resolve(downloadSongsDir, songIdFile);

    // TODO this is a race condition...
    // when multiple requests are made at the same time
    // one could be before writing the file and the other after reading it

    // const songIdFileExists = fs.existsSync(songIdFilePath);
    const songIdFileExists = this._downloadingOrDownloadedSongIds.has(songId);
    if (songIdFileExists && !forceDownload) {
      Logger.log(`Song already downloaded: ${songIdFilePath}`);
      return;
    } else {
      // create file to indicate we are downloading the song
      if (!songIdFileExists) {
        await fs.promises.writeFile(songIdFilePath, "");
        Logger.log(`Song ID file created: ${songIdFilePath}`);
      }
    }

    // indicate that we are downloading the song
    this._downloadingOrDownloadedSongIds.add(songId);
    // re-add the song to the index, this will update the indexed and downloading states
    AllOnlineSongsIndexer.addSingOnlineSongInfoToIndex({
      key: song.key,
      songId,
      songName: song.songName,
      artist: song.artist,
    } satisfies OnlineSongInfoPlain);
  

    const downloadUseHeadlessMode = ConfigHelper.getDownloadUseHeadlessMode();
    Logger.debug(`Download use headless mode: ${downloadUseHeadlessMode}`);

    let browser: Browser | null = null;

    try {
      browser = await chromium.launch({
        headless: downloadUseHeadlessMode,
        slowMo: SLOW_MO,
      });
      const page = await browser.newPage();
      await page.goto(ConfigHelper.getUsdbAnimuxUrl());
      // await page.screenshot({ path: `example.png` });

      const usdbAnimuxId = ConfigHelper.getUsdbAnimuxId();
      const usdbAnimuxPw = ConfigHelper.getUsdbAnimuxPw();
      // document.querySelector("form input[name='user']")
      await page.fill('form input[name="user"]', usdbAnimuxId);
      // document.querySelector("form input[name='pass']")
      await page.fill('form input[name="pass"]', usdbAnimuxPw);
      // document.querySelector("form input#login")
      await page.click("form input#login");

      // wait for the page to load
      await page.waitForLoadState("domcontentloaded");
      Logger.log("page loaded");

      //now we are logged in
      const { downloadSingleSongDirPath } = await this._downloadSingleSong(page, songUrl, downloadSongsDir, songId);

      // wait for 1s to finish
      await new Promise((resolve) => setTimeout(resolve, 1_000));

      await browser.close();
      Logger.debug("Browser closed");
      browser = null;

      // when all is done, we can index the new directory
      await SongsIndexer.indexSingleSongDir(downloadSingleSongDirPath, downloadSongsDir, 0, 1);

    } catch (error) {
      Logger.error(
        `Error downloading song: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      if (browser) {
        await browser.close();
        Logger.debug("Browser closed");
      }
    }
  }

  // if forceDownload is true, then the song will be downloaded even if it already exists
  //we place a empty txt file in the songs dir with the song id as name to indicate that the song was downloaded
  // because only with the url there is no way to check if the song was already downloaded (we don't have the name yet)
  private static async _downloadSingleSong(
    page: Page,
    url: string,
    downloadSongsDir: string,
    songId: string,
  ) {
    
    Logger.log(`Downloading song from URL: ${url}`);

    // go to the page and wait for the page to load
    await page.goto(url);
    await page.waitForLoadState("domcontentloaded");
    Logger.debug(`Page loaded: ${url}`);

    const pageTitle = await page.title();
    if (!pageTitle) {
      throw new Error("Page title not found");
    }

    // we get the song title (artist - title) from document.querySelector("#tablebg .syntaxcomment b")
    const songTitle = await page
      .locator("#tablebg .syntaxcomment b")
      .first()
      .textContent();
    if (!songTitle) {
      throw new Error("Song title not found");
    }

    const preferredVideoHeight = ConfigHelper.getDownloadPreferredVideoHeight();
    const preferredVideoFormat = ConfigHelper.getDownloadPreferredVideoFormat();
    const convertAudioFormat = ConfigHelper.getDownloadConvertAudioFormat();

    const songTitleSanitized = songTitle.replace(/[^a-zA-Z0-9- ]/g, "_");
    const downloadSingleSongDirPath = path.resolve(
      downloadSongsDir,
      songTitleSanitized,
    );
    if (!fs.existsSync(downloadSingleSongDirPath)) {
      await fs.promises.mkdir(downloadSingleSongDirPath);
    } else {
      // song dir already exists --> remove old files
      await fs.promises.rmdir(downloadSingleSongDirPath);
      Logger.warn(
        `Download songs directory already exists: ${downloadSingleSongDirPath} --> removed old files`,
      );
    }

    // the cover image is identified by document.querySelector("#tablebg img")
    const coverImage = await page.locator("#tablebg img").first();
    // e.g. /data/cover/4978.jpg
    const coverImageUrlPart = await coverImage.getAttribute("src");
    if (!coverImageUrlPart) {
      throw new Error("Cover image URL not found");
    }
    // e.g. https://usdb.animux.de/data/cover/4978.jpg
    const coverImageUrl = `${ConfigHelper.getUsdbAnimuxUrl()}/${coverImageUrlPart}`;
    const coverImageExtension = path.extname(coverImageUrlPart).toLowerCase();
    if (!coverImageExtension) {
      throw new Error("Cover image extension not found");
    }

    const coverImageName = `${songTitleSanitized} [CO]${coverImageExtension}`;
    const coverImagePath = path.resolve(
      downloadSingleSongDirPath,
      coverImageName,
    );
    if (!fs.existsSync(coverImagePath)) {
      const response = await fetch(coverImageUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to download cover image: ${response.statusText}`,
        );
      }
      const buffer = await response.arrayBuffer();
      await fs.promises.writeFile(coverImagePath, Buffer.from(buffer));
      Logger.log(`Cover image downloaded and saved to: ${coverImagePath}`);
    }

    // we also need to get the youtube video id
    // it often can be found in the commentso n the page
    // there could be multiple youtube video ids, we need to get the first one
    // document.querySelector("table iframe")
    const youtubeVideoIframe = await page.locator("table iframe").first();
    const youtubeVideoIframeUrl = await youtubeVideoIframe.getAttribute("src");
    if (!youtubeVideoIframeUrl) {
      throw new Error("Youtube video iframe URL not found");
    }
    const youtubeVideoId = this._getYoutubeVideoId(youtubeVideoIframeUrl);
    if (!youtubeVideoId) {
      throw new Error("Youtube video ID not found");
    }
    Logger.log(`Youtube video ID found: ${youtubeVideoId}`);

    const { audioName, videoName } = await this._downloadYoutubeVideoAndSplit(
      youtubeVideoId,
      downloadSingleSongDirPath,
      songTitleSanitized,
      preferredVideoHeight,
      preferredVideoFormat,
      convertAudioFormat,
    );

    // the last step is to get the actual txt file with the notes
    // the correct url is https://usdb.animux.de/index.php?link=gettxt&id=<songId>

    const txtUrl = `${ConfigHelper.getUsdbAnimuxUrl()}/index.php?link=gettxt&id=${songId}`;
    Logger.log(`Getting txt file from URL: ${txtUrl}`);
    await page.goto(txtUrl);
    await page.waitForLoadState("domcontentloaded");
    Logger.debug(`page ${txtUrl} loaded`);

    // we need to wait for the txt file to be available
    // +1 to be sure
    const requiredWaitTimeForSongDownload =
      ConfigHelper.getRequiredWaitTimeForSongDownload() + 1;
    Logger.log(
      `Waiting for ${requiredWaitTimeForSongDownload} seconds for txt file to be available`,
    );
    await new Promise((resolve) =>
      setTimeout(resolve, requiredWaitTimeForSongDownload * 1000),
    );
    Logger.log(`Txt file is available`);

    // to check if the txt file is available, we need to check for document.querySelector("#tablebg textarea")
    const txtArea = await page.locator("#tablebg textarea").first();

    if (!txtArea.isVisible()) {
      throw new Error("Txt area not visible/found");
    }

    const txtAreaText = await txtArea.textContent();
    if (!txtAreaText) {
      throw new Error("Txt area text not found");
    }
    Logger.debug(`Txt area text found: ${txtAreaText}`);

    const songNotes = txtAreaText.split("\n").map((line) => line.trim());
    const songNoteLines = this._ensureSongNoteMetaEntries(
      songNotes,
      coverImageName,
      audioName,
      videoName,
    );

    // write to file
    const txtFilePath = path.resolve(
      downloadSingleSongDirPath,
      `${songTitleSanitized}.txt`,
    );
    await fs.promises.writeFile(txtFilePath, songNoteLines.join("\n"));
    Logger.log(`Txt file written to: ${txtFilePath}`);

    Logger.log(`Song downloaded successfully`);

    return {
      downloadSingleSongDirPath
    }
  }

  private static async _waitForProcessToFinish(
    process: ChildProcess,
    downloadUrl: string,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      process.stdout?.on("data", (data) => {
        Logger.debug(`Video download stdout for ${downloadUrl}: ${data}`);
      });
      process.stderr?.on("data", (data) => {
        Logger.debug(`Video download stderr for ${downloadUrl}: ${data}`);
      });

      process.on("close", (code) => {
        if (code === null) {
          reject(new Error("Process closed with null code"));
          return;
        }
        Logger.debug(`Process closed with code: ${code} for ${downloadUrl}`);
        resolve(code);
      });
      process.on("error", (error) => {
        reject(error);
      });
    });
  }

  private static async _downloadYoutubeVideoAndSplit(
    youtubeVideoId: string,
    downloadSingleSongDirPath: string,
    songTitleSanitized: string,
    preferredVideoHeight: number,
    preferredVideoFormat: string,
    targetAudioFormat: string,
  ): Promise<AudioVideoFileNamesTuple> {
    // see https://github.com/ytdl-org/youtube-dl
    // yt-dlp -o vid.mp4 -f "(mp4)best[height<=720]" "https://youtu.be/ETxmCCsMoD0"
    // yt-dlp -o vid.mp4 -f "best[ext=mp4][height<=720]" -o '%(title)s.f%(format_id)s.%(ext)s' "https://youtu.be/ETxmCCsMoD0"

    const videoOutputFileName = `${songTitleSanitized}_working.${preferredVideoFormat}`;

    const videoFormatOption = `best[ext=${preferredVideoFormat}][height<=${preferredVideoHeight}]`;
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;

    const videoDownloadCommand = `yt-dlp -f "${videoFormatOption}" -o "${videoOutputFileName}"  "${videoUrl}"`;
    Logger.log(`Downloading video with command: ${videoDownloadCommand}`);
    const videoDownloadProcess = exec(videoDownloadCommand, {
      cwd: downloadSingleSongDirPath,
    });
    const videoDownloadResult = await this._waitForProcessToFinish(
      videoDownloadProcess,
      videoUrl,
    );
    Logger.log(`Video downloaded with result: ${videoDownloadResult}`);

    const inputVideoFilePath = path.resolve(
      downloadSingleSongDirPath,
      videoOutputFileName,
    );
    if (!fs.existsSync(inputVideoFilePath)) {
      throw new Error(`Video file not found: ${inputVideoFilePath}`);
    }

    // then split autio from video
    // e.g. ffmpeg -i infile.mp4 -an -c:v copy videoout.mp4 -vn -map 0:a audioout.mp3
    const audioOnlyOutputFileName = `${songTitleSanitized}.${targetAudioFormat}`;
    const videoOnlyOutputFileName = `${songTitleSanitized}.${preferredVideoFormat}`;
    const audioDownloadCommand = `ffmpeg -i "${videoOutputFileName}" -an -c:v copy "${videoOnlyOutputFileName}" -vn -map 0:a "${audioOnlyOutputFileName}"`;
    Logger.log(`Downloading audio with command: ${audioDownloadCommand}`);
    const audioDownloadResultPromise = exec(audioDownloadCommand, {
      cwd: downloadSingleSongDirPath,
    });
    const audioDownloadResult = await this._waitForProcessToFinish(
      audioDownloadResultPromise,
      videoUrl,
    );
    Logger.log(`Audio downloaded with result: ${audioDownloadResult}`);

    // check if the audio and video files exist
    const audioOnlyOutputFilePath = path.resolve(
      downloadSingleSongDirPath,
      audioOnlyOutputFileName,
    );
    if (!fs.existsSync(audioOnlyOutputFilePath)) {
      throw new Error(
        `Audio file not found after splitting: ${audioOnlyOutputFilePath}`,
      );
    }
    const videoOnlyOutputFilePath = path.resolve(
      downloadSingleSongDirPath,
      videoOnlyOutputFileName,
    );
    if (!fs.existsSync(videoOnlyOutputFilePath)) {
      throw new Error(
        `Video file not found after splitting: ${videoOnlyOutputFilePath}`,
      );
    }

    // remove the working video file
    await fs.promises.rm(
      path.resolve(downloadSingleSongDirPath, videoOutputFileName),
    );
    Logger.log(`Working video file removed: ${videoOutputFileName}`);

    // this should also split the video into video and audio files
    return {
      audioName: audioOnlyOutputFileName,
      videoName: videoOnlyOutputFileName,
    };
  }

  // from somewhere on the internet
  private static _getYoutubeVideoId(url: string): string | null {
    const regExp =
      /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[7].length == 11 ? match[7] : null;
  }

  private static _ensureSongNoteMetaEntries(
    songNotes: string[],
    songCoverImageName: string,
    songAudioName: string,
    songVideoName: string,
  ): string[] {
    // do not validate the entries
    // we want to ensure we have entries for:
    // - #COVER
    // - #MP3 / #AUDIO
    // - #VIDEO
    // - #COMMENT

    const metaEntries = [
      `#COVER: ${songCoverImageName}`,
      `#MP3: ${songAudioName}`,
      `#AUDIO: ${songAudioName}`,
      `#VIDEO: ${songVideoName}`,
      `#COMMENT: Automatically downloaded by UltraStar Karaoke Companion`,
    ];

    // if we have entries, then overwrite the existing entries
    // but make sure that missing entries are put after the existing entries (after the last entry starting with #)
    const metaEntryMatchers = [
      /^#COVER:/i,
      /^#MP3:/i,
      /^#AUDIO:/i,
      /^#VIDEO:/i,
      /^#COMMENT:/i,
    ];
    const foundMetaEntryIndices = new Set<number>();
    const updatedSongNoteLines: string[] = [];

    for (const songNoteLine of songNotes) {
      const matchingMetaEntryIndex = metaEntryMatchers.findIndex((matcher) =>
        matcher.test(songNoteLine),
      );

      if (matchingMetaEntryIndex === -1) {
        updatedSongNoteLines.push(songNoteLine);
        continue;
      }

      // Keep only one canonical entry for each supported metadata key.
      if (foundMetaEntryIndices.has(matchingMetaEntryIndex)) {
        continue;
      }

      updatedSongNoteLines.push(metaEntries[matchingMetaEntryIndex]);
      foundMetaEntryIndices.add(matchingMetaEntryIndex);
    }

    const missingMetaEntries = metaEntries.filter(
      (_, index) => !foundMetaEntryIndices.has(index),
    );
    if (!missingMetaEntries.length) {
      return updatedSongNoteLines;
    }

    const lastMetaEntryIndex = updatedSongNoteLines.reduce(
      (lastIndex, songNoteLine, index) => {
        return songNoteLine.startsWith("#") ? index : lastIndex;
      },
      -1,
    );

    const insertIndex = lastMetaEntryIndex === -1 ? 0 : lastMetaEntryIndex + 1;
    updatedSongNoteLines.splice(insertIndex, 0, ...missingMetaEntries);

    return updatedSongNoteLines;
  }
}
