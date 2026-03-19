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

- `ULTRA_START_SONGS_DIR_PATH1` is the path to the ultrastar songs dir (no nesting)
	- you can use `ULTRA_START_SONGS_DIR_PATH2`, `ULTRA_START_SONGS_DIR_PATH3`, ... to use multiple dirs
- `PLAYLIST_CACHE_DIR_PATH` the path for caching playlists (only required when using spotify features)
	- gets automatically created (recursively)
- `IS_DEFAULT_PAGE_THEME_MODE_DARK` `true` or `false`, the page has a dark mode, if `true`, the dark mode is initially used (on first load)


you have to copy the `secrets/.env_example` to `secrets/.env` and set all values

for the spotify stuff you need a account and a spotify app, see https://developer.spotify.com/documentation/web-api/tutorials/getting-started


when you want the download features

```bash
yarn playwright install chromium
```

you also need to install `yt-dlp` (https://github.com/ytdl-org/youtube-dl) (for downloading videos)

see https://formulae.brew.sh/formula/yt-dlp (for macos)

```bash
brew install yt-dlp
```

make sure it is in your path (if you type `yt-dlp` in the terminal and it works, it is in your path)

you also need to install `ffmpeg` (https://ffmpeg.org/) (for splitting videos)

see https://formulae.brew.sh/formula/ffmpeg (for macos)

```bash
brew install ffmpeg
```

make sure it is in your path (if you type `ffmpeg` in the terminal and it works, it is in your path)

## Dev

```bash
yarn dev
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

- download if no mp4  are available?
- add instructions for ffmpeg and yt-dlp for windows
- somehow make the songs searchable
- add re-indexing to UltraStar (hot reload)