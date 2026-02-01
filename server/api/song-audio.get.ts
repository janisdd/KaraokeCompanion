import fs from "fs";
import path from "path";
import { Indexer } from "~/helpers/songsIndexer";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const songId = typeof query.id === "string" ? query.id.trim() : "";

  if (!songId) {
    throw createError({ statusCode: 400, message: "Missing song id" });
  }

  const song = Indexer.getSongsMap().get(songId);
  if (!song) {
    throw createError({ statusCode: 404, message: "Song not found" });
  }

  const audioPath = song.audioFile?.trim() ?? "";
  if (!audioPath) {
    throw createError({ statusCode: 404, message: "Audio file not available" });
  }
  if (!audioPath.toLowerCase().endsWith(".mp3")) {
    throw createError({ statusCode: 400, message: "Invalid audio file" });
  }

  const songRoot = Indexer.getSongRootMap().get(songId);
  if (!songRoot) {
    throw createError({ statusCode: 404, message: "Song root not found" });
  }
  const rootPath = path.resolve(songRoot);
  const normalizedPath = audioPath.replace(/\\/g, "/");
  const resolvedPath = path.resolve(rootPath, normalizedPath);

  if (resolvedPath !== rootPath && !resolvedPath.startsWith(rootPath + path.sep)) {
    throw createError({ statusCode: 403, message: "Invalid audio path" });
  }

  try {
    await fs.promises.access(resolvedPath);
  } catch {
    throw createError({ statusCode: 404, message: "Audio file not found" });
  }

  const stat = await fs.promises.stat(resolvedPath);
  const fileSize = stat.size;
  const rangeHeader = getHeader(event, "range");

  setHeader(event, "Content-Type", "audio/mpeg");
  setHeader(event, "Accept-Ranges", "bytes");

  if (!rangeHeader || typeof rangeHeader !== "string") {
    setHeader(event, "Content-Length", fileSize);
    return sendStream(event, fs.createReadStream(resolvedPath));
  }

  const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
  if (!match) {
    throw createError({ statusCode: 416, message: "Invalid range" });
  }

  const start = match[1] ? Number.parseInt(match[1], 10) : 0;
  const end = match[2] ? Number.parseInt(match[2], 10) : fileSize - 1;

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start < 0) {
    throw createError({ statusCode: 416, message: "Invalid range" });
  }

  const clampedEnd = Math.min(end, fileSize - 1);
  const chunkSize = clampedEnd - start + 1;

  setResponseStatus(event, 206);
  setHeader(event, "Content-Range", `bytes ${start}-${clampedEnd}/${fileSize}`);
  setHeader(event, "Content-Length", chunkSize);
  return sendStream(event, fs.createReadStream(resolvedPath, { start, end: clampedEnd }));
});
