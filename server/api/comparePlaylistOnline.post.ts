import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import {
  getSpotifyIdFromUrl,
  getSpotifyPlaylistFull,
  type StrippedTrack,
} from "~/helpers/playlistComparer";
import {
  AllOnlineSongsIndexer,
  type OnlineSongInfo,
} from "~/helpers/allOnlineSongsIndexer";
import { ConfigHelper } from "~/helpers/configHelper";
import { Logger } from "~/helpers/logger";
import { loadJsonWithCache, type CacheResult } from "~/helpers/playlistCache";

const CLIENT_ID = ConfigHelper.getClientId();
const CLIENT_SECRET = ConfigHelper.getClientSecret();
const sdk =
  CLIENT_ID && CLIENT_SECRET
    ? SpotifyApi.withClientCredentials(CLIENT_ID, CLIENT_SECRET)
    : null;

type CompareMode = "strict" | "lax";

type MatchResult = {
  spotify: StrippedTrack;
  online: Pick<OnlineSongInfo, "key" | "songId" | "songName" | "artist">;
};

type CachedPlaylist = CacheResult<StrippedTrack[]>;

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    playListUrl?: string;
    forceRefresh?: boolean;
    compareMode?: CompareMode;
  }>(event);
  const { playListUrl, forceRefresh, compareMode = "strict" } = body || {};

  if (!sdk) {
    throw createError({ statusCode: 500, message: "Spotify API not initialized" });
  }

  if (!playListUrl) {
    throw createError({ statusCode: 400, message: "Missing playListUrl" });
  }

  if (compareMode !== "strict" && compareMode !== "lax") {
    throw createError({ statusCode: 400, message: "Invalid compareMode" });
  }

  const id = getSpotifyIdFromUrl(playListUrl);
  if (!id) {
    throw createError({ statusCode: 400, message: "Invalid playListUrl" });
  }

  const [playlistResult, onlineSongs] = await Promise.all([
    loadPlaylist(id, playListUrl, Boolean(forceRefresh)),
    loadOnlineSongs(),
  ]);

  const matches = matchPlaylistToOnline(
    playlistResult.data,
    onlineSongs,
    compareMode,
  );

  return {
    matches,
    playlistCache: {
      updatedAt: playlistResult.updatedAt,
      source: playlistResult.source,
    },
  };
});

const loadOnlineSongs = async (): Promise<OnlineSongInfo[]> => {
  try {
    return AllOnlineSongsIndexer.getAllOnlineSongInfos() ?? [];
  } catch {
    return [];
  }
};

const matchPlaylistToOnline = (
  playlistTracks: StrippedTrack[],
  onlineSongs: OnlineSongInfo[],
  compareMode: CompareMode,
): MatchResult[] => {
  const validPlaylist = playlistTracks.filter(
    (track): track is StrippedTrack => !!track?.name && !!track?.artist,
  );
  const validOnlineSongs = onlineSongs.filter(
    (song): song is OnlineSongInfo => !!song?.songName && !!song?.artist,
  );

  const normalizedOnlineSongs = validOnlineSongs.map((song) => ({
    song,
    title: normalizeComparisonValue(song.songName),
    artist: normalizeComparisonValue(song.artist),
  }));

  const results: MatchResult[] = [];

  for (const track of validPlaylist) {
    const normalizedTitle = normalizeComparisonValue(track.name);
    const normalizedArtist = normalizeComparisonValue(track.artist);

    if (!normalizedTitle || !normalizedArtist) {
      continue;
    }

    const match = normalizedOnlineSongs.find((onlineSong) => {
      return (
        isMatch(normalizedTitle, onlineSong.title, compareMode) &&
        isMatch(normalizedArtist, onlineSong.artist, compareMode)
      );
    });

    if (!match) {
      continue;
    }

    results.push({
      spotify: track,
      online: {
        key: match.song.key,
        songId: match.song.songId,
        songName: match.song.songName,
        artist: match.song.artist,
      },
    });
  }

  return results;
};

const normalizeComparisonValue = (value: string): string =>
  value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();

const isMatch = (
  left: string,
  right: string,
  compareMode: CompareMode,
): boolean => {
  if (!left || !right) {
    return false;
  }

  if (compareMode === "strict") {
    return left === right;
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
      : `Wrote fresh playlist to ${cacheFile}`,
  );

  return result;
};
