import { SpotifyApi } from "@spotify/web-api-ts-sdk"
import { createAPIClient } from "@tidal-music/api"
import { init as tidalAuthInit, credentialsProvider } from "@tidal-music/auth"
import { ConfigHelper } from "~/helpers/configHelper"
import { Logger } from "~/helpers/logger"

export type TidalClient = ReturnType<typeof createAPIClient>

const spotifyClientId = ConfigHelper.getSpotifyClientId()
const spotifyClientSecret = ConfigHelper.getSpotifyClientSecret()

const spotifyClient =
  spotifyClientId && spotifyClientSecret
    ? SpotifyApi.withClientCredentials(spotifyClientId, spotifyClientSecret)
    : null

const tidalClientId = ConfigHelper.getTidalClientId()
const tidalClientSecret = ConfigHelper.getTidalClientSecret()

let tidalClient: TidalClient | null = null
let tidalClientPromise: Promise<TidalClient | null> | null = null

export const getSpotifyClient = async (): Promise<typeof spotifyClient> =>
  spotifyClient

export const getTidalClient = async (): Promise<TidalClient | null> => {
  if (tidalClient) {
    return tidalClient
  }

  if (!tidalClientId || !tidalClientSecret) {
    return null
  }

  if (!tidalClientPromise) {
    // Reuse the same initialization work across concurrent requests.
    tidalClientPromise = tidalAuthInit({
      clientId: tidalClientId,
      clientSecret: tidalClientSecret,
      credentialsStorageKey: "tidal-credentials",
    })
      .then(() => {
        tidalClient = createAPIClient(credentialsProvider)
        Logger.log(`Finished Tidal client setup`)
        return tidalClient
      })
      .catch((error: unknown) => {
        tidalClientPromise = null
        Logger.error(`Failed to initialize Tidal auth: ${String(error)}`)
        throw error
      })
  }

  return tidalClientPromise
}
