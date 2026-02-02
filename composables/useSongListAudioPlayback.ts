import type { SongInfo } from "~~/types/song";
import { useSongAudioPlayback } from "~~/composables/useSongAudioPlayback";

type SongListAudioOptions = {
  audioStorageKey: string;
  getSongKey: (song: SongInfo) => string;
  getSongRowId: (song: SongInfo) => string;
};

export const useSongListAudioPlayback = (options: SongListAudioOptions) => {
  const { audioStorageKey, getSongKey, getSongRowId } = options;

  const getAudioFile = (song: SongInfo) => {
    const songId = song.id?.trim();
    if (!songId) {
      return null;
    }
    return `/api/song-audio?id=${encodeURIComponent(songId)}`;
  };

  const getCoverFile = (song: SongInfo) => {
    const songId = song.id?.trim();
    if (!songId) {
      return null;
    }
    return `/api/song-cover?id=${encodeURIComponent(songId)}`;
  };

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
    activeSong.value ? getCoverFile(activeSong.value) : null,
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
