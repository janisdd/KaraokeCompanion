export type AdminSessionResponse = {
  success: true
  data: {
    authenticated: boolean
  }
}

export default defineEventHandler(async (event) => {
  const session = await getAdminSession(event)
  const authenticated = Boolean(session.admin)

  const response: AdminSessionResponse = {
    success: true,
    data: {
      authenticated,
    },
  }

  return response
})
