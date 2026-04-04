import type { SongInfo } from "~~/types/song"

type AudioPlaybackOptions = {
  storageKey: string
  getSongKey: (song: SongInfo) => string
  getAudioFile: (song: SongInfo) => string | null
}

const audioFingerprint = (song: SongInfo, getSongKey: (s: SongInfo) => string) => {
  const file = song.audioFileName?.trim() ?? ""
  return `${getSongKey(song)}\0${file}`
}

export const useSongAudioPlayback = (options: AudioPlaybackOptions) => {
  const activeAudio = ref<HTMLAudioElement | null>(null)
  const lastLoadedAudioFingerprint = ref<string | null>(null)
  const activeAudioKey = useState<string | null>(
    `${options.storageKey}-active-audio-key`,
    () => null,
  )
  const activeSong = useState<SongInfo | null>(
    `${options.storageKey}-active-song`,
    () => null,
  )
  const isActiveAudioPlaying = useState<boolean>(
    `${options.storageKey}-active-audio-playing`,
    () => false,
  )
  const currentTime = useState<number>(
    `${options.storageKey}-active-audio-time`,
    () => 0,
  )
  const duration = useState<number>(
    `${options.storageKey}-active-audio-duration`,
    () => 0,
  )
  const activeAudioHandlers = ref<{
    timeUpdate: () => void
    durationChange: () => void
    ended: () => void
    error: () => void
  } | null>(null)
  const pendingSeekTime = ref<number | null>(null)

  const removeActiveAudioHandlers = () => {
    if (!activeAudio.value || !activeAudioHandlers.value) {
      return
    }

    activeAudio.value.removeEventListener(
      "timeupdate",
      activeAudioHandlers.value.timeUpdate,
    )
    activeAudio.value.removeEventListener(
      "durationchange",
      activeAudioHandlers.value.durationChange,
    )
    activeAudio.value.removeEventListener(
      "loadedmetadata",
      activeAudioHandlers.value.durationChange,
    )
    activeAudio.value.removeEventListener(
      "ended",
      activeAudioHandlers.value.ended,
    )
    activeAudio.value.removeEventListener(
      "error",
      activeAudioHandlers.value.error,
    )
    activeAudioHandlers.value = null
  }

  const stopActiveAudio = () => {
    if (activeAudio.value) {
      removeActiveAudioHandlers()
      activeAudio.value.pause()
      activeAudio.value.currentTime = 0
      activeAudio.value = null
    }
    activeAudioKey.value = null
    activeSong.value = null
    isActiveAudioPlaying.value = false
    currentTime.value = 0
    duration.value = 0
    pendingSeekTime.value = null
    lastLoadedAudioFingerprint.value = null
  }

  const toggleAudioPlayback = (song: SongInfo) => {
    const audioFile = options.getAudioFile(song)
    if (!audioFile) {
      return
    }

    const key = options.getSongKey(song)
    const fp = audioFingerprint(song, options.getSongKey)
    const el = activeAudio.value
    let canReuseSameKeyElement =
      activeAudioKey.value === key &&
      el != null &&
      el.error == null &&
      el.networkState !== HTMLMediaElement.NETWORK_NO_SOURCE &&
      lastLoadedAudioFingerprint.value === fp

    if (canReuseSameKeyElement && import.meta.client && el) {
      const expectedHref = new URL(audioFile, window.location.href).href
      if (el.currentSrc !== expectedHref) {
        canReuseSameKeyElement = false
      }
    }

    if (canReuseSameKeyElement && el != null) {
      if (el.paused) {
        void el.play().catch(() => {
          isActiveAudioPlaying.value = false
        })
        isActiveAudioPlaying.value = true
      } else {
        el.pause()
        isActiveAudioPlaying.value = false
      }
      return
    }

    stopActiveAudio()

    const audio = new Audio()
    audio.preload = "auto"
    audio.src = audioFile
    activeAudio.value = audio
    activeAudioKey.value = key
    activeSong.value = song
    lastLoadedAudioFingerprint.value = fp
    isActiveAudioPlaying.value = true

    const handleTimeUpdate = () => {
      if (activeAudio.value !== audio) {
        return
      }
      currentTime.value = audio.currentTime
    }
    const handleDurationChange = () => {
      if (activeAudio.value !== audio) {
        return
      }
      duration.value = Number.isFinite(audio.duration) ? audio.duration : 0
      if (pendingSeekTime.value != null && duration.value > 0) {
        audio.currentTime = Math.min(
          Math.max(0, pendingSeekTime.value),
          duration.value,
        )
        currentTime.value = audio.currentTime
        pendingSeekTime.value = null
      }
    }
    const handleEnded = () => {
      if (activeAudio.value !== audio) {
        return
      }
      isActiveAudioPlaying.value = false
      activeAudioKey.value = null
      activeAudio.value = null
      activeSong.value = null
      currentTime.value = 0
      duration.value = 0
      lastLoadedAudioFingerprint.value = null
    }

    const handleError = () => {
      if (activeAudio.value !== audio) {
        return
      }
      stopActiveAudio()
    }

    activeAudioHandlers.value = {
      timeUpdate: handleTimeUpdate,
      durationChange: handleDurationChange,
      ended: handleEnded,
      error: handleError,
    }

    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("durationchange", handleDurationChange)
    audio.addEventListener("loadedmetadata", handleDurationChange)
    audio.addEventListener("ended", handleEnded)
    audio.addEventListener("error", handleError)

    void audio.play().catch(() => {
      isActiveAudioPlaying.value = false
    })
  }

  const seekTo = (time: number) => {
    if (!activeAudio.value) {
      return
    }

    const target = Math.max(0, time)
    if (!Number.isFinite(duration.value) || duration.value <= 0) {
      pendingSeekTime.value = target
      return
    }
    activeAudio.value.currentTime = Math.min(target, duration.value)
    currentTime.value = activeAudio.value.currentTime
  }

  onBeforeUnmount(() => {
    stopActiveAudio()
  })

  onBeforeRouteLeave(() => {
    stopActiveAudio()
  })

  return {
    activeAudioKey,
    activeSong,
    isActiveAudioPlaying,
    currentTime,
    duration,
    seekTo,
    stopActiveAudio,
    toggleAudioPlayback,
  }
}
