import type { SongListRow } from "~~/types/song"
import {
  useSongListAudioPlayback,
  useSongListAudioPlaybackState,
} from "~~/composables/useSongListAudioPlayback"
import { useSongs } from "~~/composables/useSongs"

type SortKey = "title" | "artist" | "year" | "genre" | "language"
type SortDirection = "asc" | "desc"

type SongListViewOptions = {
  songs: Ref<SongListRow[]>
  stateKeyPrefix: string
  audioStorageKey: string
  /** Align search index with `useSongs({ stateKey })` when songs come from a keyed catalog. */
  songsCatalogKey?: string
}

export const useSongListViewState = (
  options: Pick<SongListViewOptions, "stateKeyPrefix" | "audioStorageKey">,
) => {
  const { stateKeyPrefix, audioStorageKey } = options

  const songTextWordsCache = useState<Record<string, string[]>>(
    `${stateKeyPrefix}-song-text-words-cache`,
    () => ({}),
  )
  const sortKey = useState<SortKey>(`${stateKeyPrefix}-sort-key`, () => "title")
  const sortDirection = useState<SortDirection>(
    `${stateKeyPrefix}-sort-direction`,
    () => "asc",
  )
  const metadataQuery = useState(`${stateKeyPrefix}-metadata-query`, () => "")
  const selectedSongKey = useState<string | null>(
    `${stateKeyPrefix}-selected-key`,
    () => null,
  )
  const selectedSongText = useState<string | null>(
    `${stateKeyPrefix}-selected-text`,
    () => null,
  )
  const selectedSongName = useState<string | null>(
    `${stateKeyPrefix}-selected-name`,
    () => null,
  )
  const {
    activeAudioKey,
    activeSong,
    currentTime,
    duration,
    isActiveAudioPlaying,
    resetState: resetAudioPlaybackState,
  } = useSongListAudioPlaybackState(audioStorageKey)

  const clearSongText = () => {
    selectedSongKey.value = null
    selectedSongText.value = null
    selectedSongName.value = null
  }

  const resetState = () => {
    songTextWordsCache.value = {}
    sortKey.value = "title"
    sortDirection.value = "asc"
    metadataQuery.value = ""
    clearSongText()
    resetAudioPlaybackState()
  }

  return {
    activeAudioKey,
    activeSong,
    currentTime,
    duration,
    isActiveAudioPlaying,
    clearSongText,
    metadataQuery,
    resetState,
    selectedSongKey,
    selectedSongName,
    selectedSongText,
    songTextWordsCache,
    sortDirection,
    sortKey,
  }
}

export const useSongListView = (options: SongListViewOptions) => {
  const { songs, stateKeyPrefix, audioStorageKey, songsCatalogKey } = options
  const { searchIndex } = useSongs({
    autoFetch: false,
    stateKey: songsCatalogKey,
  })
  const {
    activeAudioKey,
    activeSong,
    duration,
    isActiveAudioPlaying,
    clearSongText,
    metadataQuery,
    resetState,
    selectedSongKey,
    selectedSongName,
    selectedSongText,
    songTextWordsCache,
    sortDirection,
    sortKey,
  } = useSongListViewState({
    stateKeyPrefix,
    audioStorageKey,
  })

  const toggleSort = (key: SortKey) => {
    if (sortKey.value === key) {
      sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc"
      return
    }
    sortKey.value = key
    sortDirection.value = "asc"
  }

  const filteredSongs = computed(() => {
    const source = songs.value
    if (!source.length) {
      return []
    }

    const query = metadataQuery.value.trim().toLowerCase()
    if (!query) {
      return source
    }

    return source.filter((song) => {
      const cachedEntry = searchIndex.value[song.key]
      const haystack =
        cachedEntry?.metadata ??
        [
          song.title,
          song.artist,
          song.year == null ? "" : String(song.year),
          song.genre ?? "",
          song.language ?? "",
        ]
          .join(" ")
          .toLowerCase()

      return haystack.includes(query)
    })
  })

  const sortedSongs = computed(() => {
    const source = filteredSongs.value
    if (!source.length) {
      return []
    }

    const direction = sortDirection.value === "asc" ? 1 : -1

    return [...source].sort((left, right) => {
      const leftValue = left[sortKey.value]
      const rightValue = right[sortKey.value]

      if (leftValue == null && rightValue == null) {
        return 0
      }
      if (leftValue == null) {
        return 1
      }
      if (rightValue == null) {
        return -1
      }

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * direction
      }

      return (
        String(leftValue).localeCompare(String(rightValue), undefined, {
          numeric: true,
          sensitivity: "base",
        }) * direction
      )
    })
  })

  const getSongKey = (song: SongListRow) => song.key

  const getSongRowId = (song: SongListRow) =>
    `song-row-${encodeURIComponent(getSongKey(song))}`

  const toggleSongText = async (song: SongListRow) => {
    const key = getSongKey(song)
    if (selectedSongKey.value === key) {
      clearSongText()
      return
    }

    selectedSongKey.value = key
    selectedSongName.value = `${song.artist} - ${song.title}`

    const cached = songTextWordsCache.value[key]
    if (cached) {
      selectedSongText.value =
        cached.join(" ").trim() || "No song text available."
      return
    }

    selectedSongText.value = "Loading…"

    try {
      const words = await $fetch<string[]>(
        `/api/song-text?songKey=${encodeURIComponent(key)}`,
      )
      songTextWordsCache.value = {
        ...songTextWordsCache.value,
        [key]: words,
      }
      selectedSongText.value =
        words.join(" ").trim() || "No song text available."
    } catch {
      selectedSongText.value = "Could not load song text."
    }
  }

  const {
    activeCoverUrl,
    currentTimeLabel,
    durationLabel,
    getAudioFile,
    playerTime,
    progressPercent,
    scrollToActiveSong,
    stopActiveAudio,
    toggleAudioPlayback,
  } = useSongListAudioPlayback({
    audioStorageKey,
    getSongKey,
    getSongRowId,
  })

  watch(
    songs,
    (list) => {
      if (!process.client) {
        return
      }
      const key = activeAudioKey.value
      if (!key) {
        return
      }
      const found = list.find((s) => s.key === key)
      if (found) {
        activeSong.value = found
      }
    },
    { deep: true },
  )

  return {
    activeAudioKey,
    activeCoverUrl,
    activeSong,
    clearSongText,
    currentTimeLabel,
    duration,
    durationLabel,
    getAudioFile,
    getSongKey,
    getSongRowId,
    isActiveAudioPlaying,
    metadataQuery,
    playerTime,
    progressPercent,
    resetState,
    scrollToActiveSong,
    selectedSongKey,
    selectedSongName,
    selectedSongText,
    sortDirection,
    sortKey,
    sortedSongs,
    stopActiveAudio,
    toggleAudioPlayback,
    toggleSongText,
    toggleSort,
  }
}
