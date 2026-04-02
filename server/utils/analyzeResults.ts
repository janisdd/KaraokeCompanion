import path from "path"
import type { AnalyzeHelper } from "~/helperPrograms/analyzeHelpers/analyzeInterface"
import { knownAnalyzeHelpers } from "~/helperPrograms/knownHelpers"
import { SongsIndexer } from "~/helpers/songsIndexer"
import type {
  AnalyzeResultKey,
  AnalyzeResultsMap,
  AnalyzeResultsSongEntry,
} from "~/types/analyzeResults"

function createEmptyAnalyzeResults(): AnalyzeResultsMap {
  return {
    analyzeLoudness: undefined,
  }
}

function getAnalyzeHelperResult(
  helper: AnalyzeHelper,
  songKey: string,
  songDirName: string,
): Partial<AnalyzeResultsMap> | null {
  const songRoot = SongsIndexer.getSongRootMap().get(songKey)
  if (!songRoot) {
    return null
  }

  const songDirPath = path.join(songRoot, songDirName)
  switch (helper.analyzerKey) {
    case "analyzeLoudness":
      return {
        analyzeLoudness: helper.resultsMap.get(songDirPath),
      }
    default:
      return null
  }
}

export function getAnalyzeHelperByKey(analyzerKey: AnalyzeResultKey) {
  return knownAnalyzeHelpers.find((helper) => helper.analyzerKey === analyzerKey)
}

export function getAnalyzeResultsForSong(songKey: string): AnalyzeResultsSongEntry | null {
  const song = SongsIndexer.getSongsMap().get(songKey)
  if (!song?.audioFile) {
    return null
  }

  const results = createEmptyAnalyzeResults()

  for (const helper of knownAnalyzeHelpers) {
    const result = getAnalyzeHelperResult(helper, song.key, song.songDirName)
    if (!result) {
      continue
    }

    const analyzerKey = helper.analyzerKey as keyof AnalyzeResultsMap
    results[analyzerKey] = result[analyzerKey]
  }

  return {
    songKey: song.key,
    songDirName: song.songDirName,
    results,
  }
}

export function getAllAnalyzeResults(): AnalyzeResultsSongEntry[] {
  const data: AnalyzeResultsSongEntry[] = []

  for (const song of SongsIndexer.getSongsMap().values()) {
    const result = getAnalyzeResultsForSong(song.key)
    if (!result) {
      continue
    }

    data.push(result)
  }

  return data
}
