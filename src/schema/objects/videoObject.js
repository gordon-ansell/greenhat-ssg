/**
 * @file        Schema 'VideoObject'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const MediaObject = require("./mediaObject");

class VideoObject extends MediaObject
{
    caption(val) {return this.setProp('caption', val);}
    thumbnail(val) {return this.setProp('thumbnail', val);}
}

module.exports = VideoObject;
