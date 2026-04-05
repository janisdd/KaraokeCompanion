import { ConfigHelper } from "./configHelper";
import * as htmlParser from "node-html-parser";
import { Logger } from "./logger";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { UsdbAnimuxHelper } from "./songsDownloader/UsdbAnimuxHelper";
import { SongKeyHelper } from "./songKeyHelper";
import { SongsIndexer } from "./songsIndexer";

/**
 * key: this is just artist-songname (to make it unique and never change)
 * songId: we can create the href from the id: ?link=detail&id=<songId>
 */
export const onlineSongInfoPlainSchema = z.object({
  key: z.string(),
  songId: z.string(),
  songName: z.string(),
  artist: z.string(),
});

export type OnlineSongInfoPlain = z.infer<typeof onlineSongInfoPlainSchema>;

/** Request bodies may omit `key` (derived from artist + songName). */
export const onlineSongInfoPlainPartialKeySchema =
  onlineSongInfoPlainSchema.partial({ key: true });

const cachedOnlineSongInfoSchema = onlineSongInfoPlainSchema.omit({ key: true });

type CachedOnlineSongInfo = z.infer<typeof cachedOnlineSongInfoSchema>;

// we need the version in case we need to change the structure of the index object
const onlineSongInfoIndexObjSchema = z.object({
  version: z.literal("1.0.0"),
  index: z.array(cachedOnlineSongInfoSchema),
});

type OnlineSongInfoIndexObj = z.infer<typeof onlineSongInfoIndexObjSchema>;

export type OnlineSongInfo = OnlineSongInfoPlain & {
  // true: when we created the lock file and we are to download the song
  // after the download is finished, this is still true!
  downloading: boolean;
  // true: after downloading the song, we indexed it -> after indexing this is true and the song
  // can be indexed by ultrastar
  indexed: boolean;
};

type ArtistLetterToIndexPage = {
  text: string;
  href: string;
};

export class AllOnlineSongsIndexer {
  private static _allOnlineSongInfosPlain: Map<
    OnlineSongInfoPlain["key"],
    OnlineSongInfoPlain
  > = new Map();

  private static _allOnlineSongInfos: Map<
    OnlineSongInfo["key"],
    OnlineSongInfo
  > | null = null;

  private static _onlineSongsIndexingFinished = false;

  public static isIndexingFinished(): boolean {
    return this._onlineSongsIndexingFinished;
  }

  public static getAllOnlineSongInfos(): OnlineSongInfo[] | null {
    if (!this._allOnlineSongInfos) {
      Logger.warn(
        `[AllOnlineSongsIndexer] All online song infos not set (call setSongsExistsOrWereAlreadyDownloaded first), returning null`,
      );
      return null;
    }
    return Array.from(this._allOnlineSongInfos.values());
  }

  public static hasPlainOnlineSongInfo(key: string): boolean {
    return this._allOnlineSongInfosPlain.has(key);
  }

  public static getPlainOnlineSongInfo(
    key: string,
  ): OnlineSongInfoPlain | undefined {
    return this._allOnlineSongInfosPlain.get(key);
  }

  // after downloading we want to add the song info to the index
  public static addSingOnlineSongInfoToIndex(songInfo: OnlineSongInfoPlain): void {
    if (!this._allOnlineSongInfos) {
      throw new Error("All online song infos not set");
    }
    // this will overwrite the existing song info if it exists and update the state!
    this._allOnlineSongInfosPlain.set(songInfo.key, songInfo);
    this._allOnlineSongInfos.set(songInfo.key, {
      ...songInfo,
      downloading: UsdbAnimuxHelper.isSongDownloadingOrDownloaded(songInfo.songId),
      indexed: SongsIndexer.hasSong(SongKeyHelper.getKey(songInfo.artist, songInfo.songName)),
    });
  }

