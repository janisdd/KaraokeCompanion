import { ConfigHelper } from "~/helpers/configHelper"
import { Logger } from "~/helpers/logger"

export default defineEventHandler(async () => {
  const port = ConfigHelper.getUltraStarCompanionPort()
  if (!port) {
    Logger.error("Ultra Star Companion port not set")
    throw createError({ statusCode: 500, message: "Ultra Star Companion port not set" })
  }

  const response = await fetch(`http://localhost:${port}/togglePauseCurrentSong`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    Logger.error(`Failed to pause current song: ${response.status} ${response.statusText}`)
    throw createError({
      statusCode: 502,
      message: `Failed to pause current song: ${response.status} ${response.statusText}`,
    })
  }

  return { ok: true }
})
