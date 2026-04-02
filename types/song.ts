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
	// the files are only relative to the songs directory (including the songs directory)
	audioFile: string | null
	videoFile: string | null
	coverFile: string | null
	songTextAsWords: string[]
	songText: string | ''
}