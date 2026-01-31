import fs from "fs";
import path from "path";
import { ConfigHelper } from "~/helpers/configHelper";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const audioPath = typeof query.path === "string" ? query.path.trim() : "";

  if (!audioPath) {
    throw createError({ statusCode: 400, message: "Missing audio path" });
  }
  if (!audioPath.toLowerCase().endsWith(".mp3")) {
    throw createError({ statusCode: 400, message: "Invalid audio file" });
  }

  const rootPath = path.resolve(ConfigHelper.getUltraStartSongsDirPath());
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

  setHeader(event, "Content-Type", "audio/mpeg");
  setHeader(event, "Accept-Ranges", "bytes");
  return sendStream(event, fs.createReadStream(resolvedPath));
});
