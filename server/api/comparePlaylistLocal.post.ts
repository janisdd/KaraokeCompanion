import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import {
  getSpotifyIdFromUrl,
  getSpotifyPlaylistFull,
  type StrippedTrack,
} from "~/helpers/playlistComparer";
import { Indexer } from "~/helpers/songsIndexer";
import type { SongInfo } from "~~/types/song";
import { ConfigHelper } from "~/helpers/configHelper";
import { Logger } from "~/helpers/logger";
import { loadJsonWithCache, type CacheResult } from "~/helpers/playlistCache";


const CLIENT_ID = ConfigHelper.getClientId();
const CLIENT_SECRET = ConfigHelper.getClientSecret();
const sdk = CLIENT_ID && CLIENT_SECRET ? SpotifyApi.withClientCredentials(CLIENT_ID, CLIENT_SECRET) : null;

type MatchResult = {
  spotify: StrippedTrack;
  local: Pick<SongInfo, "title" | "artist">;
};

type CachedPlaylist = CacheResult<StrippedTrack[]>;

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

  const [playlistResult, localSongs] = await Promise.all([
    loadPlaylist(id, playListUrl, Boolean(forceRefresh)),
    loadLocalSongs(),
  ]);

  const matches = matchPlaylistToLocal(playlistResult.data, localSongs);

  return {
    matches,
    playlistCache: {
      updatedAt: playlistResult.updatedAt,
      source: playlistResult.source,
    },
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
): Promise<CachedPlaylist> => {
  const cacheFile = `${id}.json`;
  const result = await loadJsonWithCache(
    cacheFile,
    async () => {
      if (!sdk) {
        throw createError({ statusCode: 500, message: "Spotify API not initialized" });
      }
      return getSpotifyPlaylistFull(url, sdk);
    },
    forceRefresh,
  );

  Logger.log(
    result.source === "cache"
      ? `Loaded cached playlist from ${cacheFile}`
      : `Wrote fresh playlist to ${cacheFile}`
  );

  return result;
};
