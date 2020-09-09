/**
 * @file        Schema 'MusicPlaylist'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const CreativeWork = require("./creativeWork");

class MusicRecording extends CreativeWork
{

    byArtist(val) {return this.setProp('byArtist', val);}
    inAlbum(val) {return this.setProp('inAlbum', val);}

}

module.exports = MusicRecording;
