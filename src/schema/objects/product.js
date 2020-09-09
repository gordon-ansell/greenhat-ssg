/**
 * @file        Schema 'Product'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const Thing = require("./thing");

class Product extends Thing
{
    aggregateRating(val) {return this.setProp('aggregateRating', val);}
    brand(val) {return this.setProp('brand', val);}
    category(val) {return this.setProp('category', val);}
    gtin(val) {return this.setProp('gtin', val);}
    gtin8(val) {return this.setProp('gtin8', val);}
    gtin12(val) {return this.setProp('gtin12', val);}
    gtin13(val) {return this.setProp('gtin13', val);}
    gtin14(val) {return this.setProp('gtin14', val);}
    logo(val) {return this.setProp('logo', val);}
    model(val) {return this.setProp('model', val);}
    mpn(val) {return this.setProp('mpn', val);}
    offers(val) {return this.setProp('offers', val);}
    review(val) {return this.setProp('review', val);}
    sku(val) {return this.setProp('sku', val);}
}

module.exports = Product;
