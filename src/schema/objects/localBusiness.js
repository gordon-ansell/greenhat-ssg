/**
 * @file        Schema 'LocalBusiness'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const Organization = require("./organization");

class LocalBusiness extends Organization
{
    openingHours(val) {return this.setProp('openingHours', val);}
    priceRange(val) {return this.setProp('priceRange', val);}
}

module.exports = LocalBusiness;
