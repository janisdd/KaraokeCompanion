import {
  getSpotifyIdFromUrl,
  getSpotifyPlaylistFull,
  getTidalIdFromUrl,
  getTidalPlaylistFull,
  type StrippedTrack,
} from "~/helpers/playlistComparer";
import {
  AllOnlineSongsIndexer,
  type OnlineSongInfo,
} from "~/helpers/allOnlineSongsIndexer";
import { Logger } from "~/helpers/logger";
import { loadJsonWithCache, type CacheResult } from "~/helpers/playlistCache";
import {
  getSpotifyClient,
  getTidalClient,
  type TidalClient,
} from "~/helpers/onlineServicesHelper"

type CompareMode = "strict" | "lax"
type PlaylistService = "spotify" | "tidal"

type MatchResult = {
  spotify: StrippedTrack
  online: Pick<OnlineSongInfo, "key" | "songId" | "songName" | "artist">
}

type CachedPlaylist = CacheResult<StrippedTrack[]>

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    playListUrl?: string
    forceRefresh?: boolean
    compareMode?: CompareMode
  }>(event)
  const { playListUrl, forceRefresh, compareMode = "strict" } = body || {}

  if (!playListUrl) {
    throw createError({ statusCode: 400, message: "Missing playListUrl" })
  }

  if (compareMode !== "strict" && compareMode !== "lax") {
    throw createError({ statusCode: 400, message: "Invalid compareMode" })
  }

  const isSpotifyPlaylist = playListUrl.includes("spotify.com")
  const isTidalPlaylist = playListUrl.includes("tidal.com")

  if (!isSpotifyPlaylist && !isTidalPlaylist) {
    throw createError({ statusCode: 400, message: "Invalid playlist URL" })
  }

  const playlistService: PlaylistService = isTidalPlaylist ? "tidal" : "spotify"
  const id =
    playlistService === "spotify"
      ? getSpotifyIdFromUrl(playListUrl)
      : getTidalIdFromUrl(playListUrl)

  if (!id) {
    throw createError({ statusCode: 400, message: "Invalid playListUrl" })
  }

  const spotifyClient = playlistService === "spotify" ? await getSpotifyClient() : null
  const tidalClient = playlistService === "tidal" ? await getTidalClient() : null

  let playlistPromise: Promise<CachedPlaylist>

  if (playlistService === "spotify") {
    if (!spotifyClient) {
      throw createError({ statusCode: 500, message: "Spotify API not initialized" })
    }

    playlistPromise = loadSpotifyPlaylist(
      id,
      playListUrl,
      Boolean(forceRefresh),
      spotifyClient,
    )
  } else {
    if (!tidalClient) {
      throw createError({ statusCode: 500, message: "Tidal API not initialized" })
    }

    playlistPromise = loadTidalPlaylist(
      id,
      playListUrl,
      Boolean(forceRefresh),
      tidalClient,
    )
  }

  const [playlistResult, onlineSongs] = await Promise.all([
    playlistPromise,
    loadOnlineSongs(),
  ])

  const matches = matchPlaylistToOnline(
    playlistResult.data,
    onlineSongs,
    compareMode,
  )

  return {
    matches,
    playlistService,
    playlistCache: {
      updatedAt: playlistResult.updatedAt,
      source: playlistResult.source,
    },
  }
})

const loadOnlineSongs = async (): Promise<OnlineSongInfo[]> => {
  try {
    return AllOnlineSongsIndexer.getAllOnlineSongInfos() ?? []
  } catch {
    return []
  }
}

const matchPlaylistToOnline = (
  playlistTracks: StrippedTrack[],
  onlineSongs: OnlineSongInfo[],
  compareMode: CompareMode,
): MatchResult[] => {
  const validPlaylist = playlistTracks.filter(
    (track): track is StrippedTrack => !!track?.name && !!track?.artist,
  )
  const validOnlineSongs = onlineSongs.filter(
    (song): song is OnlineSongInfo => !!song?.songName && !!song?.artist,
  )

  const normalizedOnlineSongs = validOnlineSongs.map((song) => ({
    song,
    title: normalizeComparisonValue(song.songName),
    artist: normalizeComparisonValue(song.artist),
  }))

  const results: MatchResult[] = []

  for (const track of validPlaylist) {
    const normalizedTitle = normalizeComparisonValue(track.name)
    const normalizedArtist = normalizeComparisonValue(track.artist)

    if (!normalizedTitle || !normalizedArtist) {
      continue
    }

    const matchingOnlineSongs = normalizedOnlineSongs.filter((onlineSong) => {
      return (
        isMatch(normalizedTitle, onlineSong.title, compareMode) &&
        isMatch(normalizedArtist, onlineSong.artist, compareMode)
      )
    })

    if (!matchingOnlineSongs.length) {
      continue
    }

    for (const match of matchingOnlineSongs) {
      results.push({
        spotify: track,
        online: {
          key: match.song.key,
          songId: match.song.songId,
          songName: match.song.songName,
          artist: match.song.artist,
        },
      })
    }
  }

  return results
}

const normalizeComparisonValue = (value: string): string =>
  value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase()

const isMatch = (
  left: string,
  right: string,
  compareMode: CompareMode,
): boolean => {
  if (!left || !right) {
    return false
  }

  if (compareMode === "strict") {
    return left === right
  }

  return left.includes(right) || right.includes(left)
}

const loadSpotifyPlaylist = async (
  id: string,
  url: string,
  forceRefresh: boolean,
  spotifyClient: NonNullable<Awaited<ReturnType<typeof getSpotifyClient>>>,
): Promise<CachedPlaylist> => {
  const cacheFile = `spotify.${id}.json`
  const result = await loadJsonWithCache(
    cacheFile,
    async () => {
      return getSpotifyPlaylistFull(url, spotifyClient)
    },
    forceRefresh,
  )

  Logger.log(
    result.source === "cache"
      ? `Loaded cached playlist from ${cacheFile}`
      : `Wrote fresh playlist to ${cacheFile}`,
  )

  return result
}

const loadTidalPlaylist = async (
  id: string,
  url: string,
  forceRefresh: boolean,
  tidalClient: TidalClient,
): Promise<CachedPlaylist> => {
  const cacheFile = `tidal.${id}.json`
  const result = await loadJsonWithCache(
    cacheFile,
    async () => {
      return getTidalPlaylistFull(url, tidalClient)
    },
    forceRefresh,
  )

  Logger.log(
    result.source === "cache"
      ? `Loaded cached Tidal playlist from ${cacheFile}`
      : `Wrote fresh Tidal playlist to ${cacheFile}`
  )

  return result
}
