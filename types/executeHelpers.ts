import type { ChangeRelativeLoudnessParams } from "~/helperPrograms/executeHelpers/changeRelativeLoudness/changeRelativeLoudness"

export type RunChangeRelativeLoudnessRequest = {
  songKey: string
  params: ChangeRelativeLoudnessParams
}

export type RunMatchLoudnessTwoPassByTargetRequest = {
  songKey: string
  params: {
    targetLufsI: number
  }
}

export type RunExecuteResponse = {
  success: boolean
}
