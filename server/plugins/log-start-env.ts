import { config as loadEnv } from 'dotenv'
import { Indexer } from '~/helpers/songsIndexer'


export default defineNitroPlugin(async () => {
  loadEnv()
  console.log(
    '[nuxt start] ULTRA_START_SONGS_DIR_PATH:',
    process.env.ULTRA_START_SONGS_DIR_PATH,
  )
  console.log(
    '[nuxt start] PLAYLIST_CACHE_DIR_PATH:',
    process.env.PLAYLIST_CACHE_DIR_PATH,
  )
  console.log(
    '[nuxt start] IS_DEFAULT_PAGE_THEME_MODE_DARK:',
    process.env.IS_DEFAULT_PAGE_THEME_MODE_DARK,
  )

  if (!process.env.ULTRA_START_SONGS_DIR_PATH) {
    console.error('[nuxt start] ULTRA_START_SONGS_DIR_PATH is not set');
    return;
  }

  try {
    await Indexer.indexFilesInDirectory(process.env.ULTRA_START_SONGS_DIR_PATH);
    console.log('[nuxt start] Songs indexed successfully');
  } catch (error) {
    console.error('[nuxt start] Error indexing songs:', error instanceof Error ? error.message : String(error));
  }
})
