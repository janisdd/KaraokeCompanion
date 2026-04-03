import { UsersIndexer } from "~/helpers/usersIndexer"

export default defineEventHandler(async () => {
  try {
    return UsersIndexer.getAllUsers()
  } catch {
    return []
  }
})

