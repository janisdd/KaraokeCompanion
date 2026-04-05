export type SongInfo = {
	// normally "artist-title" (@see SongKeyHelper)
	key: string
	songDirName: string
  title: string
  artist: string
  year: number | null
	creator: string | null
	genre: string | null
	language: string | null
	// these are just file names, not paths!!
	audioFileName: string | null
	videoFileName: string | null
	coverFileName: string | null
	songTextAsWords: string[]
}

/** Song metadata from `/api/songsFast` (lyrics loaded separately via `/api/song-text`). */
export type SongInfoCatalog = Omit<SongInfo, "songTextAsWords">

/** Grid/list row: catalog song, optionally with inline `songTextAsWords` (e.g. intersect pages). */
export type SongListRow = SongInfoCatalog & { songTextAsWords?: string[] }