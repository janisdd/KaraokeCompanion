import type { SongInfo } from "~~/types/song";
import fs from "fs";
import path from "path";
import * as chardet from "chardet";
import { Logger } from "./logger";
import { SongKeyHelper } from "./songKeyHelper";

export class SongsIndexer {
  // key is songKey, value is song info
  private static _songsMap = new Map<string, SongInfo>();
  // key is songKey, value is root directory path of the song (where all songs are located)
  private static _songRootMap = new Map<string, string>();

  private static _indexingFinished = false;

  // Full reindex builds here first; live maps stay unchanged until commitStagingIndex()
  private static _stagingMode = false;
  private static _stagingSongsMap: Map<string, SongInfo> | null = null;
  private static _stagingSongRootMap: Map<string, string> | null = null;

  public static isIndexingFinished(): boolean {
    return this._indexingFinished;
  }

  /** Start building a replacement index without touching the live maps */
  public static beginStagingIndex(): void {
    if (this._stagingMode) {
      throw new Error("SongsIndexer staging index already in progress");
    }
    this._stagingSongsMap = new Map();
    this._stagingSongRootMap = new Map();
    this._stagingMode = true;
  }

  /** Atomically publish the staged index as the live index */
  public static commitStagingIndex(): void {
    if (
      !this._stagingMode ||
      !this._stagingSongsMap ||
      !this._stagingSongRootMap
    ) {
      throw new Error("SongsIndexer commitStagingIndex with no active staging index");
    }
    this._songsMap = this._stagingSongsMap;
    this._songRootMap = this._stagingSongRootMap;
    this._stagingSongsMap = null;
    this._stagingSongRootMap = null;
    this._stagingMode = false;
    this._indexingFinished = true;
  }

  /** Drop a partial staged index after a failed rebuild; live maps unchanged */
  public static discardStagingIndex(): void {
    this._stagingSongsMap = null;
    this._stagingSongRootMap = null;
    this._stagingMode = false;
  }

  private static activeSongsMap(): Map<string, SongInfo> {
    return this._stagingMode && this._stagingSongsMap
      ? this._stagingSongsMap
      : this._songsMap;
  }

  private static activeSongRootMap(): Map<string, string> {
    return this._stagingMode && this._stagingSongRootMap
      ? this._stagingSongRootMap
      : this._songRootMap;
  }

  private static normalizeEncoding(encoding: string | null): BufferEncoding {
    if (!encoding) return "utf8";
    const normalized = encoding.toLowerCase();
    const map: Record<string, BufferEncoding> = {
      "utf-8": "utf8",
      utf8: "utf8",
      "utf-16le": "utf16le",
      utf16le: "utf16le",
      "iso-8859-1": "latin1",
      "windows-1252": "latin1",
      latin1: "latin1",
      ascii: "ascii",
    };
    return map[normalized] ?? "utf8";
  }

  private static decodeBuffer(
    buffer: Buffer,
    encodingLabel: string | null,
  ): string {
    const normalized = encodingLabel?.toLowerCase();
    if (normalized === "utf-16be" || normalized === "utf16be") {
      const swapped = Buffer.allocUnsafe(buffer.length);
      for (let i = 0; i < buffer.length; i += 2) {
        if (i + 1 < buffer.length) {
          swapped[i] = buffer[i + 1];
          swapped[i + 1] = buffer[i];
        } else {
          swapped[i] = buffer[i];
        }
      }
      return swapped.toString("utf16le");
    }
    return buffer.toString(SongsIndexer.normalizeEncoding(encodingLabel));
  }

  private static normalizeStoredFilePath(filePath: string): string {
    return filePath.replace(/\\/g, "/")
  }

  private static normalizeStoredFileName(fileName: string): string {
    const normalizedPath = SongsIndexer.normalizeStoredFilePath(fileName).trim()
    return path.posix.basename(normalizedPath)
  }

