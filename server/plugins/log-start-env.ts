import { config as loadEnv } from 'dotenv'
import { Indexer } from '~/helpers/songsIndexer'


export default defineNitroPlugin(async () => {
  loadEnv()
  const songsDirKeys = Object.keys(process.env)
    .filter((key) => /^ULTRA_START_SONGS_DIR_PATH\d+$/.test(key))
    .sort((a, b) => {
      const aNum = Number(a.replace('ULTRA_START_SONGS_DIR_PATH', ''))
      const bNum = Number(b.replace('ULTRA_START_SONGS_DIR_PATH', ''))
      return aNum - bNum
    })
  const songsDirPaths = songsDirKeys
    .map((key) => process.env[key])
    .filter((value): value is string => Boolean(value))

  if (songsDirPaths.length > 0) {
    console.log(`[nuxt start] found the following song dirs for ULTRA_START_SONGS_DIR_PATH*:`);
    for (const dirPath of songsDirPaths) {
      console.log(`[nuxt start] - ${dirPath}`);
    }
  } else {
    console.log(`[nuxt start] no song dirs found for ULTRA_START_SONGS_DIR_PATH*`);
  }
  console.log(`[nuxt start] PLAYLIST_CACHE_DIR_PATH: ${process.env.PLAYLIST_CACHE_DIR_PATH}`);
  console.log(`[nuxt start] IS_DEFAULT_PAGE_THEME_MODE_DARK: ${process.env.IS_DEFAULT_PAGE_THEME_MODE_DARK}`);

  if (songsDirPaths.length === 0) {
    console.error('[nuxt start] ULTRA_START_SONGS_DIR_PATH* is not set');
    return;
  }

  try {
    for (const dirPath of songsDirPaths) {
      await Indexer.indexFilesInDirectory(dirPath);
      console.log('[nuxt start] Songs indexed successfully for', dirPath);
    }
  } catch (error) {
    console.error('[nuxt start] Error indexing songs:', error instanceof Error ? error.message : String(error));
  }
})
