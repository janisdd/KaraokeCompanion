import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { getSpotifyIdFromUrl, getSpotifyPlaylistFull, type StrippedTrack } from "~/helpers/playlistComparer";
import { ConfigHelper } from "~/helpers/configHelper";
import { Logger } from "~/helpers/logger";
import { loadJsonWithCache, type CacheResult } from "~/helpers/playlistCache";

const CLIENT_ID = ConfigHelper.getClientId();
const CLIENT_SECRET = ConfigHelper.getClientSecret();
const sdk = CLIENT_ID && CLIENT_SECRET ? SpotifyApi.withClientCredentials(CLIENT_ID, CLIENT_SECRET) : null;

type CachedPlaylist = CacheResult<StrippedTrack[]>;

export default defineEventHandler(async (event) => {
  const body = await readBody<{ playListUrl1?: string; playListUrl2?: string }>(event);
  const { playListUrl1: playListUrl1, playListUrl2: playListUrl2 } = body || {};

	if (!sdk) {
		throw createError({ statusCode: 500, message: "Spotify API not initialized" });
	}

  Logger.debug(`comparePlaylists: playListUrl1: ${playListUrl1}, playListUrl2: ${playListUrl2}`);

  if (!playListUrl1 || !playListUrl2) {
    throw createError({ statusCode: 400, message: "Missing playListUrlA or playListUrlB" });
  }

	const id1 = getSpotifyIdFromUrl(playListUrl1)
  const id2 = getSpotifyIdFromUrl(playListUrl2)

  if (!id1 || !id2) {
    throw createError({ statusCode: 400, message: "Invalid playListUrl1 or playListUrl2" });
  }

	const [playlist1, playlist2] = await Promise.all([
    loadPlaylist(id1, playListUrl1),
    loadPlaylist(id2, playListUrl2)
  ])

	  // Build unique track maps keyed by normalized "name|artist"
		const playlist1Tracks = (playlist1.data || [])
    .filter((t): t is StrippedTrack => !!t && !!t.name && !!t.artist && t.artist.length > 0)
  const playlist2Tracks = (playlist2.data || [])
    .filter((t): t is StrippedTrack => !!t && !!t.name && !!t.artist && t.artist.length > 0)

  const makeKey = (t: StrippedTrack) => `${t.name.toLowerCase().trim()}|${t.artist.toLowerCase().trim()}`

  const toKeyedMap = (tracks: StrippedTrack[]) => {
    const m = new Map<string, StrippedTrack>()
    for (const t of tracks) {
      const key = makeKey(t)
      if (!m.has(key)) m.set(key, t)
    }
    return m
  }

  const map1 = toKeyedMap(playlist1Tracks)
  const map2 = toKeyedMap(playlist2Tracks)

  const unique1 = new Set<string>([...map1.keys()])
  const unique2 = new Set<string>([...map2.keys()])

  const intersectionKeys = new Set([...unique1].filter(t => unique2.has(t)))

	const intersectionTracks = Array.from(intersectionKeys).map(key => map1.get(key))

	// console.log("intersectionKeys", intersectionKeys)
	// console.log("unique1", unique1)
	// console.log("unique2", unique2)
	// console.log("intersectionTracks", intersectionTracks)
	return {
		intersectionTracks: intersectionTracks || [],
    playlistCache: {
      playlistA: {
        updatedAt: playlist1.updatedAt,
        source: playlist1.source
      },
      playlistB: {
        updatedAt: playlist2.updatedAt,
        source: playlist2.source
      }
    }
	}
})

const loadPlaylist = async (id: string, url: string): Promise<CachedPlaylist> => {
	const cacheFile = `${id}.json`
	const result = await loadJsonWithCache(cacheFile, async () => {
    if (!sdk) {
      throw createError({ statusCode: 500, message: "Spotify API not initialized" });
    }
    return getSpotifyPlaylistFull(url, sdk);
  });

  Logger.log(
    result.source === "cache"
      ? `Loaded cached playlist from ${cacheFile}`
      : `Wrote fresh playlist to ${cacheFile}`
  );

  return result;
}