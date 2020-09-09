/**
 * @file        Schema 'MediaObject'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const CreativeWork = require("./creativeWork");

class MediaObject extends CreativeWork
{

    contentUrl(val) {return this.setProp('contentUrl', val);}
    duration(val) {return this.setProp('duration', val);}
    embedUrl(val) {return this.setProp('embedUrl', val);}
    height(val) {return this.setProp('height', val);}
    productionCompany(val) {return this.setProp('productionCompany', val);}
    uploadDate(val) {return this.setProp('uploadDate', val);}
    width(val) {return this.setProp('width', val);}
    
}

module.exports = MediaObject;