  /**
   * Index all files in the given directory and return a list of song infos
   * a song itself is a directory with the following files with at least one .txt file
   * @param songsDirectoryPath the directory with all songs
   * @returns a list of song infos
   */
  static async indexFilesInDirectory(
    songsDirectoryPath: string,
  ): Promise<void> {
    const timerName = `Indexed Songs In Directory: ${songsDirectoryPath}`;
    console.time(timerName);

    const entries = await fs.promises.readdir(songsDirectoryPath, {
      withFileTypes: true,
    });
    const songDirectories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    songDirectories.sort();

    const songEntries = await Promise.all(
      songDirectories.map(async (songDirectory, index) => ({
        songDirectory,
        songInfo: await SongsIndexer.indexSingleSongDir(
          songsDirectoryPath,
          path.join(songsDirectoryPath, songDirectory),
          index,
          songDirectories.length,
        ),
      })),
    );

    console.timeEnd(timerName);
    if (!this._stagingMode) {
      this._indexingFinished = true;
    }
  }

  static getSongsMap(): Map<string, SongInfo> {
    return SongsIndexer._songsMap;
  }

  static getSongRootMap(): Map<string, string> {
    return SongsIndexer._songRootMap;
  }

  static hasSong(songKey: string): boolean {
    return SongsIndexer._songRootMap.has(songKey);
  }

