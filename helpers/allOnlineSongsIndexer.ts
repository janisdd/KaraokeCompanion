import type { SongInfo } from "~/types/song";
import { ConfigHelper } from "./configHelper";
import * as htmlParser from "node-html-parser";
import { Logger } from "./logger";
import fs from "fs";

type OnlineSongInfo = {
  key: string;
  songId: string;
  songName: string;
  artist: string;
  href: string;
};

type ArtistLetterToIndexPage = {
  text: string;
  href: string;
};

const allSongsIndexJsonFileName = "all_online_songs_index.json";
const usdbUrlPrefixForHref = "https://usdb.animux.de/";

export class AllOnlineSongsIndexer {
  private static _allOnlineSongInfos: Map<
    OnlineSongInfo["key"],
    OnlineSongInfo
  > = new Map();


  public static saveIndexToFile() {
    const indexJson = JSON.stringify(Array.from(this._allOnlineSongInfos.values()), null, 2);
    fs.writeFileSync(allSongsIndexJsonFileName, indexJson);
  }

  public static loadIndexFromFile() {
    const indexJson = fs.readFileSync(allSongsIndexJsonFileName, "utf8");
    const index = JSON.parse(indexJson);
    for (const songInfo of index) {
      this._allOnlineSongInfos.set(songInfo.key, songInfo);
    }
  }

  public static checkIfIndexExists() {
    return fs.existsSync(allSongsIndexJsonFileName);
  }

  // key is "artist - songid" because this is what should be unique and never change
  private static getKey(artist: string, songName: string): string {
    return `${artist}-${songName}`;
  }

  public static async indexAllOnlineSongs() {

    if (this.checkIfIndexExists()) {
      Logger.log(`[AllOnlineSongsIndexer] Index already exists, loading from file`);
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

    Logger.log(`[AllOnlineSongsIndexer] Indexing complete, saving index to file`);
    this.saveIndexToFile();
  }


  private static async indexArtistLetter(
    artistLetterPageTuple: ArtistLetterToIndexPage,
  ) {
    const onlineSongInfos: OnlineSongInfo[] = [];
    // this returns a html page

    Logger.debug(`[AllOnlineSongsIndexer] Indexing artist letter: ${artistLetterPageTuple.text} - ${artistLetterPageTuple.href}`);
    const artistByLetterPageResponse = await fetch(
      `${usdbUrlPrefixForHref}${artistLetterPageTuple.href}`,
    );
    Logger.debug(`[AllOnlineSongsIndexer] Artist by letter page response: ${artistByLetterPageResponse.status} - ${artistByLetterPageResponse.statusText}`);

    const artistByLetterPageHtml = await artistByLetterPageResponse.text();
    Logger.debug(`[AllOnlineSongsIndexer] Artist by letter page html loaded`);

    const artistByLetterPageRoot = htmlParser.parse(artistByLetterPageHtml);
    Logger.debug(`[AllOnlineSongsIndexer] Artist by letter page root parsed`);

    const divTagsWithArtistSongs = artistByLetterPageRoot.querySelectorAll(
      `#tablebg .row1 .details`,
    );
    for (const divTagWithArtistSong of divTagsWithArtistSongs) {
      // e.g. <div id="artist1" class="details" style="display: block;">...</div>
      const artistTmpId = divTagWithArtistSong.getAttribute("id");

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
          `No artist song anchors script text found for artist tmp id: ${artistTmpId} in artist letter page: ${artistLetterPageTuple.text} - ${artistLetterPageTuple.href}`,
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
        const artistId = artistIdMatch[1];
        if (artistId.trim() === "") {
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
        const songNameMatch =
          artistSongAnchorScriptTextLine.match(/>(.*?)<\/a>/);
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
          artist: artistName,
          href: `?link=detail&id=${songId}`,
        };
        onlineSongInfos.push(songInfo);

        Logger.debug(`[AllOnlineSongsIndexer] Song ${artistName} - ${songName} - ${songId}`);
      }

    }
    return onlineSongInfos;
  }
}
