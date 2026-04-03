import fs from "fs"
import path from "path"
import type { SongInfo } from "~~/types/song"
import { SongsIndexer } from "./songsIndexer"

export type SongFilePresenceResult = {
  songKey: string
  songFound: boolean
  audioFile: boolean
  videoFile: boolean
  coverFile: boolean
}

export class SongFileHelper {
  /**
   * Paths from song metadata are relative to the song directory (or absolute).
   */
  static resolveSongFilePath(
    songRoot: string,
    songDirName: string,
    filePath: string | null,
  ): string | null {
    const trimmed = filePath?.trim() ?? ""
    if (!trimmed) return null
    if (path.isAbsolute(trimmed)) {
      return path.resolve(trimmed)
    }
    const songDirPath = path.resolve(path.join(songRoot, songDirName))
    const normalized = trimmed.replace(/\\/g, "/")
    const resolvedPath = path.resolve(songDirPath, normalized)
    if (
      resolvedPath !== songDirPath &&
      !resolvedPath.startsWith(songDirPath + path.sep)
    ) {
      return null
    }
    return resolvedPath
  }

  private static fileExists(absolutePath: string | null): boolean {
    if (!absolutePath) return false
    return fs.existsSync(absolutePath)
  }

  /**
   * Resolves paths from `SongsIndexer` data and checks whether audio, video, and cover files exist on disk.
   */
  static getFilePresence(songKey: string): SongFilePresenceResult {
    const song = SongsIndexer.getSongsMap().get(songKey) ?? null
    const songRoot = SongsIndexer.getSongRootMap().get(songKey) ?? null

    if (!song || !songRoot) {
      return {
        songKey,
        songFound: false,
        audioFile: false,
        videoFile: false,
        coverFile: false,
      }
    }

    const audioPath = SongFileHelper.resolveSongFilePath(
      songRoot,
      song.songDirName,
      song.audioFileName,
    )
    const coverPath = SongFileHelper.resolveSongFilePath(
      songRoot,
      song.songDirName,
      song.coverFileName,
    )
    const videoPath = SongFileHelper.resolveSongFilePath(
      songRoot,
      song.songDirName,
      song.videoFileName,
    )

    return {
      songKey,
      songFound: true,
      audioFile: SongFileHelper.fileExists(audioPath),
      videoFile: SongFileHelper.fileExists(videoPath),
      coverFile: SongFileHelper.fileExists(coverPath),
    }
  }
}
