import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import path from "path";
import {
  getSpotifyIdFromUrl,
  getSpotifyPlaylistFull,
  type StrippedTrack,
} from "~/helpers/playlistComparer";
import fs from "fs";
import { Indexer } from "~/helpers/songsIndexer";
import type { SongInfo } from "~~/types/song";
import { ConfigHelper } from "~/helpers/configHelper";
import { Logger } from "~/helpers/logger";


const CLIENT_ID = ConfigHelper.getClientId();
const CLIENT_SECRET = ConfigHelper.getClientSecret();
const PlaylistCacheDirPath = ConfigHelper.getPlaylistCacheDirPath();

const sdk = CLIENT_ID && CLIENT_SECRET ? SpotifyApi.withClientCredentials(CLIENT_ID, CLIENT_SECRET) : null;

type MatchResult = {
  spotify: StrippedTrack;
  local: Pick<SongInfo, "title" | "artist">;
};

export default defineEventHandler(async (event) => {
  const body = await readBody<{ playListUrl?: string; forceRefresh?: boolean }>(event);
  const { playListUrl, forceRefresh } = body || {};

  if (!sdk) {
    throw createError({ statusCode: 500, message: "Spotify API not initialized" });
  }

  if (!playListUrl) {
    throw createError({ statusCode: 400, message: "Missing playListUrl" });
  }

  const id = getSpotifyIdFromUrl(playListUrl);

  if (!id) {
    throw createError({ statusCode: 400, message: "Invalid playListUrl" });
  }

  const [playlistTracks, localSongs] = await Promise.all([
    loadPlaylist(id, playListUrl, Boolean(forceRefresh)),
    loadLocalSongs(),
  ]);

  const matches = matchPlaylistToLocal(playlistTracks, localSongs);

  return {
    matches,
  };
});

const loadLocalSongs = async (): Promise<SongInfo[]> => {
  try {
    return Array.from(Indexer.getSongsMap().values());
  } catch {
    return [];
  }
};

const matchPlaylistToLocal = (
  playlistTracks: StrippedTrack[],
  localSongs: SongInfo[],
): MatchResult[] => {
  const validPlaylist = playlistTracks.filter(
    (t): t is StrippedTrack => !!t?.name && !!t?.artist,
  );
  const validLocal = localSongs.filter(
    (s): s is SongInfo => !!s?.title && !!s?.artist,
  );

  const normalizedLocal = validLocal.map((song) => ({
    title: normalizeValue(song.title),
    artist: normalizeValue(song.artist),
    song,
  }));

  const results: MatchResult[] = [];

  for (const track of validPlaylist) {
    const normalizedTitle = normalizeValue(track.name);
    const normalizedArtist = normalizeValue(track.artist);

    if (!normalizedTitle || !normalizedArtist) {
      continue;
    }

    const match = normalizedLocal.find((local) => {
      return (
        isSubsectMatch(normalizedTitle, local.title) &&
        isSubsectMatch(normalizedArtist, local.artist)
      );
    });

    if (match) {
      results.push({
        spotify: track,
        local: {
          title: match.song.title,
          artist: match.song.artist,
        },
      });
    }
  }

  return results;
};

const normalizeValue = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[.,(){}+&-_\|*@!']/g, "")
    .replace(/\s+/g, " ")
    .trim();

const isSubsectMatch = (left: string, right: string): boolean => {
  if (!left || !right) {
    return false;
  }
  return left.includes(right) || right.includes(left);
};

const loadPlaylist = async (
  id: string,
  url: string,
  forceRefresh: boolean,
): Promise<StrippedTrack[]> => {
  const cacheFile = `${id}.json`;
  const cached = readJsonIfExists(cacheFile) as StrippedTrack[] | undefined;
  if (!forceRefresh && cached && Array.isArray(cached)) {
    Logger.log(`Loaded cached playlist from ${cacheFile}`);
    return cached;
  }
  if (!sdk) {
    throw createError({ statusCode: 500, message: "Spotify API not initialized" });
  }
  const fresh = await getSpotifyPlaylistFull(url, sdk);
  writeJson(cacheFile, fresh);
  Logger.log(`Wrote fresh playlist to ${cacheFile}`);
  return fresh;
};

const readJsonIfExists = (file: string): StrippedTrack[] | undefined => {
  const fullPath = path.join(PlaylistCacheDirPath, file);
  if (fs.existsSync(fullPath)) {
    const raw = fs.readFileSync(fullPath, "utf-8");
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const writeJson = (file: string, data: StrippedTrack[]) => {
  fs.writeFileSync(
    path.join(PlaylistCacheDirPath, file),
    JSON.stringify(data, null, 2),
    "utf-8",
  );
};
