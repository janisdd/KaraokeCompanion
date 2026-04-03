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

    index[song.key] = {
      metadata,
      lyrics: normalizeSearchText(lyricsSource),
    };
  }

  return index;
};

type UseSongsOptions = {
  /** When false, skip the client-side initial fetch (caller should call refresh when ready). */
  autoFetch?: boolean;
  /** Separate catalog state (e.g. admin page should not reuse public browse cache). */
  stateKey?: string;
};

export const useSongs = (options?: UseSongsOptions) => {
  const autoFetch = options?.autoFetch !== false;
  const sk = options?.stateKey;

  const songs = useState<SongInfo[]>(sk ? `songs-${sk}` : "songs", () => []);
  const pending = useState<boolean>(
    sk ? `songs-pending-${sk}` : "songs-pending",
    () => false,
  );
  const error = useState<Error | null>(
    sk ? `songs-error-${sk}` : "songs-error",
    () => null,
  );
  const searchIndex = useState<Record<string, SongSearchEntry>>(
    sk ? `songs-search-index-${sk}` : "songs-search-index",
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

  if (autoFetch && process.client && songs.value.length === 0 && !pending.value) {
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
