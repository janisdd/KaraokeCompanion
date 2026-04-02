import { ConfigHelper } from "~/helpers/configHelper"

export type NormalLoudnessResponse = {
  success: boolean
  data: number
}

export default defineEventHandler(() => {
  const response: NormalLoudnessResponse = {
    success: true,
    data: ConfigHelper.getNormalLoudness(),
  }

  return response
})