  //song can be already downloaded or inside the ultrastar song dir...
  public static connectSongInfosWithExistingAndDownloadedSongs() {
    const hasExistingSongIdex = SongsIndexer.isIndexingFinished();
    const hasOnlineSongsIndex = this.isIndexingFinished();

    let existingOrAlreadyDownloaded: boolean = false;

    if (!hasOnlineSongsIndex) {
      Logger.warn(
        `[AllOnlineSongsIndexer] Online songs index is not ready yet, cannot connect song infos with existing and downloaded songs`,
      );
    }
    if (!hasExistingSongIdex) {
      Logger.warn(
        `[AllOnlineSongsIndexer] SongsIndexer was not finished indexing, cannot connect song infos with existing and downloaded songs`,
      );
    }

    if (!hasOnlineSongsIndex && !hasExistingSongIdex) {
      this._allOnlineSongInfos = null;
      return;
    }

    this._allOnlineSongInfos = new Map();

    // iterate over all online song infos plain
    for (const songInfo of this._allOnlineSongInfosPlain.values()) {
      const songId = songInfo.songId;
      const songDownloadingOrDownloaded =
        UsdbAnimuxHelper.isSongDownloadingOrDownloaded(songId);

      // existing songs is harder because they have no songId...
      //check for same artist and song name
      const songKey = SongKeyHelper.getKey(songInfo.artist, songInfo.songName);

      const songIndexed = SongsIndexer.hasSong(songKey);

      this._allOnlineSongInfos.set(songKey, {
        ...songInfo,
        downloading: songDownloadingOrDownloaded,
        indexed: songIndexed,
      });
    }

    Logger.log(`[AllOnlineSongsIndexer] Connected ${this._allOnlineSongInfos.size} song infos with existing and downloaded songs`);
  }

  public static saveIndexToFile() {
    // the real index should not contain the alreadyDownloaded (tmp) property
    // the tmp properties are already re-calculated on startup
    const plainIndex: CachedOnlineSongInfo[] = Array.from(
      this._allOnlineSongInfosPlain.values(),
    ).map(({ key: _key, ...songInfo }) => songInfo);

    const indexObj: OnlineSongInfoIndexObj = {
      version: "1.0.0",
      index: plainIndex,
    };
    const indexJson = JSON.stringify(indexObj, null, 2);
    const indexPath = ConfigHelper.getOnlineSongsIndexPath();
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(indexPath, indexJson);
    this._onlineSongsIndexingFinished = true;
  }

  public static loadIndexFromFile() {
    const indexPath = ConfigHelper.getOnlineSongsIndexPath();
    const indexJson = fs.readFileSync(indexPath, "utf8");
    const raw: unknown = JSON.parse(indexJson);
    if (
      raw !== null &&
      typeof raw === "object" &&
      "index" in raw &&
      Array.isArray((raw as { index: unknown }).index)
    ) {
      const rows = (raw as { index: unknown[] }).index;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (
          row !== null &&
          typeof row === "object" &&
          Object.prototype.hasOwnProperty.call(row, "key")
        ) {
          throw new Error(
            `Legacy online songs index: at least one entry (index ${i}) still has a stored "key" field. Delete the index file and run a full online songs re-index to recreate it. Path: ${indexPath}`,
          );
        }
      }
    }
    const parsed = onlineSongInfoIndexObjSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Invalid online songs index file: ${parsed.error.message}`,
      );
    }
    const index = parsed.data.index;
    for (const songInfo of index) {
      const songInfoWithKey: OnlineSongInfoPlain = {
        ...songInfo,
        key: SongKeyHelper.getKey(songInfo.artist, songInfo.songName),
      };
      this._allOnlineSongInfosPlain.set(songInfoWithKey.key, songInfoWithKey);
    }

    Logger.log(`[AllOnlineSongsIndexer] Loaded ${this._allOnlineSongInfosPlain.size} online song infos from file ${indexPath}`);
    this._onlineSongsIndexingFinished = true;
  }

  public static checkIfIndexExists() {
    return fs.existsSync(ConfigHelper.getOnlineSongsIndexPath());
  }

  public static async indexAllOnlineSongs() {
    if (this.checkIfIndexExists()) {
      Logger.log(
        `[AllOnlineSongsIndexer] Online Songs Index already exists, loading from file ${ConfigHelper.getOnlineSongsIndexPath()}`,
      );
      this.loadIndexFromFile();
      return;
    }

    Logger.log(`[AllOnlineSongsIndexer] Indexing all online songs`);
    this._onlineSongsIndexingFinished = false;

    // this returns a html page
    const allSongsByArtistPage = ConfigHelper.getAllSongsByArtistPage();

    // on this page we get all songs with
    // document.querySelectorAll(`#tablebg h1 a`)
    // the text content e.g. A (list of all songs with artists that start with A)
    // the href is the page url with the songs of all artists that start with A

