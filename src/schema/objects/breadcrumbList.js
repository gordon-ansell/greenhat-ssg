/**
 * @file        Schema 'BreadcrumbList'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const ItemList = require("./itemList");

class BreadcrumbList extends ItemList
{
    itemListElement(val) {return this.setProp('itemListElement', val);}
    numberOfItems(val) {return this.setProp('numberOfItems', val);}
}

module.exports = BreadcrumbList;
