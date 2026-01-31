const STORAGE_KEY = "karaoke-marked-songs";

const normalizeKeys = (keys: string[]) =>
  Array.from(new Set(keys.map((key) => key.trim()).filter(Boolean)));

export const useMarkedSongs = () => {
  const markedSongKeys = useState<string[]>("marked-songs", () => []);
  const hasHydrated = useState<boolean>("marked-songs-hydrated", () => false);

  const setMarkedSongKeys = (keys: string[]) => {
    markedSongKeys.value = normalizeKeys(keys);
  };

  const isMarkedSong = (key: string) => markedSongKeys.value.includes(key);

  const toggleMarkedSong = (key: string) => {
    if (isMarkedSong(key)) {
      markedSongKeys.value = markedSongKeys.value.filter(
        (songKey) => songKey !== key,
      );
      return;
    }

    markedSongKeys.value = normalizeKeys([...markedSongKeys.value, key]);
  };

  const unmarkAllSongs = () => {
    markedSongKeys.value = [];
  };

  onMounted(() => {
    if (!process.client || hasHydrated.value) {
      return;
    }

    const storedKeys = localStorage.getItem(STORAGE_KEY);
    if (storedKeys && markedSongKeys.value.length === 0) {
      try {
        const parsed = JSON.parse(storedKeys);
        if (Array.isArray(parsed)) {
          setMarkedSongKeys(parsed.map(String));
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    hasHydrated.value = true;
  });

  watch(
    markedSongKeys,
    (value) => {
      if (!process.client || !hasHydrated.value) {
        return;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    },
    { deep: true },
  );

  return {
    markedSongKeys,
    isMarkedSong,
    toggleMarkedSong,
    unmarkAllSongs,
    setMarkedSongKeys,
  };
};
