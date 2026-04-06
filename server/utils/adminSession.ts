import type { H3Event, SessionConfig } from 'h3'
import { useSession } from 'h3'

type AdminSessionData = {
  admin?: boolean
}

let cachedBaseSessionConfig: SessionConfig | undefined

const getBaseSessionConfig = (event: H3Event): SessionConfig => {
  if (cachedBaseSessionConfig) {
    return cachedBaseSessionConfig
  }

  const runtimeConfig = useRuntimeConfig(event) as unknown as { session: SessionConfig }
  const sessionConfig: SessionConfig = {
    name: runtimeConfig.session.name,
    password: runtimeConfig.session.password,
    cookie: runtimeConfig.session.cookie,
  }
  cachedBaseSessionConfig = sessionConfig

  return sessionConfig
}

const adminSessionCookieName = 'kc_admin_session'

const getAdminSessionConfig = (
  event: H3Event,
  overrides?: Partial<SessionConfig>,
): SessionConfig => ({
  ...getBaseSessionConfig(event),
  ...overrides,
  name: adminSessionCookieName,
})

export const getAdminSession = async (event: H3Event): Promise<AdminSessionData> => {
  const session = await useSession<AdminSessionData>(event, getAdminSessionConfig(event))
  return session.data
}

export const setAdminSession = async (
  event: H3Event,
  data: AdminSessionData,
  config?: Partial<SessionConfig>,
): Promise<AdminSessionData> => {
  const session = await useSession<AdminSessionData>(event, getAdminSessionConfig(event, config))
  await session.update({
    ...session.data,
    ...data,
  })
  return session.data
}

export const clearAdminSession = async (event: H3Event): Promise<boolean> => {
  const session = await useSession<AdminSessionData>(event, getAdminSessionConfig(event))
  await session.clear()
  return true
}
