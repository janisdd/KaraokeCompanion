export class SongKeyHelper {
	  // key is "artist - songid" because this is what should be unique and never change
		public static getKey(artist: string, songName: string): string {
			// this makes things easier and prevents case sensitive issues (e.g. online has different casing than local)
			return `${artist}-${songName}`.toLowerCase();
		}
}