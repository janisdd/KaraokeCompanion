import { z } from "zod"
import { UsersIndexer, frontendUiThemeSchema, userNameSchema } from "~/helpers/usersIndexer"

const createUserBodySchema = z.object({
  name: userNameSchema,
  theme: frontendUiThemeSchema.default("dark"),
  markedSongs: z.array(z.string()).optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody<unknown>(event)
  const parsed = createUserBodySchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.message })
  }

  if (UsersIndexer.hasUser(parsed.data.name)) {
    throw createError({ statusCode: 409, message: `User '${parsed.data.name}' already exists` })
  }

  const created = UsersIndexer.createUser(
    parsed.data.name,
    parsed.data.theme,
    parsed.data.markedSongs ?? [],
  )

  return created
})

