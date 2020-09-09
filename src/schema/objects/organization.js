/**
 * @file        Schema 'Organization'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const Thing = require("./thing");

class Organization extends Thing
{
    address(val) {return this.setProp('address', val);}
    aggregateRating(val) {return this.setProp('aggregateRating', val);}
    brand(val) {return this.setProp('brand', val);}
    email(val) {return this.setProp('email', val);}
    location(val) {return this.setProp('location', val);}
    logo(val) {return this.setProp('logo', val);}
    review(val) {return this.setProp('review', val);}
    telephone(val) {return this.setProp('telephone', val);}
}

module.exports = Organization;
