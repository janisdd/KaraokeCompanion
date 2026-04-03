import type { ExistingStatus, DownloadStatusTone, DownloadableOnlineSong, OnlineSongsDownloadResponse } from "~/types/onlineSongs";

type QueuedDownload<TSong extends DownloadableOnlineSong> = {
  song: TSong;
  overwriteExisting: boolean;
  status: "queued" | "downloading";
  controller?: AbortController;
};

type RefreshCallback = () => Promise<unknown> | unknown;

type DownloadQueueSong = DownloadableOnlineSong & { existingStatus: ExistingStatus };

type UseOnlineSongDownloadsOptions<TRow> = {
  getDownloadSong: (row: TRow) => DownloadQueueSong;
  refreshOnlineSongs: RefreshCallback;
  refreshExistingSongs: RefreshCallback;
};

const DEFAULT_MAX_QUEUED_DOWNLOADS = 5;

export const getExistingStatusLabel = (status: ExistingStatus) => {
  switch (status) {
    case "indexed":
      return "Indexed";
    case "downloading":
      return "Downloading";
    case "waitingForRefresh":
      return "Awaiting refresh";
    default:
      return "No";
  }
};

export const getExistingStatusClass = (status: ExistingStatus) => {
  switch (status) {
    case "indexed":
      return "inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
    case "downloading":
      return "inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
    case "waitingForRefresh":
      return "inline-flex rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800 dark:bg-sky-950/60 dark:text-sky-300";
    default:
      return "inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  }
};

export const resolveExistingStatus = (options: {
  hasExistingSong: boolean;
  backendIndexed: boolean;
  backendDownloading: boolean;
  songId: string;
  isDownloadingSong: (songId: string) => boolean;
  isWaitingForRefreshSong: (songId: string) => boolean;
}): ExistingStatus => {
  const {
    hasExistingSong,
    backendIndexed,
    backendDownloading,
    songId,
    isDownloadingSong,
    isWaitingForRefreshSong,
  } = options;

  if (hasExistingSong || backendIndexed) {
    return "indexed";
  }

  if (isWaitingForRefreshSong(songId)) {
    return "waitingForRefresh";
  }

  if (backendDownloading || isDownloadingSong(songId)) {
    return "downloading";
  }

  return "no";
};

export const useOnlineSongDownloads = <
  TRow,
>(
  options: UseOnlineSongDownloadsOptions<TRow>,
) => {
  const { getDownloadSong, refreshOnlineSongs, refreshExistingSongs } = options;
  const runtimeConfig = useRuntimeConfig();

  // Share the queue and transient status across pages so route changes do not
  // make another view lose track of songs that are downloading or awaiting refresh.
  const downloadError = useState<string | null>("online-song-download-error", () => null);
  const downloadStatusMessage = useState<string | null>(
    "online-song-download-status-message",
    () => null,
  );
  const downloadStatusTone = useState<DownloadStatusTone | null>(
    "online-song-download-status-tone",
    () => null,
  );
  const downloadQueue = useState<QueuedDownload<DownloadQueueSong>[]>(
    "online-song-download-queue",
    () => [],
  );
  const waitingForRefreshSongIds = useState<string[]>(
    "online-song-waiting-for-refresh-song-ids",
    () => [],
  );
  const completedDownloadCount = useState<number>(
    "online-song-completed-download-count",
    () => 0,
  );
  const isProcessingQueue = useState<boolean>(
    "online-song-download-is-processing-queue",
    () => false,
  );

  const queuedDownloadCount = computed(() => downloadQueue.value.length);
  const totalTrackedDownloads = computed(
    () => queuedDownloadCount.value + completedDownloadCount.value,
  );
  const isQueueFinished = computed(
    () =>
      completedDownloadCount.value > 0 &&
      queuedDownloadCount.value === 0 &&
      !isProcessingQueue.value,
  );
  const currentDownloadSongLabel = computed(() => {
    const activeItem =
      downloadQueue.value.find((item) => item.status === "downloading") ??
      downloadQueue.value.find((item) => item.status === "queued");

    if (!activeItem) {
      return null;
    }

    return `${activeItem.song.artist} - ${activeItem.song.songName}`;
  });

  const queueProgressPercent = computed(() => {
    if (!totalTrackedDownloads.value) {
      return 0;
    }

    return Math.round(
      (completedDownloadCount.value / totalTrackedDownloads.value) * 100,
    );
  });

  const maxQueuedDownloads = computed((): number => {
    const raw = runtimeConfig.public.maxDownloadQueueSizeFrontend;
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      return raw;
    }
    return DEFAULT_MAX_QUEUED_DOWNLOADS;
  });

  const isQueuedSong = (songId: string) =>
    downloadQueue.value.some((item) => item.song.songId === songId);

  const isDownloadingSong = (songId: string) =>
    downloadQueue.value.some(
      (item) => item.song.songId === songId && item.status === "downloading",
    );

  const isWaitingForRefreshSong = (songId: string) =>
    waitingForRefreshSongIds.value.includes(songId);

  const markSongAsWaitingForRefresh = (songId: string) => {
    if (waitingForRefreshSongIds.value.includes(songId)) {
      return;
    }

    waitingForRefreshSongIds.value = [...waitingForRefreshSongIds.value, songId];
  };

  const resetQueueProgressIfIdle = () => {
    if (!downloadQueue.value.length && !isProcessingQueue.value) {
      completedDownloadCount.value = 0;
      waitingForRefreshSongIds.value = [];
    }
  };

  const removeQueuedSong = (songId: string) => {
    downloadQueue.value = downloadQueue.value.filter(
      (item) => item.song.songId !== songId,
    );
  };

  const confirmOverwriteDownload = (
    song: DownloadableOnlineSong & { existingStatus: ExistingStatus },
  ) => {
    if (song.existingStatus === "no") {
      return true;
    }

    const existingLabel =
      song.existingStatus === "indexed"
        ? "already indexed locally"
        : "already downloading";

    if (!process.client) {
      return false;
    }

    return window.confirm(
      `${song.artist} - ${song.songName} is ${existingLabel}.\n\nDo you want to overwrite the existing song files?`,
    );
  };

  const processDownloadQueue = async () => {
    if (isProcessingQueue.value) {
      return;
    }

    const nextItem = downloadQueue.value.find((item) => item.status === "queued");
    if (!nextItem) {
      isProcessingQueue.value = false;
      return;
    }

    isProcessingQueue.value = true;
    nextItem.status = "downloading";
    const controller = new AbortController();
    nextItem.controller = controller;

    try {
      const response = await $fetch<OnlineSongsDownloadResponse>(
        "/api/onlineSongsDownload",
        {
          method: "POST",
          body: {
            songs: [nextItem.song],
            overwriteExisting: nextItem.overwriteExisting,
          },
          signal: controller.signal,
        },
      );
      completedDownloadCount.value += 1;
      markSongAsWaitingForRefresh(nextItem.song.songId);
      if (response.reindexError) {
        downloadStatusTone.value = "warning";
        downloadStatusMessage.value = `Downloaded ${nextItem.song.artist} - ${nextItem.song.songName}, but refreshing local songs failed: ${response.reindexError}`;
      } else {
        downloadStatusTone.value = "success";
        downloadStatusMessage.value = `Downloaded ${nextItem.song.artist} - ${nextItem.song.songName} and requested a local songs refresh.`;
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        downloadError.value =
          error?.data?.message ?? error?.message ?? "Failed to download song.";
        console.error("Failed to download online song", error);
      }
    } finally {
      removeQueuedSong(nextItem.song.songId);
      isProcessingQueue.value = false;
      if (downloadQueue.value.length) {
        void processDownloadQueue();
      } else if (completedDownloadCount.value > 0) {
        await Promise.all([refreshOnlineSongs(), refreshExistingSongs()]);
        waitingForRefreshSongIds.value = [];
      }
    }
  };

  const queueDownload = (row: TRow) => {
    const song = getDownloadSong(row);
    if (isQueuedSong(song.songId)) {
      return;
    }

    if (!downloadQueue.value.length) {
      completedDownloadCount.value = 0;
      waitingForRefreshSongIds.value = [];
      downloadStatusMessage.value = null;
      downloadStatusTone.value = null;
    }

    if (downloadQueue.value.length >= maxQueuedDownloads.value) {
      downloadError.value = `You can queue at most ${maxQueuedDownloads.value} downloads at a time.`;
      return;
    }

    const overwriteExisting = confirmOverwriteDownload(song);
    if (!overwriteExisting && song.existingStatus !== "no") {
      return;
    }

    downloadError.value = null;
    downloadQueue.value = [
      ...downloadQueue.value,
      { song, overwriteExisting, status: "queued" },
    ];
    void processDownloadQueue();
  };

  const cancelDownload = (song: DownloadableOnlineSong) => {
    const queuedItem = downloadQueue.value.find(
      (item) => item.song.songId === song.songId,
    );
    if (!queuedItem) {
      return;
    }

    if (queuedItem.status === "downloading") {
      queuedItem.controller?.abort();
    }

    removeQueuedSong(song.songId);
    resetQueueProgressIfIdle();
  };

  const closeQueuePanel = () => {
    if (!isQueueFinished.value) {
      return;
    }

    completedDownloadCount.value = 0;
    downloadError.value = null;
    downloadStatusMessage.value = null;
    downloadStatusTone.value = null;
  };

  return {
    cancelDownload,
    closeQueuePanel,
    completedDownloadCount,
    currentDownloadSongLabel,
    downloadError,
    downloadStatusMessage,
    downloadStatusTone,
    isDownloadingSong,
    isQueueFinished,
    isQueuedSong,
    isWaitingForRefreshSong,
    maxQueuedDownloads,
    queueDownload,
    queueProgressPercent,
    queuedDownloadCount,
    totalTrackedDownloads,
  };
};
