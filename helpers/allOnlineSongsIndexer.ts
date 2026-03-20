import { ConfigHelper } from "./configHelper";
import * as htmlParser from "node-html-parser";
import { Logger } from "./logger";
import fs from "fs";


const ONLINE_SONGS_INDEX_JSON_FILE_NAME = "online_songs_index.json";

export type OnlineSongInfo = {
  //this is just artist-songname (to make it unique and never change)
  key: string;
  // we can create the href from the id: ?link=detail&id=<songId>
  songId: string; 
  songName: string;
  artist: string;
};

type ArtistLetterToIndexPage = {
  text: string;
  href: string;
};

// we need the version in case we need to change the structure of the index object
type OnlineSongInfoIndexObj = {
  version: string;
  index: OnlineSongInfo[];
}


export class AllOnlineSongsIndexer {
  private static _allOnlineSongInfos: Map<
    OnlineSongInfo["key"],
    OnlineSongInfo
  > = new Map();

  public static getAllOnlineSongInfos(): OnlineSongInfo[] {
    return Array.from(this._allOnlineSongInfos.values());
  }

  public static saveIndexToFile() {
    const indexObj: OnlineSongInfoIndexObj = {
      version: "1.0.0",
      index: this.getAllOnlineSongInfos(),
    };
    const indexJson = JSON.stringify(
      indexObj,
      null,
      2,
    );
    fs.writeFileSync(ONLINE_SONGS_INDEX_JSON_FILE_NAME, indexJson);
  }

  public static loadIndexFromFile() {
    const indexJson = fs.readFileSync(ONLINE_SONGS_INDEX_JSON_FILE_NAME, "utf8");
    const indexObj = JSON.parse(indexJson) as OnlineSongInfoIndexObj;
    if (indexObj.version !== "1.0.0") {
      throw new Error(`Invalid index version: ${indexObj.version}`);
    }
    const index = indexObj.index;
    for (const songInfo of index) {
      this._allOnlineSongInfos.set(songInfo.key, songInfo);
    }
  }

  public static checkIfIndexExists() {
    return fs.existsSync(ONLINE_SONGS_INDEX_JSON_FILE_NAME);
  }

  // key is "artist - songid" because this is what should be unique and never change
  private static getKey(artist: string, songName: string): string {
    return `${artist}-${songName}`;
  }

  public static async indexAllOnlineSongs() {
    if (this.checkIfIndexExists()) {
      Logger.log(
        `[AllOnlineSongsIndexer] Index already exists, loading from file ${ONLINE_SONGS_INDEX_JSON_FILE_NAME}`,
      );
      this.loadIndexFromFile();
      return;
    }

    Logger.log(`[AllOnlineSongsIndexer] Indexing all online songs`);

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
        this._allOnlineSongInfos.set(onlineSongInfo.key, onlineSongInfo);
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
    const onlineSongInfos: OnlineSongInfo[] = [];
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

      const songInfo: OnlineSongInfo = {
        key: this.getKey(artistName, songName),
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
  return typeof value === "object" && value !== null && "key" in value && "songId" in value && "songName" in value && "artist" in value;
};