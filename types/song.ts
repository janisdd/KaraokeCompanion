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
	songText: string | ''
}