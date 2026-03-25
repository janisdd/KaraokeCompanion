export type OnlineSongsDownloadResponse = {
  ok: boolean;
  count: number;
  reindexRequested: boolean;
  reindexError: string | null;
};
