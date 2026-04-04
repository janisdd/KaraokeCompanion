import type { OnlineSongInfo, OnlineSongInfoPlain } from "../allOnlineSongsIndexer";
import path from "path";
import fs from "fs";
import { chromium, type Browser, type Page } from "playwright";
import { ConfigHelper } from "~/helpers/configHelper";
import { Logger } from "~/helpers/logger";
import { ChildProcess, spawn } from "child_process";
import { SongsIndexer } from "../songsIndexer";
import { AllOnlineSongsIndexer } from "../allOnlineSongsIndexer";

type AudioVideoFileNamesTuple = {
  audioName: string;
  videoName: string;
};

type UsdbSessionCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
};

const SLOW_MO = 100;
const USDB_SESSION_COOKIE_NAME = "PHPSESSID";
const USDB_SESSION_COOKIE_TIMEOUT_MS = 20 * 60 * 1000; // 20 min
//invalid characters will be replaced with an underscore
const INVALID_SONG_TITLE_CHARS_REGEX = /[^a-zA-Z0-9- äöüß\,\(\)\[\]]/g;

// TODO the cookie is a race condition (all checks related to it)
// when one instance runs and is e.g. waiting for the txt file to be available
// another instance might come and see an invalid cookie and try to login
// then the first instance will get an error because the server side cookie will be invalidated (because of the login)
// i have no idea how to solve this in node (nodejs is single threaded but we have multiple instances running??)
// some kind of mutex would be needed...

export class UsdbAnimuxHelper {

  // key is songId
  // contains song ids currently downloading in this process or finished
  private static _downloadingOrDownloadedSongIds: Set<string> = new Set();

  private static _indexingFinished = false;
  private static _usdbSessionCookie: UsdbSessionCookie | null = null;
  private static _usdbSessionCookieCreatedAt = 0;
  private static _usdbSessionLoginPromise: Promise<UsdbSessionCookie> | null = null;

	public static isIndexingFinished(): boolean {
		return this._indexingFinished;
	}

  public static isSongDownloadingOrDownloaded(songId: string): boolean {
    return this._downloadingOrDownloadedSongIds.has(songId);
  }

  public static async downloadSong(
    song: OnlineSongInfo,
    forceDownload: boolean = false,
    useDownloadDir: boolean = true,
  ): Promise<string | null> {
    let baseDir: string;
    let songDirNameOverride: string | null = null;

    if (useDownloadDir) {
      const downloadSongsDir = ConfigHelper.getDownloadSongsDir();
      if (!downloadSongsDir) {
        throw new Error("Download songs directory not set");
      }
      baseDir = downloadSongsDir;
    } else {
      const songsRoot = SongsIndexer.getSongRootMap().get(song.key);
      const songInfo = SongsIndexer.getSongsMap().get(song.key);
      if (!songsRoot || !songInfo) {
        throw new Error(
          "Cannot place song in original location: not found in local songs index",
        );
      }
      baseDir = songsRoot;
      songDirNameOverride = songInfo.songDirName;
    }

    // const songUrl = `${ConfigHelper.getUsdbAnimuxUrl()}/index.php?link=detail&id=4978`;
    const songUrl = `${ConfigHelper.getUsdbAnimuxUrl()}/index.php?link=detail&id=${song.songId}`;

    // e.g. url is https://usdb.animux.de/index.php?link=detail&id=4978
    // we need to get the id from the url
    // const urlParams = new URLSearchParams(songUrl);
    // const id = urlParams.get("id");
    // if (!id) {
    //   throw new Error(`ID not found in URL for song ${song.songName} (id: ${song.songId})`);
    // }
    // const songId = `${id}`;
    const songId = song.songId;

    const songIsDownloading = this._downloadingOrDownloadedSongIds.has(songId);
    if (songIsDownloading && !forceDownload) {
      Logger.log(`Song already downloading: ${songId}`);
      return null;
    }

    Logger.log(`Downloading song ${song.songName} (id: ${song.songId})`);

    // TODO this is a race condition...
    // when multiple requests are made at the same time
    // one could be before writing the file and the other after reading it

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
    let downloadedSongDirName: string | null = null;

    try {
      browser = await chromium.launch({
        headless: downloadUseHeadlessMode,
        slowMo: SLOW_MO,
        timeout: 35000, // in case something goes wrong, we don't want to wait forever
      });
      const page = await browser.newPage();
      await this._ensureUsdbSession(page);

      //now we are logged in
      const { downloadSingleSongDirPath } = await this._downloadSingleSong(
        page,
        songUrl,
        baseDir,
        songId,
        songDirNameOverride,
      );

      // wait for 1s to finish
      await new Promise((resolve) => setTimeout(resolve, 1_000));

      await browser.close();
      Logger.debug("Browser closed");
      browser = null;

      // when all is done, we can index the new directory
      await SongsIndexer.indexSingleSongDir(baseDir, downloadSingleSongDirPath, 0, 1);
      // Recompute the online song flags now that the local song index contains the download.
      AllOnlineSongsIndexer.addSingOnlineSongInfoToIndex({
        key: song.key,
        songId,
        songName: song.songName,
        artist: song.artist,
      } satisfies OnlineSongInfoPlain);

      downloadedSongDirName = path.basename(downloadSingleSongDirPath);
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
      // remove the song from the currently downloading song ids
      this._downloadingOrDownloadedSongIds.delete(songId);
      // re-add the song to the index, this will update the indexed and downloading states
      AllOnlineSongsIndexer.addSingOnlineSongInfoToIndex({
        key: song.key,
        songId: songId,
        songName: song.songName,
        artist: song.artist,
      } satisfies OnlineSongInfoPlain);
    }

    return downloadedSongDirName;
  }

