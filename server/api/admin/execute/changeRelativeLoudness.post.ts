import { changeRelativeLoudness } from "~/helperPrograms/executeHelpers/changeRelativeLoudness/changeRelativeLoudness"
import { Logger } from "~/helpers/logger"
import { getAdminExecuteSongContext } from "~/server/utils/executeHelpers"
import type {
  RunChangeRelativeLoudnessRequest,
  RunExecuteResponse,
} from "~/types/executeHelpers"

export default defineEventHandler(async (event) => {
  const body = await readBody<RunChangeRelativeLoudnessRequest>(event)
  const { song, songRootDir } = getAdminExecuteSongContext(body?.songKey)

  if (!song.audioFile) {
    throw createError({ statusCode: 400, message: "Song has no audio file" })
  }

  try {
    await changeRelativeLoudness.execute(
      songRootDir,
      song.audioFile,
      song.songDirName,
      body?.params,
    )
  } catch (error) {
    Logger.error(
      `[AdminChangeRelativeLoudness] Failed to run ${changeRelativeLoudness.executorKey} for ${song.key}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to run changeRelativeLoudness",
    })
  }

  const response: RunExecuteResponse = {
    success: true,
  }

  return response
})
