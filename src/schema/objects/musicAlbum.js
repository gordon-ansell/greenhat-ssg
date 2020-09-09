/**
 * @file        Schema 'MusicPlaylist'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const MusicPlaylist = require("./musicPlaylist");

class MusicAlbum extends MusicPlaylist
{

    byArtist(val) {return this.setProp('byArtist', val);}

}

module.exports = MusicAlbum;
