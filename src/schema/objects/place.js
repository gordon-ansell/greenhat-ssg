/**
 * @file        Schema 'Place'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const Thing = require("./thing");

class Place extends Thing
{
    address(val) {return this.setProp('address', val);}
    aggregateRating(val) {return this.setProp('aggregateRating', val);}
}

module.exports = Place;