  /**
   * Index a single song and return the song info
   * @param songDirectoryPath the directory with the song (this includes the songs root directory path)
   * @returns the song info or null if the song is not found
   */
  public static async indexSingleSongDir(
    songsRootDirPath: string,
    songDirectoryPath: string,
    index: number,
    total: number,
  ): Promise<SongInfo | null> {
    Logger.debug(`Indexing song ${index + 1}/${total}: ${songDirectoryPath}`);

    const txtFiles = (await fs.promises.readdir(songDirectoryPath)).filter(
      (file: string) => file.endsWith(".txt"),
    );
    if (txtFiles.length === 0) {
      Logger.warn(`No txt files found for song dir: ${songDirectoryPath}`);
      return null;
    }
    let selectedPath = path.join(songDirectoryPath, txtFiles[0]);
    let selectedContent: string | null = null;
    let selectedEncoding: string | null = null;

    let wasEncodingChanged = false;

    if (txtFiles.length > 1) {
      Logger.debug(
        `Found ${txtFiles.length} txt files for song: ${songDirectoryPath}`,
      );

      for (const txtFile of txtFiles) {
        const candidatePath = path.join(songDirectoryPath, txtFile);
        const candidateBuffer = await fs.promises.readFile(candidatePath);
        let candidateEncoding = chardet.detect(candidateBuffer);
        if (candidateEncoding === "ISO-8859-9") {
          wasEncodingChanged = true;
          candidateEncoding = "ISO-8859-1";
        }
        const candidateContent = SongsIndexer.decodeBuffer(
          candidateBuffer,
          candidateEncoding,
        );
        const candidateLineCount = candidateContent.split("\n").length;
        if (candidateLineCount > 100) {
          selectedPath = candidatePath;
          selectedContent = candidateContent;
          selectedEncoding = candidateEncoding;
          break;
        }
        if (selectedContent === null) {
          selectedPath = candidatePath;
          selectedContent = candidateContent;
          selectedEncoding = candidateEncoding;
        }
      }
    }

    if (selectedContent === null) {
      const songInfoBuffer = await fs.promises.readFile(selectedPath);
      let detectedEncoding = chardet.detect(songInfoBuffer);
      if (detectedEncoding === "ISO-8859-9") {
        wasEncodingChanged = true;
        detectedEncoding = "ISO-8859-1";
      }
      selectedEncoding = detectedEncoding;
      selectedContent = SongsIndexer.decodeBuffer(
        songInfoBuffer,
        detectedEncoding,
      );
    }

    if (wasEncodingChanged) {
      Logger.debug(
        `Detected encoding is ISO-8859-9, changing to ISO-8859-1 for song: ${songDirectoryPath}`,
      );
    }

    const songInfoFile = selectedContent;
    // read all lines
    const lines = songInfoFile.split("\n");

    const songInfo: SongInfo = {
      key: "",
      songDirName: "",
      title: "",
      artist: "",
      year: null,
      creator: null,
      genre: null,
      language: null,
      audioFileName: null,
      videoFileName: null,
      coverFileName: null,
      songTextAsWords: [],
      songText: "",
    };

    for (const line of lines) {
      const lineLower = line.toLowerCase().trim();

      if (lineLower.startsWith("#artist:")) {
        songInfo.artist = line.split(":")[1].trim();
      }

      if (lineLower.startsWith("#title:")) {
        songInfo.title = line.split(":")[1].trim();
      }

      if (lineLower.startsWith("#year:")) {
        const yearPart = line.split(":")[1]?.trim();
        const parsed = yearPart ? parseInt(yearPart, 10) : NaN;
        songInfo.year = Number.isNaN(parsed) ? null : parsed;
      }
      if (lineLower.startsWith("#creator:")) {
        songInfo.creator = line.split(":")[1].trim();
      }
      if (lineLower.startsWith("#genre:")) {
        songInfo.genre = line.split(":")[1].trim();
      }
      if (lineLower.startsWith("#language:")) {
        songInfo.language = line.split(":")[1].trim();
      }
      if (lineLower.startsWith("#mp3:")) {
        const rawAudioFile = line.split(":")[1].trim();
        if (rawAudioFile) {
          songInfo.audioFileName = SongsIndexer.normalizeStoredFileName(rawAudioFile)
        }
      }
      if (lineLower.startsWith("#video:")) {
        const rawVideoFile = line.split(":")[1].trim();
        if (rawVideoFile) {
          songInfo.videoFileName = SongsIndexer.normalizeStoredFileName(rawVideoFile)
        }
      }
      if (lineLower.startsWith("#cover:")) {
        const rawCoverFile = line.split(":")[1].trim();
        if (rawCoverFile) {
          const resolvedCoverPath = path.isAbsolute(rawCoverFile)
            ? rawCoverFile
            : path.join(songDirectoryPath, rawCoverFile);
          try {
            await fs.promises.access(resolvedCoverPath);
            songInfo.coverFileName =
              SongsIndexer.normalizeStoredFileName(rawCoverFile)
          } catch {
            songInfo.coverFileName = null;
            Logger.warn(`Cover file not found for song: ${songDirectoryPath}`);
          }
        }
      }

      // this is part of the song text
      //e.g." : 40 1 -1 Komm, "
      if (!lineLower.startsWith("#")) {
        const lineParts = line.split(" ");
        // we can have different types of lines
        // there are special lines e.g. "E" or "P1" or "P2" which we ignore
        // all lines are in the format: NoteType StartBeat Length Pitch Text
        // : 10 10 10 Text
        // - StartBeat
        // * 0 1 8 Golden
        // F 0 1 8 Freestyle
        // R 0 1 8 Rap
        // G 0 1 8 RapGolden
        if (lineParts.length < 4) continue;
        if (
          lineParts[0] === "E" ||
          lineParts[0] === "P1" ||
          lineParts[0] === "P2"
        )
          continue;
        // const noteType = lineParts[0]
        // const startBeat = parseInt(lineParts[1])
        // const length = parseInt(lineParts[2])
        // const pitch = parseInt(lineParts[3])
        const text = lineParts.slice(4).join(" ").trim();
        //remove all ~ characters
        const textWithoutTildes = text.replace(/~/g, "");
        songInfo.songText += textWithoutTildes;
        songInfo.songTextAsWords.push(text);
      }
    }

    if (!songInfo.title || !songInfo.artist) {
      Logger.warn(`Empty song title or artist for song: ${songDirectoryPath}`);
    }

    songInfo.songDirName = path.basename(songDirectoryPath);

    songInfo.key = SongKeyHelper.getKey(songInfo.artist, songInfo.title);

    // add this here so we can call the function for a single song and everything works
    const songsMap = SongsIndexer.activeSongsMap();
    const songRootMap = SongsIndexer.activeSongRootMap();
    if (songsMap.has(songInfo.key)) {
      Logger.warn(
        `Duplicate song id "${songInfo.key}" skipping song directory: ${songDirectoryPath}`,
      );
      return null;
    }
    songsMap.set(songInfo.key, songInfo);
    songRootMap.set(songInfo.key, songsRootDirPath);

    return songInfo;
  }
}
