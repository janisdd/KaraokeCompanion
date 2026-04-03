import { z } from "zod"
import { frontendUiThemeSchema, UsersIndexer } from "~/helpers/usersIndexer"

const bodySchema = z.object({
  theme: frontendUiThemeSchema,
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const sessionUser = session.user as { name?: string } | null | undefined
  const name = sessionUser?.name

  if (!name || typeof name !== "string") {
    throw createError({ statusCode: 401, message: "Not logged in" })
  }

  const body = await readBody<unknown>(event)
  const parsed = bodySchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.message })
  }

  try {
    const updated = UsersIndexer.updateUserTheme(name, parsed.data.theme)
    await setUserSession(event, {
      user: {
        name,
        theme: updated.theme,
      },
    })
    return updated
  } catch {
    throw createError({ statusCode: 404, message: `User '${name}' not found` })
  }
})
