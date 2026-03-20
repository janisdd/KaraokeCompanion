import type { OnlineSongInfo } from "~/helpers/allOnlineSongsIndexer";
import { Logger } from "~/helpers/logger";
import { UsdbAnimuxHelper } from "~/helpers/songsDownloader/UsdbAnimuxHelper";

type OnlineSongsDownloadRequest = {
  songs: OnlineSongInfo[];
};

const onlySimulateDownload = true;
const debugSimulateDownloadTime = 5000;

export default defineEventHandler(async (event) => {
  const body = await readBody<OnlineSongsDownloadRequest>(event);
  const songs = body.songs;

  if (songs.length === 0) {
    throw createError({
      statusCode: 400,
      message: "Missing songs",
    });
  }

  console.log("Received online songs:", songs);

  if (onlySimulateDownload) {
    //wait 5s to simulate the download
    await new Promise((resolve) =>
      setTimeout(resolve, debugSimulateDownloadTime),
    );
  } else {
    //download the songs
    for (const song of songs) {
      try {
        await UsdbAnimuxHelper.downloadSong(song);
      } catch (error) {
        Logger.error(
          `Error downloading song: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    }
  }

  return {
    ok: true,
    count: songs.length,
  };
});
