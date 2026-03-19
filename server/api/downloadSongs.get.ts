import path from "path";
import fs from "fs";
import { chromium, type Browser, type Page } from "playwright";
import { ConfigHelper } from "~/helpers/configHelper";
import { Logger } from "~/helpers/logger";

type AudioVideoFilePathsTuple = {
  audioPath: string;
  videoPath: string;
};

// TODO make config to not use headless mode (env)

export default defineEventHandler(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const page = await browser.newPage();
  await page.goto("https://usdb.animux.de/");
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

  const testUrl = "https://usdb.animux.de/index.php?link=detail&id=4978";
  await downloadSong(browser, page, testUrl);

  // wait for 10 seconds
  await new Promise((resolve) => setTimeout(resolve, 1000000));

  await browser.close();

  return { success: true };
});

async function downloadSong(browser: Browser, page: Page, url: string) {
  const downloadSongsDir = ConfigHelper.getDownloadSongsDir();
  if (!downloadSongsDir) {
    throw new Error("Download songs directory not set");
  }

  Logger.log(`Downloading song from URL: ${url}`);

  // e.g. url is https://usdb.animux.de/index.php?link=detail&id=4978
  // we need to get the id from the url
  const urlParams = new URLSearchParams(url);
  const id = urlParams.get("id");
  if (!id) {
    throw new Error("ID not found in URL");
  }
  const songId = `${id}`;
  Logger.log(`Song ID found: ${songId}`);

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

  const songTitleSanitized = songTitle.replace(/[^a-zA-Z0-9]/g, "_");
  const downloadSongsDirPath = path.resolve(
    downloadSongsDir,
    songTitleSanitized,
  );
  if (!fs.existsSync(downloadSongsDirPath)) {
    await fs.promises.mkdir(downloadSongsDirPath);
  } else {
    // song dir already exists --> remove old files
    await fs.promises.rmdir(downloadSongsDirPath);
    Logger.warn(
      `Download songs directory already exists: ${downloadSongsDirPath} --> removed old files`,
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
  const coverImageUrl = `https://usdb.animux.de/${coverImageUrlPart}`;
  const coverImageExtension = path.extname(coverImageUrlPart).toLowerCase();
  if (!coverImageExtension) {
    throw new Error("Cover image extension not found");
  }

  const coverImagePath = path.resolve(
    downloadSongsDirPath,
    `${songTitleSanitized}${coverImageExtension}`,
  );
  if (!fs.existsSync(coverImagePath)) {
    const response = await fetch(coverImageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download cover image: ${response.statusText}`);
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
  const youtubeVideoId = getYoutubeVideoId(youtubeVideoIframeUrl);
  if (!youtubeVideoId) {
    throw new Error("Youtube video ID not found");
  }
  Logger.log(`Youtube video ID found: ${youtubeVideoId}`);

  const { audioPath, videoPath } =
    await downloadYoutubeVideoAndSplit(youtubeVideoId);

  // the last step is to get the actual txt file with the notes
  // the correct url is https://usdb.animux.de/index.php?link=gettxt&id=<songId>

  const txtUrl = `https://usdb.animux.de/index.php?link=gettxt&id=${songId}`;
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
  Logger.log(`Txt area text found: ${txtAreaText}`);

  const songNotes = txtAreaText.split("\n").map((line) => line.trim());
  const songNoteLines = ensureSongNoteMetaEntries(
    songNotes,
    coverImagePath,
    audioPath,
    videoPath,
  );

  // write to file
  const txtFilePath = path.resolve(
    downloadSongsDirPath,
    `${songTitleSanitized}.txt`,
  );
  await fs.promises.writeFile(txtFilePath, songNoteLines.join("\n"));
  Logger.log(`Txt file written to: ${txtFilePath}`);

  await page.goto(url);
  await page.waitForLoadState("domcontentloaded");
  Logger.log("page loaded");
}

async function downloadYoutubeVideoAndSplit(
  youtubeVideoId: string,
): Promise<AudioVideoFilePathsTuple> {
  //TODO call yt-dlp (for later)
  // END call yt-dlp
  // this should also split the video into video and audio files
  return { audioPath: "", videoPath: "" };
}

// from somewhere on the internet
function getYoutubeVideoId(url: string): string | null {
  const regExp =
    /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[7].length == 11 ? match[7] : null;
}

function ensureSongNoteMetaEntries(
  songNotes: string[],
  songCoverImagePath: string,
  songAudioPath: string,
  songVideoPath: string,
): string[] {
  // do not validate the entries
  // we want to ensure we have entries for:
  // - #COVER
  // - #MP3 / #AUDIO
  // - #VIDEO
  // - #COMMENT

  const metaEntries = [
    `#COVER: ${songCoverImagePath}.jpg`,
    `#MP3: ${songAudioPath}.mp3`,
    `#AUDIO: ${songAudioPath}.mp3`,
    `#VIDEO: ${songVideoPath}.mp4`,
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
