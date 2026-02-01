import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import path from "path";
import { getSpotifyIdFromUrl, getSpotifyPlaylistFull, type StrippedTrack } from "~/helpers/playlistComparer";
import fs from "fs";
import { ConfigHelper } from "~/helpers/configHelper";
import { Logger } from "~/helpers/logger";

const CLIENT_ID = ConfigHelper.getClientId();
const CLIENT_SECRET = ConfigHelper.getClientSecret();
const PlaylistCacheDirPath = ConfigHelper.getPlaylistCacheDirPath();

const sdk = CLIENT_ID && CLIENT_SECRET ? SpotifyApi.withClientCredentials(CLIENT_ID, CLIENT_SECRET) : null;

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
		const playlist1Tracks = (playlist1 || [])
    .filter((t): t is StrippedTrack => !!t && !!t.name && !!t.artist && t.artist.length > 0)
  const playlist2Tracks = (playlist2 || [])
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
		intersectionTracks: intersectionTracks || []
	}
})

const loadPlaylist = async (id: string, url: string): Promise<StrippedTrack[]> => {
	const cacheFile = `${id}.json`
	const cached = readJsonIfExists(cacheFile) as StrippedTrack[] | undefined
	if (cached && Array.isArray(cached)) {
		Logger.log(`Loaded cached playlist from ${cacheFile}`)
		return cached
	}
	if (!sdk) {
		throw createError({ statusCode: 500, message: "Spotify API not initialized" });
	}
	const fresh = await getSpotifyPlaylistFull(url, sdk)
	writeJson(cacheFile, fresh)
	Logger.log(`Wrote fresh playlist to ${cacheFile}`)
	return fresh
}

const readJsonIfExists = (file: string): StrippedTrack[] | undefined => {
	const fullPath = path.join(PlaylistCacheDirPath, file)	
	if (fs.existsSync(fullPath)) {
		const raw = fs.readFileSync(fullPath, 'utf-8')
		try {
			return JSON.parse(raw)
		} catch {
			return undefined
		}
	}
	return undefined
}

const writeJson = (file: string, data: StrippedTrack[]) => {
	fs.writeFileSync(path.join(PlaylistCacheDirPath, file), JSON.stringify(data, null, 2), 'utf-8')
}