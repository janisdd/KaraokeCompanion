import type { SongInfo } from "~~/types/song";
import { useSongListAudioPlayback } from "~~/composables/useSongListAudioPlayback";
import { useSongs } from "~~/composables/useSongs";

type SortKey = "title" | "artist" | "year" | "genre" | "language";
type SortDirection = "asc" | "desc";
type SearchMode = "metadata" | "lyrics";

type SongListViewOptions = {
  songs: Ref<SongInfo[]>;
  stateKeyPrefix: string;
  audioStorageKey: string;
};

export const useSongListView = (options: SongListViewOptions) => {
  const { songs, stateKeyPrefix, audioStorageKey } = options;
  const { searchIndex } = useSongs();

  const sortKey = useState<SortKey>(`${stateKeyPrefix}-sort-key`, () => "title");
  const sortDirection = useState<SortDirection>(
    `${stateKeyPrefix}-sort-direction`,
    () => "asc",
  );
  const searchMode = useState<SearchMode>(
    `${stateKeyPrefix}-search-mode`,
    () => "metadata",
  );
  const metadataQuery = useState(`${stateKeyPrefix}-metadata-query`, () => "");
  const lyricsQuery = useState(`${stateKeyPrefix}-lyrics-query`, () => "");
  const selectedSongKey = useState<string | null>(
    `${stateKeyPrefix}-selected-key`,
    () => null,
  );
  const selectedSongText = useState<string | null>(
    `${stateKeyPrefix}-selected-text`,
    () => null,
  );
  const selectedSongName = useState<string | null>(
    `${stateKeyPrefix}-selected-name`,
    () => null,
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey.value === key) {
      sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
      return;
    }
    sortKey.value = key;
    sortDirection.value = "asc";
  };

  const filteredSongs = computed(() => {
    const source = songs.value;
    if (!source.length) {
      return [];
    }

    const query =
      searchMode.value === "lyrics"
        ? lyricsQuery.value.trim().toLowerCase()
        : metadataQuery.value.trim().toLowerCase();
    if (!query) {
      return source;
    }

    return source.filter((song) => {
      const cachedEntry = searchIndex.value[song.id];
      const haystack =
        searchMode.value === "lyrics"
          ? cachedEntry?.lyrics ??
            (song.songText ?? song.songTextAsWords.join(" ")).toLowerCase()
          : cachedEntry?.metadata ??
            [
              song.title,
              song.artist,
              song.year == null ? "" : String(song.year),
              song.genre ?? "",
              song.language ?? "",
            ]
              .join(" ")
              .toLowerCase();

      return haystack.includes(query);
    });
  });

  const sortedSongs = computed(() => {
    const source = filteredSongs.value;
    if (!source.length) {
      return [];
    }

    const direction = sortDirection.value === "asc" ? 1 : -1;

    return [...source].sort((left, right) => {
      const leftValue = left[sortKey.value];
      const rightValue = right[sortKey.value];

      if (leftValue == null && rightValue == null) {
        return 0;
      }
      if (leftValue == null) {
        return 1;
      }
      if (rightValue == null) {
        return -1;
      }

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * direction;
      }

      return (
        String(leftValue).localeCompare(String(rightValue), undefined, {
          numeric: true,
          sensitivity: "base",
        }) * direction
      );
    });
  });

  const getSongKey = (song: SongInfo) => song.id;

  const getSongRowId = (song: SongInfo) =>
    `song-row-${encodeURIComponent(getSongKey(song))}`;

  const getSongText = (song: SongInfo) =>
    song.songTextAsWords?.join(" ").trim() || "";

  const getLyricsPreview = (song: SongInfo, query: string) => {
    const text = getSongText(song);
    const trimmedQuery = query.trim();
    if (!text || !trimmedQuery) {
      return "";
    }

    const lowerText = text.toLowerCase();
    const lowerQuery = trimmedQuery.toLowerCase();
    const matchIndex = lowerText.indexOf(lowerQuery);
    if (matchIndex === -1) {
      return "";
    }

    const context = 15;
    const start = Math.max(0, matchIndex - context);
    const end = Math.min(text.length, matchIndex + trimmedQuery.length + context);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < text.length ? "…" : "";

    return `${prefix}${text.slice(start, end)}${suffix}`;
  };

  const getSongTextPreview = (song: SongInfo) => {
    if (searchMode.value === "lyrics") {
      const preview = getLyricsPreview(song, lyricsQuery.value);
      if (preview) {
        return preview;
      }
    }

    const words = song.songTextAsWords?.slice(0, 5).join(" ");
    if (words) {
      return `${words}...`;
    }

    const fallbackText = song.songText
      ? song.songText.split(/\s+/).slice(0, 5).join(" ")
      : "";

    return fallbackText ? `${fallbackText}...` : "—";
  };

  const toggleSongText = (song: SongInfo) => {
    const key = getSongKey(song);
    if (selectedSongKey.value === key) {
      selectedSongKey.value = null;
      selectedSongText.value = null;
      return;
    }

    selectedSongKey.value = key;
    selectedSongName.value = `${song.artist} - ${song.title}`;
    selectedSongText.value = getSongText(song) || "No song text available.";
  };

  const clearSongText = () => {
    selectedSongKey.value = null;
    selectedSongText.value = null;
    selectedSongName.value = null;
  };

  const {
    activeAudioKey,
    activeSong,
    isActiveAudioPlaying,
    duration,
    stopActiveAudio,
    toggleAudioPlayback,
    activeCoverUrl,
    currentTimeLabel,
    durationLabel,
    getAudioFile,
    playerTime,
    progressPercent,
    scrollToActiveSong,
  } = useSongListAudioPlayback({
    audioStorageKey,
    getSongKey,
    getSongRowId,
  });

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
    getSongTextPreview,
    isActiveAudioPlaying,
    lyricsQuery,
    metadataQuery,
    playerTime,
    progressPercent,
    scrollToActiveSong,
    searchMode,
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
  };
};
