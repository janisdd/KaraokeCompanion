# Karaoke Search

![logo](public/logo.png)

A little helper for UltraStar karaoke sessions.


## Install

```bash
yarn install
```

you have to copy the `.env_example` to `.env` and set all values

- `ULTRA_START_SONGS_DIR_PATH` is the path to the ultrastar songs dir (no nesting)
- `PLAYLIST_CACHE_DIR_PATH` the path for caching playlists (only required when using spotify features)
	- gets automatically created (recursively)
- `IS_DEFAULT_PAGE_THEME_MODE_DARK` `true` or `false`, the page has a dark mode, if `true`, the dark mode is initially used (on first load)


you have to copy the `secrets/.env_example` to `secrets/.env` and set all values

for the spotify stuff you need a account and a spotify app, see https://developer.spotify.com/documentation/web-api/tutorials/getting-started


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

Almost every line was generated with cursor


## Notes

The songtext search does not always work because we only have the syllables...
We concatenate all syllables to get words again but this also gives some false positives

Also the table views try to display the hit in context in the preview column if possible (a real word in the syllables matched)
