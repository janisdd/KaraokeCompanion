export class SongKeyHelper {
	  // key is "artist - songid" because this is what should be unique and never change
		public static getKey(artist: string, songName: string): string {
			return `${artist}-${songName}`;
		}
}