import type { OnlineSongInfo } from "~/helpers/allOnlineSongsIndexer";

export type ExistingStatus = "no" | "indexed" | "downloading" | "waitingForRefresh";

export type DownloadStatusTone = "success" | "warning";

export type DownloadableOnlineSong = Pick<
  OnlineSongInfo,
  "key" | "songId" | "songName" | "artist"
>;

export type OnlineSongsIndexResponse = {
  success: boolean;
  data: OnlineSongInfo[];
};

export type OnlineSongsDownloadResponse = {
  ok: boolean;
  count: number;
  reindexRequested: boolean;
  reindexError: string | null;
};
