type MarkedSongsResponse = {
  markedSongs?: string[]
}

type SessionUser = {
  name?: string
} | null | undefined

const normalizeKeys = (keys: string[]) =>
  Array.from(new Set(keys.map((key) => key.trim()).filter(Boolean)))

const getFetchErrorStatus = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return null
  }

  const fetchError = error as {
    status?: number
    statusCode?: number
    response?: { status?: number }
    data?: { statusCode?: number }
  }

  return (
    fetchError.statusCode ??
    fetchError.status ??
    fetchError.response?.status ??
    fetchError.data?.statusCode ??
    null
  )
}

const getFetchErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== "object") {
    return fallback
  }

  const fetchError = error as {
    data?: { message?: string }
    statusMessage?: string
    message?: string
  }

  return (
    fetchError.data?.message ||
    fetchError.statusMessage ||
    fetchError.message ||
    fallback
  )
}

export const useMarkedSongs = () => {
  const markedSongKeys = useState<string[]>("marked-songs", () => [])
  const isMarkedSongsLoading = useState<boolean>(
    "marked-songs-loading",
    () => false,
  )
  const hasResolvedMarkedSongsSession = useState<boolean>(
    "marked-songs-session-resolved",
    () => false,
  )
  const isMarkedSongsAuthenticated = useState<boolean>(
    "marked-songs-authenticated",
    () => false,
  )
  const markedSongsErrorMessage = useState<string | null>(
    "marked-songs-error-message",
    () => null,
  )
  const pendingSaveKeys = useState<string[] | null>(
    "marked-songs-pending-save",
    () => null,
  )
  const isPersistingMarkedSongs = useState<boolean>(
    "marked-songs-persisting",
    () => false,
  )
  const syncInitialized = useState<boolean>(
    "marked-songs-sync-initialized",
    () => false,
  )
  const { user } = useUserSession()
  const sessionUserName = computed(() => {
    const sessionUser = user.value as SessionUser
    const name = sessionUser?.name

    return typeof name === "string" && name.trim() ? name : null
  })

  const clearMarkedSongsSession = () => {
    markedSongKeys.value = []
    isMarkedSongsAuthenticated.value = false
    hasResolvedMarkedSongsSession.value = true
    isMarkedSongsLoading.value = false
    markedSongsErrorMessage.value = null
    pendingSaveKeys.value = null
  }

  const loadMarkedSongs = async () => {
    if (!import.meta.client) {
      return
    }

    if (!sessionUserName.value) {
      clearMarkedSongsSession()
      return
    }

    isMarkedSongsLoading.value = true
    markedSongsErrorMessage.value = null

    try {
      const response = await $fetch<MarkedSongsResponse>(
        "/api/users/session-user-marked-songs",
      )

      markedSongKeys.value = normalizeKeys(response.markedSongs ?? [])
      isMarkedSongsAuthenticated.value = true
      hasResolvedMarkedSongsSession.value = true
    } catch (error) {
      if (getFetchErrorStatus(error) === 401) {
        clearMarkedSongsSession()
        return
      }

      markedSongKeys.value = []
      isMarkedSongsAuthenticated.value = true
      hasResolvedMarkedSongsSession.value = true
      markedSongsErrorMessage.value = getFetchErrorMessage(
        error,
        "Failed to load marked songs",
      )
    } finally {
      isMarkedSongsLoading.value = false
    }
  }

  const persistMarkedSongs = async () => {
    if (!import.meta.client || !isMarkedSongsAuthenticated.value) {
      return
    }

    pendingSaveKeys.value = [...markedSongKeys.value]

    if (isPersistingMarkedSongs.value) {
      return
    }

    isPersistingMarkedSongs.value = true

    try {
      while (pendingSaveKeys.value) {
        const nextKeys = [...pendingSaveKeys.value]
        pendingSaveKeys.value = null

        try {
          await $fetch("/api/users/session-user-marked-songs", {
            method: "PATCH",
            body: { markedSongs: nextKeys },
          })
        } catch (error) {
          if (getFetchErrorStatus(error) === 401) {
            clearMarkedSongsSession()
            return
          }

          console.error("Failed to save marked songs", error)
          break
        }
      }
    } finally {
      isPersistingMarkedSongs.value = false
    }
  }

  const setMarkedSongKeys = (keys: string[]) => {
    if (!isMarkedSongsAuthenticated.value) {
      return
    }

    markedSongKeys.value = normalizeKeys(keys)
    void persistMarkedSongs()
  }

  const isMarkedSong = (key: string) => markedSongKeys.value.includes(key)

  const toggleMarkedSong = (key: string) => {
    if (!isMarkedSongsAuthenticated.value) {
      return
    }

    if (isMarkedSong(key)) {
      markedSongKeys.value = markedSongKeys.value.filter(
        (songKey) => songKey !== key,
      )
      void persistMarkedSongs()
      return
    }

    markedSongKeys.value = normalizeKeys([...markedSongKeys.value, key])
    void persistMarkedSongs()
  }

  const unmarkAllSongs = () => {
    if (!isMarkedSongsAuthenticated.value) {
      return
    }

    markedSongKeys.value = []
    void persistMarkedSongs()
  }

  if (import.meta.client && !syncInitialized.value) {
    syncInitialized.value = true

    watch(
      sessionUserName,
      (nextUserName, previousUserName) => {
        if (nextUserName === previousUserName) {
          return
        }

        if (!nextUserName) {
          clearMarkedSongsSession()
          return
        }

        void loadMarkedSongs()
      },
      { immediate: true },
    )
  }

  return {
    markedSongKeys,
    isMarkedSong,
    toggleMarkedSong,
    unmarkAllSongs,
    setMarkedSongKeys,
    loadMarkedSongs,
    isMarkedSongsLoading,
    hasResolvedMarkedSongsSession,
    isMarkedSongsAuthenticated,
    markedSongsErrorMessage,
  }
}
