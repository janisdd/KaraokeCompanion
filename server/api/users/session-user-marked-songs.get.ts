import { UsersIndexer } from "~/helpers/usersIndexer"

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const sessionUser = session.user as { name?: string } | null | undefined
  const name = sessionUser?.name

  if (!name || typeof name !== "string") {
    throw createError({ statusCode: 401, message: "Not logged in" })
  }

  const user = UsersIndexer.getUser(name)
  if (!user) {
    throw createError({ statusCode: 404, message: `User '${name}' not found` })
  }

  return {
    markedSongs: user.markedSongs,
  }
})
