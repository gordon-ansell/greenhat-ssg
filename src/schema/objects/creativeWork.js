/**
 * @file        Schema 'CreativeWork'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const Thing = require("./thing");

class CreativeWork extends Thing
{
    acquireLicensePage(val) {return this.setProp('acquireLicensePage', val);}
    aggregateRating(val) {return this.setProp('aggregateRating', val);}
    author(val) {return this.setProp('author', val);}
    citation(val) {return this.setProp('citation', val);}
    creator(val) {return this.setProp('creator', val);}
    dateCreated(val) {return this.setProp('dateCreated', val);}
    dateModified(val) {return this.setProp('dateModified', val);}
    datePublished(val) {return this.setProp('datePublished', val);}
    headline(val) {return this.setProp('headline', val);}
    isPartOf(val) {return this.setProp('isPartOf', val);}
    keywords(val) {return this.setProp('keywords', val);}
    license(val) {return this.setProp('license', val);}
    mainEntity(val) {return this.setProp('mainEntity', val);}
    offers(val) {return this.setProp('offers', val);}
    publisher(val) {return this.setProp('publisher', val);}
    review(val) {return this.setProp('review', val);}
    text(val) {return this.setProp('text', val);}
    thumbnailUrl(val) {return this.setProp('thumbnailUrl', val);}
    version(val) {return this.setProp('version', val);}
    video(val) {return this.setProp('video', val);}

}

module.exports = CreativeWork;
