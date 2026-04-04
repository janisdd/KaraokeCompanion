import type { OnlineSongInfo } from "~/helpers/allOnlineSongsIndexer";
import { Logger } from "~/helpers/logger";
import { UsdbAnimuxHelper } from "~/helpers/songsDownloader/UsdbAnimuxHelper";
import { requestCompanionReindexSingleSongDir } from "~/server/utils/requestCompanionReindexSingleOrRootSongDir";
import type { OnlineSongsDownloadResponse } from "~/types/onlineSongs";

type OnlineSongsDownloadRequest = {
  songs: OnlineSongInfo[];
  overwriteExisting?: boolean;
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

  const response: OnlineSongsDownloadResponse = {
    ok: true,
    count: songs.length,
    reindexRequested: true,
    reindexError: null,
  };

  const companionReindexSongDirNames: string[] = [];

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
          const songDirName = await UsdbAnimuxHelper.downloadSong(
            song,
            overwriteExisting,
          );
          if (songDirName) {
            companionReindexSongDirNames.push(songDirName);
          }
        } catch (error) {
          Logger.error(
            `Error downloading song: ${error instanceof Error ? error.message : String(error)}`,
          );
          throw error;
        }
      }
    }
  } finally {
    // this is in finally to ensure that companion reindex runs for any song dirs that finished, even if a later download fails
    try {
      await requestCompanionReindexDownloadedSongDirs(companionReindexSongDirNames);
    } catch (error) {
      const reindexErrorMessage =
        error instanceof Error ? error.message : String(error);
      Logger.error(
        `Failed to reindex downloaded song dirs in companion: ${reindexErrorMessage}`,
      );
      response.reindexRequested = false;
      response.reindexError = reindexErrorMessage;
    }
  }

  return response;
});

async function requestCompanionReindexDownloadedSongDirs(
  songDirNames: string[],
) {
  const unique = [...new Set(songDirNames)];
  for (const singleSongDirName of unique) {
    await requestCompanionReindexSingleSongDir(singleSongDirName, {
      logPrefix: "[OnlineSongsDownload]",
    });
  }
}
