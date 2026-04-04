import path from "path"
import { SongsIndexer } from "~/helpers/songsIndexer"
import { requestCompanionReindexRootDir } from "~/server/utils/requestCompanionReindexSingleOrRootSongDir"
import { z } from "zod"

const bodySchema = z.object({
  rootSongDir: z.string().min(1),
})

const logPrefix = "[AdminReindexRootSongDir]"

export default defineEventHandler(async (event) => {
  const rawBody = await readBody<unknown>(event)
  const parsed = bodySchema.safeParse(rawBody)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: parsed.error.message,
    })
  }

  const resolvedRootPath = path.resolve(parsed.data.rootSongDir.trim())
  if (!SongsIndexer.isSongsRootDirPath(resolvedRootPath)) {
    throw createError({
      statusCode: 400,
      message: "Not a known songs root directory",
    })
  }

  const songsRootDirName = path.basename(resolvedRootPath)
  return requestCompanionReindexRootDir(songsRootDirName, { logPrefix })
})
