import type { SongInfo } from "~~/types/song"
import fs from "fs"
import path from "path"
import * as chardet from "chardet"

export class Indexer {
	private static directoryCache = new Map<string, { hash: string; songs: SongInfo[] }>()

	private static computeHash(value: string): string {
		let hash = 0
		for (let i = 0; i < value.length; i++) {
			hash = (hash * 31 + value.charCodeAt(i)) | 0
		}
		return hash.toString(16)
	}

	private static normalizeEncoding(encoding: string | null): BufferEncoding {
		if (!encoding) return "utf8"
		const normalized = encoding.toLowerCase()
		const map: Record<string, BufferEncoding> = {
			"utf-8": "utf8",
			"utf8": "utf8",
			"utf-16le": "utf16le",
			"utf16le": "utf16le",
			"iso-8859-1": "latin1",
			"windows-1252": "latin1",
			"latin1": "latin1",
			"ascii": "ascii",
		}
		return map[normalized] ?? "utf8"
	}

	private static decodeBuffer(buffer: Buffer, encodingLabel: string | null): string {
		const normalized = encodingLabel?.toLowerCase()
		if (normalized === "utf-16be" || normalized === "utf16be") {
			const swapped = Buffer.allocUnsafe(buffer.length)
			for (let i = 0; i < buffer.length; i += 2) {
				if (i + 1 < buffer.length) {
					swapped[i] = buffer[i + 1]
					swapped[i + 1] = buffer[i]
				} else {
					swapped[i] = buffer[i]
				}
			}
			return swapped.toString("utf16le")
		}
		return buffer.toString(Indexer.normalizeEncoding(encodingLabel))
	}

	/**
	 * Index all files in the given directory and return a list of song infos
	 * a song itself is a directory with the following files with at least one .txt file
	 * @param directory the directory with all songs
	 * @returns a list of song infos
	 */
	async indexFilesInDirectory(directory: string): Promise<SongInfo[]> {
		console.time("indexFilesInDirectory")
		const entries = await fs.promises.readdir(directory, { withFileTypes: true })
		const songDirectories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
		songDirectories.sort()
		const directoryHash = Indexer.computeHash(songDirectories.join("|"))
		const cached = Indexer.directoryCache.get(directory)
		if (cached && cached.hash === directoryHash) {
			console.log("Using cached songs");
			console.timeEnd("indexFilesInDirectory")
			return cached.songs
		}
		
		const songInfos = await Promise.all(
			songDirectories.map((songDirectory) => this.indexFile(path.join(directory, songDirectory))),
		)
		const songs = songInfos.filter((songInfo): songInfo is SongInfo => Boolean(songInfo))
		Indexer.directoryCache.set(directory, { hash: directoryHash, songs })
		console.timeEnd("indexFilesInDirectory")
		return songs
	}

