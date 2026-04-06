import { clearAdminSession } from "~/server/utils/adminSession"

export default defineEventHandler(async (event) => {
  await clearAdminSession(event)

  return { success: true as const }
})
