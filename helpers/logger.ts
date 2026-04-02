// DEBUG includes all
// INFO includes info, warn, error
// WARN includes warn, error
// ERROR includes error
export const LogLevels = {
  DEBUG: "DEBUG",
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
} as const

export type LogLevel = (typeof LogLevels)[keyof typeof LogLevels]

const logLevelPriority: Record<LogLevel, number> = {
  [LogLevels.DEBUG]: 0,
  [LogLevels.INFO]: 1,
  [LogLevels.WARN]: 2,
  [LogLevels.ERROR]: 3,
}

export function parseLogLevel(logLevel?: string): LogLevel | undefined {
  if (!logLevel) {
    return undefined
  }

  return Object.values(LogLevels).find((value) => value === logLevel)
}

export class Logger {
  private static logLevel: LogLevel = LogLevels.DEBUG

  static setLogLevel(logLevel: LogLevel) {
    this.logLevel = logLevel
  }

	static debug(message: string) {
    if (logLevelPriority[this.logLevel] > logLevelPriority[LogLevels.DEBUG]) return
    console.log(`[DEBUG] ${message}`)
  }

  static log(message: string) {
		if (logLevelPriority[this.logLevel] > logLevelPriority[LogLevels.INFO]) return
    console.log(`[INFO] ${message}`)
  }

  static warn(message: string) {
		if (logLevelPriority[this.logLevel] > logLevelPriority[LogLevels.WARN]) return
    console.warn(`[WARN] ${message}`)
  }

  static error(message: string) {
		if (logLevelPriority[this.logLevel] > logLevelPriority[LogLevels.ERROR]) return
    console.error(`[ERROR] ${message}`)
  }
}