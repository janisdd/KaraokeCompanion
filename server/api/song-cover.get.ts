import fs from "fs";
import path from "path";
import { ConfigHelper } from "~/helpers/configHelper";
import { Indexer } from "~/helpers/songsIndexer";

const allowedExtensions = new Map<string, string>([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
]);

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

  const coverPath = song.coverFile?.trim() ?? "";
  if (!coverPath) {
    throw createError({ statusCode: 404, message: "Cover file not available" });
  }

  const extension = path.extname(coverPath).toLowerCase();
  const contentType = allowedExtensions.get(extension);
  if (!contentType) {
    throw createError({ statusCode: 400, message: "Invalid cover file" });
  }

  const rootPath = path.resolve(ConfigHelper.getUltraStartSongsDirPath());
  const normalizedPath = coverPath.replace(/\\/g, "/");
  const resolvedPath = path.resolve(rootPath, normalizedPath);

  if (resolvedPath !== rootPath && !resolvedPath.startsWith(rootPath + path.sep)) {
    throw createError({ statusCode: 403, message: "Invalid cover path" });
  }

  try {
    await fs.promises.access(resolvedPath);
  } catch {
    console.warn(`Cover file not found: ${resolvedPath}`);
    throw createError({ statusCode: 404, message: "Cover file not found" });
  }

  setHeader(event, "Content-Type", contentType);
  return sendStream(event, fs.createReadStream(resolvedPath));
});
