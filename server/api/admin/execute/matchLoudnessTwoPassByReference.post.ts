import { analyzeLoudness } from "~/helperPrograms/analyzeHelpers/loudness/analyze_loudness"
import { matchLoudnessTwoPassByReference } from "~/helperPrograms/executeHelpers/matchLoudnessTwoPassByReference/matchLoudnessTwoPassByReference"
import { Logger } from "~/helpers/logger"
import { getAdminExecuteSongContext } from "~/server/utils/executeHelpers"
import type {
  RunExecuteResponse,
  RunMatchLoudnessTwoPassByReferenceRequest,
} from "~/types/executeHelpers"

export default defineEventHandler(async (event) => {
  const body = await readBody<RunMatchLoudnessTwoPassByReferenceRequest>(event)
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
    await matchLoudnessTwoPassByReference.execute(
      songRootDir,
      song.songDirName,
      song.audioFileName,
      {
        analysis,
        referenceAnalysis: body?.params?.referenceAnalysis,
      },
    )
  } catch (error) {
    Logger.error(
      `[AdminMatchLoudnessTwoPassByReference] Failed to run ${matchLoudnessTwoPassByReference.executorKey} for ${song.key}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to run matchLoudnessTwoPassByReference",
    })
  }

  const response: RunExecuteResponse = {
    success: true,
  }

  return response
})
