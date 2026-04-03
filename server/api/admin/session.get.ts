export type AdminSessionResponse = {
  success: true
  data: {
    authenticated: boolean
  }
}

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const authenticated = Boolean(session.secure?.admin)

  const response: AdminSessionResponse = {
    success: true,
    data: {
      authenticated,
    },
  }

  return response
})
