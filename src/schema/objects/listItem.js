/**
 * @file        Schema 'ListItem'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const Thing = require("./thing");

class ListItem extends Thing
{
    item(val) {return this.setProp('item', val);}
    position(val) {return this.setProp('position', val);}
}

module.exports = ListItem;
