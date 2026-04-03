import { analyzeLoudness } from "~/helperPrograms/analyzeHelpers/loudness/analyze_loudness"
import { matchLoudnessTwoPassByTarget } from "~/helperPrograms/executeHelpers/matchLoudnessTwoPassByTarget/matchLoudnessTwoPassByTarget"
import { Logger } from "~/helpers/logger"
import { getAdminExecuteSongContext } from "~/server/utils/executeHelpers"
import type {
  RunExecuteResponse,
  RunMatchLoudnessTwoPassByTargetRequest,
} from "~/types/executeHelpers"

export default defineEventHandler(async (event) => {
  const body = await readBody<RunMatchLoudnessTwoPassByTargetRequest>(event)
  const { song, songRootDir } = getAdminExecuteSongContext(body?.songKey)

  if (!song.audioFileName) {
    throw createError({ statusCode: 400, message: "Song has no audio file" })
  }

  const analysis = analyzeLoudness.getResult(songRootDir, song.songDirName)
  if (!analysis) {
    throw createError({
      statusCode: 400,
      message: "Loudness analysis is not available. Run the loudness analysis first.",
    })
  }

  try {
    await matchLoudnessTwoPassByTarget.execute(
      songRootDir,
      song.songDirName,
      song.audioFileName,
      {
        analysis,
        targetLufsI: body?.params?.targetLufsI,
      },
    )
  } catch (error) {
    Logger.error(
      `[AdminMatchLoudnessTwoPassByTarget] Failed to run ${matchLoudnessTwoPassByTarget.executorKey} for ${song.key}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to run matchLoudnessTwoPassByTarget",
    })
  }

  const response: RunExecuteResponse = {
    success: true,
  }

  return response
})
