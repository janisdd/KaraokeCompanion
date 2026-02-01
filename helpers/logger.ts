// DEBUG includes all
// INFO includes info, warn, error
// WARN includes warn, error
// ERROR includes error
export enum LogLevelEnum {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private static logLevel: LogLevelEnum = LogLevelEnum.DEBUG;

  static setLogLevel(logLevel: LogLevelEnum) {
    this.logLevel = logLevel;
  }

	static debug(message: string) {
    if (this.logLevel > LogLevelEnum.DEBUG) return;
    console.log(`[DEBUG] ${message}`);
  }

  static log(message: string) {
		if (this.logLevel > LogLevelEnum.INFO) return;
    console.log(`[INFO] ${message}`);
  }

  static warn(message: string) {
		if (this.logLevel > LogLevelEnum.WARN) return;
    console.warn(`[WARN] ${message}`);
  }

  static error(message: string) {
		if (this.logLevel > LogLevelEnum.ERROR) return;
    console.error(`[ERROR] ${message}`);
  }
}