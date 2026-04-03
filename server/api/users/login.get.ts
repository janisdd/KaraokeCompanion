import { z } from "zod"
import { userNameSchema, UsersIndexer } from "~/helpers/usersIndexer"

const loginUserQuerySchema = z.object({
  name: userNameSchema,
  redirectTo: z.string().optional(),
})

const getSafeRedirectPath = (redirectTo?: string): string => {
  const trimmedRedirectTo = redirectTo?.trim()

  if (!trimmedRedirectTo) {
    return "/"
  }

  if (!trimmedRedirectTo.startsWith("/") || trimmedRedirectTo.startsWith("//")) {
    throw createError({
      statusCode: 400,
      message: "redirectTo must be an internal path",
    })
  }

  return trimmedRedirectTo
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const parsedQuery = loginUserQuerySchema.safeParse({
    name: typeof query.name === "string" ? query.name.trim() : "",
    redirectTo: typeof query.redirectTo === "string" ? query.redirectTo.trim() : undefined,
  })

  if (!parsedQuery.success) {
    throw createError({ statusCode: 400, message: parsedQuery.error.message })
  }

  const user = UsersIndexer.getUser(parsedQuery.data.name)
  if (!user) {
    throw createError({ statusCode: 404, message: `User '${parsedQuery.data.name}' not found` })
  }

  await setUserSession(event, {
    user: {
      name: user.name,
      theme: user.theme,
    },
  })

  const redirectTo = getSafeRedirectPath(parsedQuery.data.redirectTo)
  const acceptsHtml = (getHeader(event, "accept") ?? "").includes("text/html")

  if (acceptsHtml) {
    return sendRedirect(event, redirectTo)
  }

  return {
    loggedIn: true,
    redirectTo,
    user: {
      name: user.name,
      theme: user.theme,
    },
  }
})
