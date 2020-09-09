/**
 * @file        Schema 'Review'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const CreativeWork = require("./creativeWork");

class Review extends CreativeWork
{

    comp = ['name', 'reviewRating'];
    rec = ['description'];

    itemReviewed(val) {return this.setProp('itemReviewed', val);}
    reviewRating(val) {return this.setProp('reviewRating', val);}

}

module.exports = Review;
