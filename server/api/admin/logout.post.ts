export default defineEventHandler(async (event) => {
  const previous = await getUserSession(event)
  const prevSecure =
    typeof previous.secure === "object" && previous.secure !== null
      ? { ...previous.secure }
      : {}

  await setUserSession(event, {
    secure: {
      ...prevSecure,
      admin: false,
    },
  })

  return { success: true as const }
})
