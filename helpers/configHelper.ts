import dotenv from 'dotenv'
import fs from "fs";

//NOTE: log-start-env must be run before this, else the process.env variables are not set

dotenv.config({ path: "./secrets/.env" });
if (!fs.existsSync("./secrets/.env")) {
  throw createError({ statusCode: 500, message: "Secrets file not found" });
}

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";

const PlaylistCacheDirPath = process.env.PLAYLIST_CACHE_DIR_PATH || "";

if (!PlaylistCacheDirPath) {
  throw createError({ statusCode: 500, message: "Playlist cache directory not set" });
}

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.warn("Spotify Client ID or Client Secret not set -> spotify api will not work");
}

export class ConfigHelper {
  static getPlaylistCacheDirPath() {

    // check if the path exists
    if (!fs.existsSync(PlaylistCacheDirPath)) {
      fs.mkdirSync(PlaylistCacheDirPath, { recursive: true });
      console.log("Playlist cache directory created", PlaylistCacheDirPath);
    }

    return PlaylistCacheDirPath;
  }

  static getClientId() {
    return SPOTIFY_CLIENT_ID;
  }

  static getClientSecret() {
    return SPOTIFY_CLIENT_SECRET;
  }
}