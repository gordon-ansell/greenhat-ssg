/**
 * @file        Schema 'MusicPlaylist'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const CreativeWork = require("./creativeWork");

class MusicPlaylist extends CreativeWork
{

    track(val) {return this.setProp('track', val);}

}

module.exports = MusicPlaylist;
