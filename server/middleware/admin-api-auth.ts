import { getMethod, getRequestURL } from "h3"
import { getAdminSession } from "~/server/utils/adminSession"

function isAdminPublicRoute(pathname: string, method: string) {
  if (pathname === "/api/admin/session" && method === "GET") {
    return true
  }
  if (pathname === "/api/admin/login" && method === "POST") {
    return true
  }
  return false
}

function isAdminApiPath(pathname: string) {
  return pathname === "/api/admin" || pathname.startsWith("/api/admin/")
}

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname
  if (!isAdminApiPath(pathname)) {
    return
  }

  const method = event.method
  if (isAdminPublicRoute(pathname, method)) {
    return
  }

  const session = await getAdminSession(event)
  if (!session.admin) {
    throw createError({
      statusCode: 401,
      message: "Admin authentication required",
    })
  }
})
