import { type PlaylistedTrack, SpotifyApi, type Track } from '@spotify/web-api-ts-sdk'
import { Logger } from './logger'
import { createAPIClient } from '@tidal-music/api'
export type StrippedTrack = {
	name: string
	artist: string
}

// http://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6
// the id is the part after the /track/, so 6rqhFgbbKwnb9MLmUQDhG6
export function getSpotifyIdFromUrl(url: string) {
	// Extract the last path segment and strip any query string
	try {
		const u = new URL(url)
		const segments = u.pathname.split('/').filter(Boolean)
		const last = segments.pop() || ''
		return last.split('?')[0]
	} catch {
		const last = (url.split('/').pop() || '')
		return last.split('?')[0]
	}
}

// e.g. https://tidal.com/playlist/6e2bb062-3e16-4b8b-b66e-9f0a43c150f6
export function getTidalIdFromUrl(url: string) {
	// Extract the last path segment and strip any query string
	try {
		const u = new URL(url)
		const segments = u.pathname.split('/').filter(Boolean)
		const last = segments.pop() || ''
		return last.split('?')[0]
	} catch {
		const last = (url.split('/').pop() || '')
		return last.split('?')[0]
	}
}

// obsolete
export async function getSpotifyAccessToken(clientId: string, clientSecret: string) {
  const tokenUrl = 'https://accounts.spotify.com/api/token'
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
 
  const body = new URLSearchParams()
  body.set('grant_type', 'client_credentials')
 
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  })
 
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to obtain access token: ${response.status} ${errorText}`)
  }
 
  const json = await response.json() as {
    access_token: string
    token_type: 'Bearer'
    expires_in: number
  }
 
  return json.access_token
}

export function toStrippedSpotify (tracks: Track[]): StrippedTrack[] {
	return tracks.map(t => ({
		// id: t.id as string,
		name: t.name,
		artist: t.artists?.[0]?.name || ''
	}))
}

export async function getAllSpotifyPlaylistPages(sdk: SpotifyApi, playlistId: string) {
	const pageSize = 20
	const allPages: PlaylistedTrack<Track>[] = []
	let page = await sdk.playlists.getPlaylistItems(playlistId, undefined, "total,limit,offset,items(track(name,artists(name)))", pageSize, 0)
	allPages.push(...page.items)
	let currCount = page.items.length
	while (currCount < page.total) {
		Logger.log(`Progress: ${currCount} / ${page.total} (${Math.round(currCount / page.total * 100)}%)`)
		const nextPage = await sdk.playlists.getPlaylistItems(
			playlistId, 
			undefined, 
			"total,limit,offset,items(track(name,artists(name)))",
			 pageSize, 
			 currCount
			)
		allPages.push(...nextPage.items)
		page = nextPage
		currCount += nextPage.items.length
	}
	return allPages
}

type TidalIncludedTrack = {
	id: string,
	type: 'tracks',
	attributes: {
		title: string
		explicit: boolean
	},
	relationships?: {
		artists: {
			data: Array<{
				id: string
				type: 'artists'
			}>
		}
	}
}
type TidalIncludedArtist = {
	id: string,
	type: 'artists',
	attributes: {
		name: string
	}
}
type TidalPlaylistResponse = {
	data: any[]
	included: Array<TidalIncludedTrack | TidalIncludedArtist>
	links: any
}

export function extractDataFromTidalPlaylistResponse(response: TidalPlaylistResponse, allTracks: TidalIncludedTrack[], allArtistsMap: Map<string, TidalIncludedArtist>) {
	const included = response.included
	for (const item of included) {
		if (item.type === 'tracks') {
			allTracks.push(item)
		} else if (item.type === 'artists') {
			allArtistsMap.set(item.id, item)
		}
	}
}

export async function getAllTidalPlaylistTracks(tidalClient: ReturnType<typeof createAPIClient>, playlistId: string) {
	Logger.log(`[Tidal] getting playlist ${playlistId}`)
	// see https://github.com/tidal-music/tidal-sdk-web/blob/main/packages/api/examples/api.js#L128

	const allPages: any[] = []
	const allTracks: TidalIncludedTrack[] = []
	const allArtistsMap = new Map<string, TidalIncludedArtist>()
	let pageCount = 0

	//@ts-ignore
	const page = await tidalClient.GET(`/playlists/${playlistId}/relationships/items`, {
		params: {
			path: { id: playlistId },
			query: {
				countryCode: 'DE',
				include: ['items.artists']
			},
		},
	})

	let pageData = page.data as TidalPlaylistResponse

	extractDataFromTidalPlaylistResponse(pageData, allTracks, allArtistsMap)
	pageCount++
	Logger.log(`[Tidal] got page ${pageCount} for playlist ${playlistId}, tracks: ${allTracks.length}`)

	let currentCursor = pageData.links?.meta?.nextCursor;

	while (currentCursor) {
		//@ts-ignore
		const nextPage = await tidalClient.GET(`/playlists/${playlistId}/relationships/items`, {
			params: {
				path: { id: playlistId },
				query: {
					countryCode: 'DE',
					include: ['items.artists'],
					// include: ['items'],
					'page[cursor]': currentCursor,
				},
			},
		})
		pageData = nextPage.data as TidalPlaylistResponse
		extractDataFromTidalPlaylistResponse(pageData, allTracks, allArtistsMap)
		pageCount++
		Logger.log(`[Tidal] got page ${pageCount} for playlist ${playlistId}, tracks: ${allTracks.length}`)
		currentCursor = pageData.links?.meta?.nextCursor;
	 	await new Promise(resolve => setTimeout(resolve, 500))
	}

	const strippedTracks: StrippedTrack[] = allTracks.map(track => ({
		name: track.attributes.title,
		artist: allArtistsMap.get(track.relationships?.artists?.data?.[0]?.id ?? '')?.attributes.name ?? ''
	}))

	Logger.log(`[Tidal] got ${strippedTracks.length} tracks for playlist ${playlistId}`)
	return strippedTracks
}

export async function getSpotifyPlaylistFull(playListUrl: string, sdk: SpotifyApi) {
  const playlistId = getSpotifyIdFromUrl(playListUrl)
  if (!playlistId) {
    throw new Error('Invalid playlist URL')
  }

	Logger.debug(`Getting Spotify playlist ${playlistId}`)

	// const playlist = await sdk.playlists.getPlaylistItems(
	// 	playlistId, 
	// 	undefined, 
	// 	"items(track(name,artists(name)))"
	// )
	// const stripped = toStripped(playlist.items.map(item => item.track))
	//get all pages
	const allPages = await getAllSpotifyPlaylistPages(sdk, playlistId)
	const stripped = toStrippedSpotify(allPages.map(item => item.track))
	
	// console.log(stripped)
	// console.log(stripped.length)
	
  return stripped
}

export async function getTidalPlaylistFull(playListUrl: string, tidalClient: ReturnType<typeof createAPIClient>) {
	const playlistId = getTidalIdFromUrl(playListUrl)
	if (!playlistId) {
		throw new Error('Invalid playlist URL')
	}
	Logger.debug(`Getting Tidal playlist ${playlistId}`)

	const stripped = await getAllTidalPlaylistTracks(tidalClient,playlistId)

	return stripped
}