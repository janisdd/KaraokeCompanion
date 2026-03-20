import type { OnlineSongInfo } from "~/helpers/allOnlineSongsIndexer";


type OnlineSongsDownloadRequest = {
  songs: OnlineSongInfo[];
};

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

	//wait 5s to simulate the download
	await new Promise((resolve) => setTimeout(resolve, 5000));

  return {
    ok: true,
    count: songs.length,
  };
});