    const response = await fetch(allSongsByArtistPage);
    const html = await response.text();
    const root = htmlParser.parse(html);
    const songAnchorTags = root.querySelectorAll(`#tablebg h1 a`);

    // use for loop and skip songs where href is undefined
    const artistLetterToIndexPages: ArtistLetterToIndexPage[] = [];
    for (const songAnchorTag of songAnchorTags) {
      const songAnchorTagText = songAnchorTag.text;
      const songAnchorTagHref = songAnchorTag.getAttribute("href");
      if (!songAnchorTagHref) {
        Logger.warn(
          `Song anchor tag href not found for artist letter: ${songAnchorTagText}`,
        );
        continue;
      }
      artistLetterToIndexPages.push({
        text: songAnchorTagText,
        href: songAnchorTagHref,
      });
    }

    Logger.log(
      `[AllOnlineSongsIndexer] Found ${artistLetterToIndexPages.length} artist letter to index pages`,
    );
    for (const artistLetterToIndexPage of artistLetterToIndexPages) {
      Logger.debug(
        `[AllOnlineSongsIndexer] Artist letter to index page: ${artistLetterToIndexPage.text} - ${artistLetterToIndexPage.href}`,
      );
      const onlineSongInfos = await this.indexArtistLetter(
        artistLetterToIndexPage,
      );

      for (const onlineSongInfo of onlineSongInfos) {
        this._allOnlineSongInfosPlain.set(onlineSongInfo.key, onlineSongInfo);
      }

      //wait for 500ms
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    Logger.log(
      `[AllOnlineSongsIndexer] Indexing complete, saving index to file`,
    );
    this.saveIndexToFile();
  }

