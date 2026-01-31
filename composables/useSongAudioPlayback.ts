import type { SongInfo } from "~~/types/song";

type AudioPlaybackOptions = {
  storageKey: string;
  getSongKey: (song: SongInfo) => string;
  getAudioFile: (song: SongInfo) => string | null;
};

export const useSongAudioPlayback = (options: AudioPlaybackOptions) => {
  const activeAudio = ref<HTMLAudioElement | null>(null);
  const activeAudioKey = useState<string | null>(
    `${options.storageKey}-active-audio-key`,
    () => null,
  );
  const isActiveAudioPlaying = useState<boolean>(
    `${options.storageKey}-active-audio-playing`,
    () => false,
  );

  const stopActiveAudio = () => {
    if (activeAudio.value) {
      activeAudio.value.pause();
      activeAudio.value.currentTime = 0;
      activeAudio.value = null;
    }
    activeAudioKey.value = null;
    isActiveAudioPlaying.value = false;
  };

  const toggleAudioPlayback = (song: SongInfo) => {
    const audioFile = options.getAudioFile(song);
    if (!audioFile) {
      return;
    }

    const key = options.getSongKey(song);
    if (activeAudioKey.value === key && activeAudio.value) {
      if (activeAudio.value.paused) {
        void activeAudio.value.play();
        isActiveAudioPlaying.value = true;
      } else {
        activeAudio.value.pause();
        isActiveAudioPlaying.value = false;
      }
      return;
    }

    stopActiveAudio();

    const audio = new Audio();
    audio.preload = "none";
    audio.src = audioFile;
    activeAudio.value = audio;
    activeAudioKey.value = key;
    isActiveAudioPlaying.value = true;

    audio.addEventListener("ended", () => {
      if (activeAudioKey.value === key) {
        isActiveAudioPlaying.value = false;
        activeAudioKey.value = null;
        activeAudio.value = null;
      }
    });

    void audio.play();
  };

  onBeforeUnmount(() => {
    stopActiveAudio();
  });

  onBeforeRouteLeave(() => {
    stopActiveAudio();
  });

  return {
    activeAudioKey,
    isActiveAudioPlaying,
    stopActiveAudio,
    toggleAudioPlayback,
  };
};
