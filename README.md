# Karaoke Companion

![logo](public/logo.png)

A little helper for UltraStar karaoke sessions.

## Requirements

- nodejs (20.x or later)
- yarn


## Install

```bash
yarn install
```

you have to copy the `.env_example` to `.env` and set all values

- `ALL_FILES_PREFIX_DIR` is the root directory for app data. `USERS_DIR`, `REDOWNLOAD_SONGS_TRASH_DIR`, `DOWNLOAD_SONGS_DIR`, `PLAYLIST_CACHE_DIR_PATH`, and `ONLINE_SONGS_INDEX_NAME` must each be a **relative** path under that root (no absolute paths; `..` is not allowed to escape the storage root).
- `ULTRA_START_SONGS_DIR_PATH1` is the path to the ultrastar songs dir (no nesting)
	- you can use `ULTRA_START_SONGS_DIR_PATH2`, `ULTRA_START_SONGS_DIR_PATH3`, ... to use multiple dirs
- `PLAYLIST_CACHE_DIR_PATH` the path for caching playlists (only required when using spotify features)
	- relative values are resolved under `ALL_FILES_PREFIX_DIR`; gets automatically created (recursively)
- `IS_DEFAULT_PAGE_THEME_MODE_DARK` `true` or `false`, the page has a dark mode, if `true`, the dark mode is initially used (on first load)

if you want to use the download feature, you also need to set `ULTRA_START_SONGS_DIR_PATH2` (or `3`, ...) to the path where the downloaded songs will be stored (of course you need to add the directory to the UltraStar config too!)

the path for the downloaded songs is set with `DOWNLOAD_SONGS_DIR` (relative paths are under `ALL_FILES_PREFIX_DIR`). `ULTRA_START_SONGS_DIR_PATH2` must point at that same folder on disk.

example:

```bash
ULTRA_START_SONGS_DIR_PATH1=/path/to/songs/dir1
ULTRA_START_SONGS_DIR_PATH2=storage_dir/download_work
ALL_FILES_PREFIX_DIR=storage_dir
DOWNLOAD_SONGS_DIR=download_work
```

With defaults, downloads live at `storage_dir/download_work` relative to the project root.

Because the download dir will be reindexed after some donwloads, you should copy the songs from this dir to some other UltraStar songs dir. *because reindexing is not optimally implemented yet (it does a fill reindexing and not check if the song already exists)*


you have to copy the `secrets/.env_example` to `secrets/.env` and set all values

for the spotify stuff you need a account and a spotify app, see https://developer.spotify.com/documentation/web-api/tutorials/getting-started

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

## Indexing

Indexing is only done on startup

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