import { getAllAnalyzeResults } from "~/server/utils/analyzeResults"
import type { AnalyzeResultsResponse } from "~/types/analyzeResults"

export default defineEventHandler(() => {
  const response: AnalyzeResultsResponse = {
    success: true,
    data: getAllAnalyzeResults(),
  }

  return response
})
