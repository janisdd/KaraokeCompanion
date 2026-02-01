export type SongInfo = {
	id: string
  title: string
  artist: string
  year: number | null
	creator: string | null
	genre: string | null
	language: string | null
	audioFile: string | null
	videoFile: string | null
	coverFile: string | null
	songTextAsWords: string[]
	songText: string | ''
}