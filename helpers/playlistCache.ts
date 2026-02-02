import fs from "fs";
import path from "path";
import { ConfigHelper } from "~/helpers/configHelper";

export type CacheResult<T> = {
  data: T;
  updatedAt: string;
  source: "cache" | "fresh";
};

const PlaylistCacheDirPath = ConfigHelper.getPlaylistCacheDirPath();

const readJsonCache = <T>(file: string): { data: T; updatedAt: string } | undefined => {
  const fullPath = path.join(PlaylistCacheDirPath, file);
  if (fs.existsSync(fullPath)) {
    const raw = fs.readFileSync(fullPath, "utf-8");
    try {
      const stats = fs.statSync(fullPath);
      return { data: JSON.parse(raw) as T, updatedAt: stats.mtime.toISOString() };
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const writeJsonCache = <T>(file: string, data: T) => {
  fs.writeFileSync(
    path.join(PlaylistCacheDirPath, file),
    JSON.stringify(data, null, 2),
    "utf-8",
  );
};

export const loadJsonWithCache = async <T>(
  file: string,
  fetcher: () => Promise<T>,
  forceRefresh = false,
): Promise<CacheResult<T>> => {
  if (!forceRefresh) {
    const cached = readJsonCache<T>(file);
    if (cached) {
      return {
        data: cached.data,
        updatedAt: cached.updatedAt,
        source: "cache",
      };
    }
  }

  const fresh = await fetcher();
  writeJsonCache(file, fresh);

  return {
    data: fresh,
    updatedAt: new Date().toISOString(),
    source: "fresh",
  };
};
