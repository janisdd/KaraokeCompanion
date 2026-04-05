import { ConfigHelper } from "~/helpers/configHelper"
import { Logger } from "~/helpers/logger"

export default defineEventHandler(async () => {
  const response = await fetch(
    ConfigHelper.getUltraStarCompanionRequestUrl("/closeScoreScreen"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    },
  )

  if (!response.ok) {
    Logger.error(`Failed to close score screen: ${response.status} ${response.statusText}`)
    throw createError({
      statusCode: 502,
      message: `Failed to close score screen: ${response.status} ${response.statusText}`,
    })
  }

  return { ok: true }
})
