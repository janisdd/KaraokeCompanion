import type { GridApi } from "ag-grid-community";
import type { SongInfo } from "~~/types/song";
import { useSongAudioPlayback } from "~~/composables/useSongAudioPlayback";

type SongListAudioOptions = {
  audioStorageKey: string;
  getSongKey: (song: SongInfo) => string;
  getSongRowId: (song: SongInfo) => string;
};

type ScrollToGridSongOptions<TRow> = {
  gridApi: GridApi<TRow> | null | undefined;
  songKey: string | null | undefined;
  getRowSongKey: (row: TRow) => string | null | undefined;
};

export const scrollToGridSong = <TRow>(options: ScrollToGridSongOptions<TRow>) => {
  const { gridApi, songKey, getRowSongKey } = options;
  if (!process.client || !gridApi || !songKey) {
    return;
  }

  let targetRowIndex: number | null = null;

  gridApi.forEachNodeAfterFilterAndSort((node) => {
    if (targetRowIndex !== null || !node.data || node.rowIndex == null) {
      return;
    }

    if (getRowSongKey(node.data) === songKey) {
      targetRowIndex = node.rowIndex;
    }
  });

  if (targetRowIndex !== null) {
    gridApi.ensureIndexVisible(targetRowIndex, "middle");
    requestAnimationFrame(() => {
      const targetRow = document.querySelector<HTMLElement>(
        `.ag-row[row-index="${targetRowIndex}"]`,
      );
      targetRow?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
};

export const useSongListAudioPlayback = (options: SongListAudioOptions) => {
  const { audioStorageKey, getSongKey, getSongRowId } = options;

  const getAudioFile = (song: SongInfo) => {
    const songKey = song.key?.trim()
    if (!songKey) {
      return null
    }
    // `v` ties the URL to the indexed file name so the media element refetches when
    // the server resolves a different file for the same songKey (reindex / redownload).
    const file = song.audioFileName?.trim() ?? ""
    const v = encodeURIComponent(file)
    return `/api/song-audio?songKey=${encodeURIComponent(songKey)}&v=${v}`
  }

  const getCoverFile = (song: SongInfo) => {
    const songKey = song.key?.trim()
    if (!songKey) {
      return null
    }
    return `/api/song-cover?songKey=${encodeURIComponent(songKey)}`
  }

  const {
    activeAudioKey,
    activeSong,
    isActiveAudioPlaying,
    currentTime,
    duration,
    seekTo,
    stopActiveAudio,
    toggleAudioPlayback,
  } = useSongAudioPlayback({
    storageKey: audioStorageKey,
    getSongKey,
    getAudioFile,
  });

  const activeCoverUrl = computed(() =>
    activeSong.value && activeSong.value.coverFileName ? getCoverFile(activeSong.value) : null,
  );

  const playerTime = computed({
    get: () => currentTime.value,
    set: (value) => {
      seekTo(Number(value));
    },
  });

  const formatTime = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) {
      return "0:00";
    }
    const totalSeconds = Math.floor(value);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const currentTimeLabel = computed(() => formatTime(currentTime.value));
  const durationLabel = computed(() => formatTime(duration.value));
  const progressPercent = computed(() => {
    if (!duration.value) {
      return 0;
    }
    return Math.min(100, Math.max(0, (currentTime.value / duration.value) * 100));
  });

  const scrollToActiveSong = () => {
    if (!process.client || !activeSong.value) {
      return;
    }
    const target = document.getElementById(getSongRowId(activeSong.value));
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return {
    activeAudioKey,
    activeCoverUrl,
    activeSong,
    currentTimeLabel,
    duration,
    durationLabel,
    getAudioFile,
    isActiveAudioPlaying,
    playerTime,
    progressPercent,
    scrollToActiveSong,
    stopActiveAudio,
    toggleAudioPlayback,
  };
};