  // if forceDownload is true, then the song will be downloaded even if it already exists
  // songDirNameOverride: when set (original library location), use this folder name instead of the USDB page title
  private static async _downloadSingleSong(
    page: Page,
    url: string,
    baseDir: string,
    songId: string,
    songDirNameOverride: string | null,
  ) {
    
    Logger.log(`Downloading song from URL: ${url}`);

    // go to the page and wait for the page to load
    await this._gotoUsdbPage(page, url);
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

    const songTitleSanitized = songTitle.replace(INVALID_SONG_TITLE_CHARS_REGEX, "_");
    const songDirName = songDirNameOverride ?? songTitleSanitized;
    const downloadSingleSongDirPath = path.resolve(baseDir, songDirName);
    if (!fs.existsSync(downloadSingleSongDirPath)) {
      await fs.promises.mkdir(downloadSingleSongDirPath);
    } else {
      // song dir already exists --> remove old files (dir is non-empty in normal cases)
      await fs.promises.rm(downloadSingleSongDirPath, {
        recursive: true,
        force: true,
      });
      await fs.promises.mkdir(downloadSingleSongDirPath);
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
      throw new Error(`Youtube video ID not found in url: ${youtubeVideoIframeUrl}`);
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
    await this._gotoUsdbPage(page, txtUrl);
    Logger.debug(`page ${txtUrl} loaded`);

    // we need to wait for the txt file to be available
    // +1 to be sure
    const requiredWaitTimeForSongDownload =
      ConfigHelper.getRequiredWaitTimeForSongDownload() + 1;
    Logger.log(
      `Waiting for ${requiredWaitTimeForSongDownload} seconds for txt file to be available`,
    );

    // wait and log ever 5 seconds (not perfectly accurate, but good enough)
    for (let i = 0; i < requiredWaitTimeForSongDownload; i += 5) {
      Logger.log(`Waiting for ${i} seconds for txt file to be available (song name: ${songTitleSanitized})...`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    Logger.log(`Txt file is available (song name: ${songTitleSanitized})`);

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

    // do not trim the lines, because ultrastar will concatenate the lines without spaces!
    // so the spaces need to be preserved!
    const songNotes = txtAreaText.split("\n");
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

  private static async _ensureUsdbSession(page: Page): Promise<void> {
    const cachedSessionCookie = this._getCachedUsdbSessionCookie();
    if (cachedSessionCookie) {
      await page.context().addCookies([cachedSessionCookie]);
      Logger.debug(`Reusing cached ${USDB_SESSION_COOKIE_NAME} cookie`);
      return;
    }

    if (!this._usdbSessionLoginPromise) {
      this._usdbSessionLoginPromise = this._loginAndCacheUsdbSession(page);
    }

    const loginPromise = this._usdbSessionLoginPromise;
    try {
      const sessionCookie = await loginPromise;
      await page.context().addCookies([sessionCookie]);
    } finally {
      if (this._usdbSessionLoginPromise === loginPromise) {
        this._usdbSessionLoginPromise = null;
      }
    }
  }

  private static async _loginAndCacheUsdbSession(page: Page): Promise<UsdbSessionCookie> {
    await page.goto(ConfigHelper.getUsdbAnimuxUrl());

    const usdbAnimuxId = ConfigHelper.getUsdbAnimuxId();
    const usdbAnimuxPw = ConfigHelper.getUsdbAnimuxPw();
    await page.fill('form input[name="user"]', usdbAnimuxId);
    await page.fill('form input[name="pass"]', usdbAnimuxPw);
    await page.click("form input#login");

    await page.waitForLoadState("domcontentloaded");
    Logger.log("page loaded");

    const sessionCookie = await this._extractUsdbSessionCookie(page);
    this._usdbSessionCookie = sessionCookie;
    this._usdbSessionCookieCreatedAt = Date.now();
    Logger.debug(
      `Cached ${USDB_SESSION_COOKIE_NAME} cookie for ${USDB_SESSION_COOKIE_TIMEOUT_MS}ms`,
    );

    return sessionCookie;
  }

  private static async _gotoUsdbPage(page: Page, url: string): Promise<void> {
   
    await page.goto(url);
    await page.waitForLoadState("domcontentloaded");

    if (await this._isErrorPage(page)) {
      this._clearCachedUsdbSessionCookie();
      throw new Error(`USDB returned an error page for ${url}, probably because the session cookie is invalid`);
    }

  }

  private static async _isUsdbLoginPage(page: Page): Promise<boolean> {
    const userInputCount = await page.locator('form input[name="user"]').count();
    const loginButtonCount = await page.locator("form input#login").count();
    return userInputCount > 0 && loginButtonCount > 0;
  }

  private static async _isErrorPage(page: Page): Promise<boolean> {
    const errorMessage = await page.locator("#tablebg .row1").textContent();

    if (errorMessage && errorMessage.toLowerCase().includes("error")) {
      return true;
    }
    return false;
  }

  private static _getCachedUsdbSessionCookie(): UsdbSessionCookie | null {
    if (!this._usdbSessionCookie) {
      return null;
    }

    const cookieAgeMs = Date.now() - this._usdbSessionCookieCreatedAt;
    if (cookieAgeMs > USDB_SESSION_COOKIE_TIMEOUT_MS) {
      Logger.debug(
        `Cached ${USDB_SESSION_COOKIE_NAME} cookie expired after ${cookieAgeMs}ms`,
      );
      this._clearCachedUsdbSessionCookie();
      return null;
    }

    return this._usdbSessionCookie;
  }

  private static _clearCachedUsdbSessionCookie(): void {
    this._usdbSessionCookie = null;
    this._usdbSessionCookieCreatedAt = 0;
  }

  private static async _extractUsdbSessionCookie(page: Page): Promise<UsdbSessionCookie> {
    const usdbSessionCookie = (await page.context().cookies()).find(
      (cookie) => cookie.name === USDB_SESSION_COOKIE_NAME,
    );

    if (!usdbSessionCookie) {
      throw new Error(`${USDB_SESSION_COOKIE_NAME} cookie not found after login`);
    }

    return {
      name: usdbSessionCookie.name,
      value: usdbSessionCookie.value,
      domain: usdbSessionCookie.domain,
      path: usdbSessionCookie.path,
      expires: usdbSessionCookie.expires,
      httpOnly: usdbSessionCookie.httpOnly,
      secure: usdbSessionCookie.secure,
      sameSite: usdbSessionCookie.sameSite,
    };
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

    const videoDownloadArgs = [
      "-f",
      videoFormatOption,
      "-o",
      videoOutputFileName,
      videoUrl,
    ];
    Logger.log(`Downloading video with command: yt-dlp ${videoDownloadArgs.join(" ")}`);
    const videoDownloadProcess = spawn("yt-dlp", videoDownloadArgs, {
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
    const audioDownloadArgs = [
      "-i",
      videoOutputFileName,
      "-an",
      "-c:v",
      "copy",
      videoOnlyOutputFileName,
      "-vn",
      "-map",
      "0:a",
      audioOnlyOutputFileName,
    ];
    Logger.log(`Downloading audio with command: ffmpeg ${audioDownloadArgs.join(" ")}`);
    const audioDownloadResultPromise = spawn("ffmpeg", audioDownloadArgs, {
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

  // from https://stackoverflow.com/questions/3452546/how-do-i-get-the-youtube-video-id-from-a-url
  private static _getYoutubeVideoId(url: string): string | null {
    const regExp =
      /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length == 11 ? match[2] : null;
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
      `#COVER:${songCoverImageName}`,
      `#MP3:${songAudioName}`,
      `#AUDIO:${songAudioName}`,
      `#VIDEO:${songVideoName}`,
      `#COMMENT:Automatically downloaded by UltraStar Karaoke Companion`,
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
