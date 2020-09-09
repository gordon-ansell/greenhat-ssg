/**
 * @file        Schema 'TVSeries'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const CreativeWork = require("./creativeWork");

class TVSeries extends CreativeWork
{

    actor(val) {return this.setProp('actor', val);}
    director(val) {return this.setProp('director', val);}
    productionCompany(val) {return this.setProp('productionCompany', val);}

}

module.exports = TVSeries;
