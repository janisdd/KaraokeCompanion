import type { SongInfo } from "~~/types/song";

type SongSearchEntry = {
  metadata: string;
  lyrics: string;
};

const normalizeSearchText = (value: string | null | undefined) =>
  value ? value.trim().toLowerCase() : "";

const buildSearchIndex = (songs: SongInfo[]) => {
  const index: Record<string, SongSearchEntry> = {};
  for (const song of songs) {
    const metadata = [
      song.title,
      song.artist,
      song.year == null ? "" : String(song.year),
      song.genre ?? "",
      song.language ?? "",
    ]
      .join(" ")
      .toLowerCase();

    const lyricsSource =
      song.songText ?? song.songTextAsWords?.join(" ") ?? "";

    index[song.id] = {
      metadata,
      lyrics: normalizeSearchText(lyricsSource),
    };
  }

  return index;
};

export const useSongs = () => {
  const songs = useState<SongInfo[]>("songs", () => []);
  const pending = useState<boolean>("songs-pending", () => false);
  const error = useState<Error | null>("songs-error", () => null);
  const searchIndex = useState<Record<string, SongSearchEntry>>(
    "songs-search-index",
    () => ({}),
  );

  const refresh = async () => {
    if (pending.value) {
      return;
    }

    pending.value = true;
    error.value = null;

    try {
      songs.value = await $fetch<SongInfo[]>("/api/songs");
    } catch (err) {
      error.value = err as Error;
    } finally {
      pending.value = false;
    }
  };

  watch(
    songs,
    (value) => {
      searchIndex.value = buildSearchIndex(value);
    },
    { immediate: true },
  );

  if (process.client && songs.value.length === 0 && !pending.value) {
    void refresh();
  }

  return {
    songs,
    pending,
    error,
    refresh,
    searchIndex,
  };
};