  private static async indexArtistLetter(
    artistLetterPageTuple: ArtistLetterToIndexPage,
  ) {
    const onlineSongInfos: OnlineSongInfoPlain[] = [];
    // this returns a html page

    Logger.debug(
      `[AllOnlineSongsIndexer] Indexing artist letter: ${artistLetterPageTuple.text} - ${artistLetterPageTuple.href}`,
    );
    const artistByLetterPageResponse = await fetch(
      `${ConfigHelper.getUsdbAnimuxUrl()}/${artistLetterPageTuple.href}`,
    );
    Logger.debug(
      `[AllOnlineSongsIndexer] Artist by letter page response: ${artistByLetterPageResponse.status} - ${artistByLetterPageResponse.statusText}`,
    );

    const artistByLetterPageHtml = await artistByLetterPageResponse.text();
    Logger.debug(`[AllOnlineSongsIndexer] Artist by letter page html loaded`);

    const artistByLetterPageRoot = htmlParser.parse(artistByLetterPageHtml);
    Logger.debug(`[AllOnlineSongsIndexer] Artist by letter page root parsed`);

    const divTagsWithArtistSongs = artistByLetterPageRoot.querySelectorAll(
      `#tablebg .row1 .details`,
    );

    const artistTmpIdToArtistName: Map<string, string> = new Map();
    // get all artist tmp ids
    for (const divTagWithArtistSong of divTagsWithArtistSongs) {
      // e.g. <div id="artist1" class="details" style="display: block;">...</div>
      const artistTmpId = divTagWithArtistSong.getAttribute("id");
      if (!artistTmpId) {
        continue;
      }

      // document.querySelectorAll(`#tablebg .row1 a[href='javascript:show("artist1")']`)
      const artistAnchor = artistByLetterPageRoot.querySelector(
        `#tablebg .row1 a[href='javascript:show("${artistTmpId}")']`,
      );
      const artistName = artistAnchor?.text;
      if (!artistName) {
        Logger.warn(
          `Artist name not found for artist tmp id: ${artistTmpId} in artist letter page: ${artistLetterPageTuple.text} - ${artistLetterPageTuple.href}`,
        );
        continue;
      }
      artistTmpIdToArtistName.set(artistTmpId, artistName);
    }

    // document.querySelectorAll(`#tablebg .row1 #artist1 a[href]`)
    // const artistSongAnchors = artistByLetterPageRoot.querySelectorAll(
    //   `#tablebg .row1 #${artistTmpId} a[href]`,
    // );

    // for whatever reason they choose to add the anchor tags with javascript...
    /*
      <script type="text/javascript">
      $("artist1").innerHTML += "<a target='_blank' href='?link=detail&id=9323'>Which Backstreet Boy Is Gay?</a> <br>";
      $("artist2").innerHTML += "<a target='_blank' href='?link=detail&id=26323'>Someone I Used To Know</a> <br>";
      ...
      </script>
      */
    const artistSongAnchorsScriptText =
      artistByLetterPageRoot
        .querySelectorAll(`script[type="text/javascript"]`)
        .at(3)?.textContent ?? "";

    if (!artistSongAnchorsScriptText) {
      throw new Error(
        `No artist song anchors script text found in artist letter page: ${artistLetterPageTuple.text} - ${artistLetterPageTuple.href}`,
      );
    }

    // go line by line
    const artistSongAnchorsScriptTextLines =
      artistSongAnchorsScriptText.split("\n");

    for (const artistSongAnchorScriptTextLine of artistSongAnchorsScriptTextLines) {
      // extract the artist id from the line
      const artistIdMatch =
        artistSongAnchorScriptTextLine.match(/\"artist(\d+)\"/);
      if (!artistIdMatch) {
        continue;
      }
      let artistId = artistIdMatch[1];
      if (artistId.trim() === "") {
        continue;
      }
      artistId = `artist${artistId}`;

      const artistName = artistTmpIdToArtistName.get(artistId);
      if (!artistName) {
        throw new Error(
          `Artist name not found for artist tmp id: ${artistId} in artist letter page: ${artistLetterPageTuple.text} - ${artistLetterPageTuple.href}`,
        );
      }
      if (artistName.trim() === "") {
        continue;
      }

      // then get the song id from the line
      const songIdMatch = artistSongAnchorScriptTextLine.match(/id=(\d+)/);
      if (!songIdMatch) {
        continue;
      }
      const songId = songIdMatch[1];
      if (songId.trim() === "") {
        continue;
      }

      // then get the song name from the line
      const songNameMatch = artistSongAnchorScriptTextLine.match(/>(.*?)<\/a>/);
      if (!songNameMatch) {
        continue;
      }
      const songName = songNameMatch[1];
      if (songName.trim() === "") {
        continue;
      }

      const songInfo: OnlineSongInfoPlain = {
        key: SongKeyHelper.getKey(artistName, songName),
        songId: songId,
        songName: songName,
        artist: artistName
      };
      onlineSongInfos.push(songInfo);

      Logger.debug(
        `[AllOnlineSongsIndexer] Song ${artistName} - ${songName} - ${songId}`,
      );
    }

    return onlineSongInfos;
  }
}

function isOnlineSongInfo(value: unknown): value is OnlineSongInfo {
  return (
    typeof value === "object" &&
    value !== null &&
    "key" in value &&
    "songId" in value &&
    "songName" in value &&
    "artist" in value
  );
}
