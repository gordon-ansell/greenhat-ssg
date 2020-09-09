/**
 * @file        Schema 'ImageObject'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const MediaObject = require("./mediaObject");

class ImageObject extends MediaObject
{
    caption(val) {return this.setProp('caption', val);}
    representativeOfPage(val) {return this.setProp('representativeOfPage', val);}
    thumbnail(val) {return this.setProp('thumbnail', val);}
}

module.exports = ImageObject;
