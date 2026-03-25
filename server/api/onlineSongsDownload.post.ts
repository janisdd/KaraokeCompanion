import { ConfigHelper } from "~/helpers/configHelper";
import type { OnlineSongInfo } from "~/helpers/allOnlineSongsIndexer";
import { Logger } from "~/helpers/logger";
import { UsdbAnimuxHelper } from "~/helpers/songsDownloader/UsdbAnimuxHelper";
import type { OnlineSongsDownloadResponse } from "~/types/onlineSongs";

type OnlineSongsDownloadRequest = {
  songs: OnlineSongInfo[];
  overwriteExisting?: boolean;
};

type ReindexDirRequest = {
  songsDirName: string;
};

const onlySimulateDownload = false;
const debugSimulateDownloadTime = 7000;

export default defineEventHandler(async (event) => {
  const body = await readBody<OnlineSongsDownloadRequest>(event);
  const songs = body.songs;
  //not supported yet, could cause problems when ultrastar is running...
  // const overwriteExisting = body.overwriteExisting ?? false;
  const overwriteExisting = false;

  if (songs.length === 0) {
    throw createError({
      statusCode: 400,
      message: "Missing songs",
    });
  }

  console.log("Received online songs:", songs);
  const response: OnlineSongsDownloadResponse = {
    ok: true,
    count: songs.length,
    reindexRequested: true,
    reindexError: null,
  };

  try {
    if (onlySimulateDownload) {
      //wait 5s to simulate the download
      await new Promise((resolve) =>
        setTimeout(resolve, debugSimulateDownloadTime),
      );
    } else {
      //download the songs
      for (const song of songs) {
        try {
          await UsdbAnimuxHelper.downloadSong(song, overwriteExisting);
        } catch (error) {
          Logger.error(
            `Error downloading song: ${error instanceof Error ? error.message : String(error)}`,
          );
          throw error;
        }
      }
    }
  } finally {
    // this is in finally to ensure that the reindex is always requested, even if an error occurs (some songs might be downloaded)
    try {
      await requestSongsReindex();
    } catch (error) {
      const reindexErrorMessage =
        error instanceof Error ? error.message : String(error);
      Logger.error(
        `Failed to reindex songs directory after download: ${reindexErrorMessage}`,
      );
      response.reindexRequested = false;
      response.reindexError = reindexErrorMessage;
    }
  }

  return response;
});

async function requestSongsReindex() {
  const port = ConfigHelper.getUltraStarCompanionPort();
  if (!port) {
    throw createError({
      statusCode: 500,
      message: "Ultra Star Companion port not set",
    });
  }

  const payload: ReindexDirRequest = {
    songsDirName: ConfigHelper.getDownloadSongsDir(),
  };

  const response = await fetch(`http://localhost:${port}/reindexDir`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw createError({
      statusCode: 502,
      message: `Failed to reindex songs directory: ${response.status} ${response.statusText}`,
    });
  }
}
