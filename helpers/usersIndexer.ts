import { createHash } from "crypto"
import fs from "fs"
import path from "path"
import { z } from "zod"
import { ConfigHelper } from "./configHelper"
import { Logger } from "./logger"

const USER_FILE_NAME = "user.json"
const USER_VERSION = "1.0.0"
const logPrefix = "[UsersIndexer]"

export const userNameSchema = z
  .string()
  .min(1)
  .regex(/^[a-zA-Z0-9_-]+$/, "User name may only contain a-z, A-Z, 0-9, _ and -")

export const frontendUiThemeSchema = z.enum(["light", "dark"])

export const userSchema = z.object({
  version: z.string().min(1),
  name: userNameSchema,
  markedSongs: z.array(z.string()),
  theme: frontendUiThemeSchema,
})

export type User = z.infer<typeof userSchema>
export type UserWithDir = User & {
  userDirName: string
}
export type FrontendUiTheme = z.infer<typeof frontendUiThemeSchema>

export class UsersIndexer {
  private static usersMap: Map<User["name"], UserWithDir> = new Map()
  private static userDirNameByName: Map<User["name"], string> = new Map()

  public static createUser(
    name: string,
    theme: FrontendUiTheme,
    markedSongs: User["markedSongs"] = [],
    userDirName?: string,
  ): UserWithDir {
    const user = userSchema.parse({
      version: USER_VERSION,
      name,
      markedSongs,
      theme,
    })
    const resolvedUserDirName = userDirName ?? this.getCalculatedUserDirName(user.name)
    const userWithDir: UserWithDir = {
      ...user,
      userDirName: resolvedUserDirName,
    }
    const userDirPath = this.getUserDirPath(userWithDir.userDirName)
    const userFilePath = this.getUserFilePath(userWithDir.userDirName)

    if (fs.existsSync(userDirPath) || fs.existsSync(userFilePath)) {
      throw new Error(`User '${user.name}' already exists`)
    }

    fs.mkdirSync(userDirPath, { recursive: true })
    fs.writeFileSync(userFilePath, JSON.stringify(user, null, 2), "utf-8")
    this.userDirNameByName.set(user.name, userWithDir.userDirName)
    this.usersMap.set(user.name, userWithDir)

    Logger.log(`${logPrefix} Created user '${user.name}'`)

    return userWithDir
  }

  public static loadAllUsers(): Map<User["name"], UserWithDir> {
    const usersDir = this.getUsersDir()
    const nextUsersMap: Map<User["name"], UserWithDir> = new Map()
    const nextUserDirNameByName: Map<User["name"], string> = new Map()

    for (const entry of fs.readdirSync(usersDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue
      }

      const userFilePath = path.join(usersDir, entry.name, USER_FILE_NAME)
      if (!fs.existsSync(userFilePath)) {
        Logger.warn(`${logPrefix} Skipping '${entry.name}' because ${USER_FILE_NAME} is missing`)
        continue
      }

      try {
        const userJson = fs.readFileSync(userFilePath, "utf-8")
        const parsedJson = JSON.parse(userJson) as unknown
        const user = userSchema.parse(parsedJson)
        const userWithDir: UserWithDir = {
          ...user,
          userDirName: entry.name,
        }

        nextUserDirNameByName.set(user.name, entry.name)
        nextUsersMap.set(user.name, userWithDir)
      } catch (error) {
        Logger.warn(`${logPrefix} Failed to load user from '${userFilePath}': ${String(error)}`)
      }
    }

    this.usersMap = nextUsersMap
    this.userDirNameByName = nextUserDirNameByName
    Logger.log(`${logPrefix} Loaded ${this.usersMap.size} user(s)`)

    return this.usersMap
  }

  public static getUsersMap(): Map<User["name"], UserWithDir> {
    return this.usersMap
  }

  public static getAllUsers(): UserWithDir[] {
    return Array.from(this.usersMap.values())
  }

  public static hasUser(name: string): boolean {
    return this.usersMap.has(name)
  }

  public static getUser(name: string): UserWithDir | undefined {
    return this.usersMap.get(name)
  }

  public static updateUserTheme(name: string, theme: FrontendUiTheme): UserWithDir {
    const existing = this.usersMap.get(name)
    if (!existing) {
      throw new Error(`User '${name}' not found`)
    }

    const { userDirName, ...rest } = existing
    const updated = userSchema.parse({
      ...rest,
      theme,
    })
    const userFilePath = this.getUserFilePath(userDirName)

    fs.writeFileSync(userFilePath, JSON.stringify(updated, null, 2), "utf-8")

    const userWithDir: UserWithDir = {
      ...updated,
      userDirName,
    }
    this.usersMap.set(name, userWithDir)
    Logger.log(`${logPrefix} Updated theme for user '${name}' to '${theme}'`)

    return userWithDir
  }

  public static updateUserMarkedSongs(name: string, markedSongs: User["markedSongs"]): UserWithDir {
    const existing = this.usersMap.get(name)
    if (!existing) {
      throw new Error(`User '${name}' not found`)
    }

    const { userDirName, ...rest } = existing
    const updated = userSchema.parse({
      ...rest,
      markedSongs,
    })
    const userFilePath = this.getUserFilePath(userDirName)

    fs.writeFileSync(userFilePath, JSON.stringify(updated, null, 2), "utf-8")

    const userWithDir: UserWithDir = {
      ...updated,
      userDirName,
    }
    this.usersMap.set(name, userWithDir)
    Logger.log(`${logPrefix} Updated marked songs for user '${name}' (${markedSongs.length} song(s))`)

    return userWithDir
  }

  private static getUsersDir(): string {
    const usersDir = ConfigHelper.getUsersDir()

    if (!fs.existsSync(usersDir)) {
      fs.mkdirSync(usersDir, { recursive: true })
      Logger.log(`${logPrefix} Users directory created: ${usersDir}`)
    }

    return usersDir
  }

  private static getUserDirPath(userDirName: string): string {
    return path.join(this.getUsersDir(), userDirName)
  }

  private static getUserFilePath(userDirName: string): string {
    return path.join(this.getUserDirPath(userDirName), USER_FILE_NAME)
  }

  private static getCalculatedUserDirName(name: User["name"]): string {
    const cachedUserDirName = this.userDirNameByName.get(name)
    if (cachedUserDirName) {
      return cachedUserDirName
    }

    const userDirName = createHash("md5").update(name).digest("hex")
    this.userDirNameByName.set(name, userDirName)

    return userDirName
  }
}
