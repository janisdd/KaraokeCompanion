import {
  getSpotifyIdFromUrl,
  getSpotifyPlaylistFull,
  getTidalIdFromUrl,
  getTidalPlaylistFull,
  type StrippedTrack,
} from "~/helpers/playlistComparer";
import { SongsIndexer } from "~/helpers/songsIndexer";
import type { SongInfo } from "~~/types/song";
import { Logger } from "~/helpers/logger";
import { loadJsonWithCache, type CacheResult } from "~/helpers/playlistCache";
import {
  getSpotifyClient,
  getTidalClient,
  type TidalClient,
} from "~/helpers/onlineServicesHelper"

export type MatchResult = {
  spotify: StrippedTrack;
  local: Pick<SongInfo, "key" | "songDirName" | "title" | "artist">;
};

export type PlaylistService = "spotify" | "tidal"

type CachedPlaylist = CacheResult<StrippedTrack[]>;

export default defineEventHandler(async (event) => {
  const body = await readBody<{ playListUrl?: string; forceRefresh?: boolean }>(event);
  const { playListUrl, forceRefresh } = body || {};

  if (!playListUrl) {
    throw createError({ statusCode: 400, message: "Missing playListUrl" });
  }

  // check if the playlist is a Spotify or Tidal playlist
  const isSpotifyPlaylist = playListUrl.includes("spotify.com")
  const isTidalPlaylist = playListUrl.includes("tidal.com")
  if (!isSpotifyPlaylist && !isTidalPlaylist) {
    throw createError({ statusCode: 400, message: "Invalid playlist URL" });
  }

  const playlistService: PlaylistService = isTidalPlaylist ? "tidal" : "spotify"
  const id =
    playlistService === "spotify"
      ? getSpotifyIdFromUrl(playListUrl)
      : getTidalIdFromUrl(playListUrl)

  if (!id) {
    throw createError({ statusCode: 400, message: "Invalid playListUrl" });
  }

  const spotifyClient =
    playlistService === "spotify" ? await getSpotifyClient() : null
  const tidalClient = playlistService === "tidal" ? await getTidalClient() : null

  let playlistPromise: Promise<CachedPlaylist>

  if (playlistService === "spotify") {
    if (!spotifyClient) {
      throw createError({ statusCode: 500, message: "Spotify API not initialized" });
    }

    playlistPromise = loadSpotifyPlaylist(
      id,
      playListUrl,
      Boolean(forceRefresh),
      spotifyClient,
    )
  } else {
    if (!tidalClient) {
      throw createError({ statusCode: 500, message: "Tidal API not initialized" });
    }

    playlistPromise = loadTidalPlaylist(
      id,
      playListUrl,
      Boolean(forceRefresh),
      tidalClient,
    )
  }

  const [playlistResult, localSongs] = await Promise.all([
    playlistPromise,
    loadLocalSongs(),
  ]);

  if (!localSongs.length) {
    throw createError({
      statusCode: 503,
      message: "No local songs are indexed yet. Check your songs directory configuration and wait for indexing to finish.",
    });
  }

  const matches = matchPlaylistToLocal(playlistResult.data, localSongs);

  return {
    matches,
    playlistService,
    playlistCache: {
      updatedAt: playlistResult.updatedAt,
      source: playlistResult.source,
    },
  };
});

const loadLocalSongs = async (): Promise<SongInfo[]> => {
  try {
    return Array.from(SongsIndexer.getSongsMap().values());
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
          key: match.song.key,
          songDirName: match.song.songDirName,
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
    .replace(/[.,(){}+&%\-_\|*@!']/g, "")
    .replace(/\s+/g, " ")
    .trim();

const isSubsectMatch = (left: string, right: string): boolean => {
  if (!left || !right) {
    return false;
  }
  return left.includes(right) || right.includes(left);
};

const loadSpotifyPlaylist = async (
  id: string,
  url: string,
  forceRefresh: boolean,
  spotifyClient: NonNullable<Awaited<ReturnType<typeof getSpotifyClient>>>,
): Promise<CachedPlaylist> => {
  const cacheFile = `spotify.${id}.json`;
  const result = await loadJsonWithCache(
    cacheFile,
    async () => {
      return getSpotifyPlaylistFull(url, spotifyClient);
    },
    forceRefresh,
  );

  Logger.log(
    result.source === "cache"
      ? `Loaded cached Spotify playlist from ${cacheFile}`
      : `Wrote fresh Spotify playlist to ${cacheFile}`
  );

  return result;
};

const loadTidalPlaylist = async (
  id: string,
  url: string,
  forceRefresh: boolean,
  tidalClient: TidalClient,
): Promise<CachedPlaylist> => {
  const cacheFile = `tidal.${id}.json`;
  const result = await loadJsonWithCache(
    cacheFile,
    async () => {
      return getTidalPlaylistFull(url, tidalClient);
    },
    forceRefresh,
  );

  Logger.log(
    result.source === "cache"
      ? `Loaded cached Tidal playlist from ${cacheFile}`
      : `Wrote fresh Tidal playlist to ${cacheFile}`
  );

  return result;
};