	/**
	 * Index a single song and return the song info
	 * @param songDirectory the directory with the song
	 * @returns the song info or null if the song is not found
	 */
	async indexFile(songDirectory: string): Promise<SongInfo | null> {

		const txtFiles = (await fs.promises.readdir(songDirectory)).filter((file: string) => file.endsWith(".txt"))
		if (txtFiles.length === 0) {
			return null
		}
		let selectedPath = path.join(songDirectory, txtFiles[0])
		let selectedContent: string | null = null
		let selectedEncoding: string | null = null

		let wasEncodingChanged = false

		if (txtFiles.length > 1) {
			console.log(`Found ${txtFiles.length} txt files for song: ${songDirectory}`)

			for (const txtFile of txtFiles) {
				const candidatePath = path.join(songDirectory, txtFile)
				const candidateBuffer = await fs.promises.readFile(candidatePath)
				let candidateEncoding = chardet.detect(candidateBuffer)
				if (candidateEncoding === "ISO-8859-9") {
					wasEncodingChanged = true
					candidateEncoding = "ISO-8859-1"
				}
				const candidateContent = Indexer.decodeBuffer(candidateBuffer, candidateEncoding)
				const candidateLineCount = candidateContent.split("\n").length
				if (candidateLineCount > 100) {
					selectedPath = candidatePath
					selectedContent = candidateContent
					selectedEncoding = candidateEncoding
					break
				}
				if (selectedContent === null) {
					selectedPath = candidatePath
					selectedContent = candidateContent
					selectedEncoding = candidateEncoding
				}
			}
		}

		if (selectedContent === null) {
			const songInfoBuffer = await fs.promises.readFile(selectedPath)
			let detectedEncoding = chardet.detect(songInfoBuffer)
			if (detectedEncoding === "ISO-8859-9") {
				wasEncodingChanged = true
				detectedEncoding = "ISO-8859-1"
			}
			selectedEncoding = detectedEncoding
			selectedContent = Indexer.decodeBuffer(songInfoBuffer, detectedEncoding)
		}

		if (wasEncodingChanged) {
			console.log(`Detected encoding is ISO-8859-9, changing to ISO-8859-1 for song: ${songDirectory}`)
		}

		const songInfoFile = selectedContent
		// read all lines
		const lines = songInfoFile.split("\n")

		const songInfo: SongInfo = {
			title: "",
			artist: "",
			year: null,
			creator: null,
			genre: null,
			language: null,
			audioFile: null,
			videoFile: null,
			coverFile: null,
			songTextAsWords: [],
			songText: "",
		}

		for (const line of lines) {
			const lineLower = line.toLowerCase().trim()

			if (lineLower.startsWith("#artist:")) {
				songInfo.artist = line.split(":")[1].trim()
			}

			if (lineLower.startsWith("#title:")) {
				songInfo.title = line.split(":")[1].trim()
			}
			
			if (lineLower.startsWith("#year:")) {
				const yearPart = line.split(":")[1]?.trim()
				const parsed = yearPart ? parseInt(yearPart, 10) : NaN
				songInfo.year = Number.isNaN(parsed) ? null : parsed
			}
			if (lineLower.startsWith("#creator:")) {
				songInfo.creator = line.split(":")[1].trim()
			}
			if (lineLower.startsWith("#genre:")) {
				songInfo.genre = line.split(":")[1].trim()
			}
			if (lineLower.startsWith("#language:")) {
				songInfo.language = line.split(":")[1].trim()
			}
			if (lineLower.startsWith("#mp3:")) {
				songInfo.audioFile = line.split(":")[1].trim()
			}
			if (lineLower.startsWith("#video:")) {
				songInfo.videoFile = line.split(":")[1].trim()
			}
			if (lineLower.startsWith("#cover:")) {
				songInfo.coverFile = line.split(":")[1].trim()
			}

			// this is part of the song text
			//e.g." : 40 1 -1 Komm, "
			if (!lineLower.startsWith("#")) {
				const lineParts = line.split(" ")
				// we can have different types of lines
				// there are special lines e.g. "E" or "P1" or "P2" which we ignore
				// all lines are in the format: NoteType StartBeat Length Pitch Text
				// : 10 10 10 Text
				// - StartBeat
				// * 0 1 8 Golden
				// F 0 1 8 Freestyle
				// R 0 1 8 Rap
				// G 0 1 8 RapGolden
				if (lineParts.length < 4) continue
				if (lineParts[0] === "E" || lineParts[0] === "P1" || lineParts[0] === "P2") continue
				// const noteType = lineParts[0]
				// const startBeat = parseInt(lineParts[1])
				// const length = parseInt(lineParts[2])
				// const pitch = parseInt(lineParts[3])
				const text = lineParts.slice(4).join(" ").trim()
				//remove all ~ characters
				const textWithoutTildes = text.replace(/~/g, "")
				songInfo.songText += textWithoutTildes
				songInfo.songTextAsWords.push(text)
			}

		}

		if (!songInfo.title || !songInfo.artist) {
			console.log(`Empty song title or artist for song: ${songDirectory}`)
		}

		return songInfo
	}

}