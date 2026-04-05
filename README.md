# Karaoke Companion

![logo](public/logo.png)

A little helper for UltraStar karaoke sessions.

## Requirements

- nodejs (22.x or later)
- yarn


## Install

```bash
yarn install
```

after that you need to create the public and secrets configuration, see [Public Configuration (.env)](#public-configuration-env) and [Secrets Configuration (secrets/.env)](#secrets-configuration-secretsenv)

for some advanced features you need to install some additional dependencies

advance features:

- download songs
  - playwright, yt-dlp (and ffmpeg)
	- you also need to set the config in a specific way for this
- match songs with spotify playlists
	- you also need to set the config in a specific way for this


### playwright

when you want the download features

```bash
yarn playwright install chromium
```

### yt-dlp

you also need to install `yt-dlp` (https://github.com/ytdl-org/youtube-dl) (for downloading videos)

see https://formulae.brew.sh/formula/yt-dlp (for macos)

```bash
brew install yt-dlp
```

for windows:

```bash
winget install -e --id yt-dlp.yt-dlp
```

make sure it is in your path (if you type `yt-dlp` in the terminal and it works, it is in your path)

### ffmpeg (normally part of yt-dlp)

this is normally part of yt-dlp, so you don't need to install it separately, check with

```bash
ffmpeg -version
```

to install `ffmpeg` (https://ffmpeg.org/) (for splitting videos)

see https://formulae.brew.sh/formula/ffmpeg (for macos)

```bash
brew install ffmpeg
```

for windows:

```bash
winget install -e --id Gyan.FFmpeg
```

make sure it is in your path (if you type `ffmpeg` in the terminal and it works, it is in your path)

## Dev

```bash
yarn dev
# or to host the server on your local network
yarn dev:host
```


## Build

```bash
yarn build
```

## Run server

```bash
node .output/server/index.mjs
```

## Public Configuration (.env)

for an example, see the `.env_example` file


you have to copy the `.env_example` to `.env` and set all values

### required settings

- `ULTRA_START_SONGS_DIR_PATH1` is the path to the ultrastar songs dir (no nesting)
	- you can use `ULTRA_START_SONGS_DIR_PATH2`, `ULTRA_START_SONGS_DIR_PATH3`, ... to use multiple dirs

if you want to use the download feature, you also need to set `ULTRA_START_SONGS_DIR_PATH2` (or `3`, ...) to the path where the downloaded songs will be stored (of course you need to add the directory to the UltraStar config too!)

the path for the downloaded songs is set with `DOWNLOAD_SONGS_DIR` (relative paths are under `ALL_FILES_PREFIX_DIR`). `ULTRA_START_SONGS_DIR_PATH2` must point at that same folder on disk.

in production, you also need to set `NUXT_SESSION_PASSWORD` to a random password (for example with `openssl rand -base64 32`), see https://nuxt.com/docs/4.x/guide/recipes/sessions-and-authentication


### optional settings

- `ALL_FILES_PREFIX_DIR` is the root directory for app data. `USERS_DIR`, `REDOWNLOAD_SONGS_TRASH_DIR`, `DOWNLOAD_SONGS_DIR`, `PLAYLIST_CACHE_DIR_PATH`, and `ONLINE_SONGS_INDEX_NAME` must each be a **relative** path under that root (no absolute paths; `..` is not allowed to escape the storage root).
- `PLAYLIST_CACHE_DIR_PATH` is the relative directory for Spotify playlist cache.
- `USERS_DIR` is the relative directory for per-user data.
- `REDOWNLOAD_SONGS_TRASH_DIR` is the relative directory for trashed redownload files.
- `DOWNLOAD_SONGS_DIR` is the relative directory where downloads are written; it must match the real folder used by the matching `ULTRA_START_SONGS_DIR_PATH*` entry.
- `ONLINE_SONGS_INDEX_NAME` is the optional relative path (under `ALL_FILES_PREFIX_DIR`) for the online songs index JSON file.
- `IS_DEFAULT_PAGE_THEME_MODE_DARK` when `true` makes the app default to dark theme.
- `ULTRASTAR_COMPANION_URL` is the base URL of the UltraStar companion HTTP API.
- `LOG_LEVEL` sets log verbosity for the app and helper processes.
- `REQUIRED_WAIT_TIME_FOR_SONG_DOWNLOAD` is the wait time in seconds around song download.
- `DOWNLOAD_PREFERRED_VIDEO_HEIGHT` is the preferred video height in pixels.
- `DOWNLOAD_PREFERRED_VIDEO_FORMAT` is the preferred download video container/format.
- `DOWNLOAD_CONVERT_AUDIO_FORMAT` is the audio format used when converting downloads.
- `ALL_SONGS_BY_ARTIST_PAGE` is the USDB Animux “by artist” listing URL.
- `DOWNLOAD_USE_HEADLESS_MODE` when `true` runs Playwright in headless mode for downloads.
- `MAX_DOWNLOAD_QUEUE_SIZE_FRONTEND` caps how many downloads the UI may queue at once.
- `NUM_ANALYZE_WORKERS` is the number of workers for analyze jobs.
- `ADMIN_PAGE_PW` is the password for the admin page.
- `NORMAL_LOUDNESS` is the loudness target in LUFS for audio processing.


It is adviced to change `ADMIN_PAGE_PW` to a better password...


## Secrets Configuration (secrets/.env)

for an example, see the `secrets/.env_example` file

you have to copy the `secrets/.env_example` to `secrets/.env` and set all values

for the spotify stuff you need a account and a spotify app, see https://developer.spotify.com/documentation/web-api/tutorials/getting-started

- `SPOTIFY_CLIENT_ID` is the Spotify client id
- `SPOTIFY_CLIENT_SECRET` is the Spotify client secret
- `USDB_ANIMUX_ID` is the usdb animux id
- `USDB_ANIMUX_PW` is the usdb animux password

for the usdb animux stuff you need a account and a usdb animux app, see https://usdb.animux.de


## Online index

On startup a index of all online songs is created (if not already done) (usdb)

The index is never updated automatically, so you need to remove the file `<ALL_FILES_PREFIX_DIR>/<ONLINE_SONGS_INDEX_NAME>` and restart the app to reindex all songs
(with default settings, this is `storage_dir/online_songs_index.json`)


## Helpers (optional)

There are some helpers in `helperPrograms` that are used to analyze songs (e.g. get loudness)

you can run them with `yarn helpers:run` to analyze all songs, the results are stored in each song directory
(this runs for a long time, e.g. a single song can take seconds)

there are som features that rely on the helpers, e.g. check which songs are too loud or too quiet (requires the song loudness)

however, on the admin page, you can run that analysis for a single song manually

## Admin Page

This is only designed to be used by one user at a time

All operations changing the underlying files (e.g. change audio file loudness) should only be done when the song is not currently used by usdx

## Indexing

Indexing local files is done on every startup

however, on the admin page, you can reindex all songs manually

this also reloads all analyze helper results

## Logo

generated with chatgpt


## Code

Almost every line was generated with cursor (and GPT-5.2 Codex, GPT-5.4)


## Notes

The songtext search does not always work because we only have the syllables...
We concatenate all syllables to get words again but this also gives some false positives

Also the table views try to display the hit in context in the preview column if possible (a real word in the syllables matched)

## Ag grid

- we use ag grid for virtualized scrolling without it the search is really slow...


## Sources for songs

- https://usdb.animux.de


## TODOs

- muatex for download songs
- download if no mp4  are available?
- cookie is never updated and expires after 6 hours