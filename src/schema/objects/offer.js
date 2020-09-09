/**
 * @file        Schema 'Offer'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const Thing = require("./thing");

class Offer extends Thing
{
    aggregateRating(val) {return this.setProp('aggregateRating', val);}
    availability(val) {return this.setProp('availability', val);}
    category(val) {return this.setProp('category', val);}
    gtin(val) {return this.setProp('gtin', val);}
    gtin8(val) {return this.setProp('gtin8', val);}
    gtin12(val) {return this.setProp('gtin12', val);}
    gtin13(val) {return this.setProp('gtin13', val);}
    gtin14(val) {return this.setProp('gtin14', val);}
    itemOffered(val) {return this.setProp('itemOffered', val);}
    mpn(val) {return this.setProp('mpn', val);}
    offeredBy(val) {return this.setProp('offeredBy', val);}
    price(val) {return this.setProp('price', val);}
    priceCurrency(val) {return this.setProp('priceCurrency', val);}
    priceValidUntil(val) {return this.setProp('priceValidUntil', val);}
    review(val) {return this.setProp('review', val);}
    seller(val) {return this.setProp('seller', val);}
    sku(val) {return this.setProp('sku', val);}
    validFrom(val) {return this.setProp('validFrom', val);}
}

module.exports = Offer;
