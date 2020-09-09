/**
 * @file        Schema 'ItemList'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const Thing = require("./thing");

class ItemList extends Thing
{
    itemListElement(val) {return this.setProp('itemListElement', val);}
    numberOfItems(val) {return this.setProp('numberOfItems', val);}
}

module.exports = ItemList;
