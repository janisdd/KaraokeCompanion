import { timingSafeEqual } from "node:crypto"
import { z } from "zod"
import { ConfigHelper } from "~/helpers/configHelper"
import type { AdminSessionResponse } from "./session.get"

const bodySchema = z.object({
  password: z.string(),
})

function passwordsEqual(expected: string, received: string) {
  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from(received, "utf8")
  if (a.length !== b.length) {
    return false
  }
  return timingSafeEqual(a, b)
}

export default defineEventHandler(async (event) => {
  const body = await readBody<unknown>(event)
  const parsed = bodySchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.message })
  }

  const expected = ConfigHelper.getAdminPagePw()
  if (!passwordsEqual(expected, parsed.data.password)) {
    throw createError({ statusCode: 401, message: "Invalid password" })
  }

  const previous = await getUserSession(event)
  const prevSecure =
    typeof previous.secure === "object" && previous.secure !== null
      ? { ...previous.secure }
      : {}

  await setUserSession(event, {
    secure: {
      ...prevSecure,
      admin: true,
    },
  })

  const response: AdminSessionResponse = {
    success: true,
    data: {
      authenticated: true,
    },
  }

  return response
})
