/**
 * @file        Schema 'Rating'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const Thing = require("./thing");

class Rating extends Thing
{
    author(val) {return this.setProp('author', val);}
    bestRating(val) {return this.setProp('bestRating', val);}
    ratingExplanation(val) {return this.setProp('ratingExplanation', val);}
    ratingValue(val) {return this.setProp('ratingValue', val);}
    reviewAspect(val) {return this.setProp('reviewAspect', val);}
    worstRating(val) {return this.setProp('worstRating', val);}
}

module.exports = Rating;
