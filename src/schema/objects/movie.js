/**
 * @file        Schema 'Movie'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const CreativeWork = require("./creativeWork");

class Movie extends CreativeWork
{

    actor(val) {return this.setProp('actor', val);}
    director(val) {return this.setProp('director', val);}
    duration(val) {return this.setProp('duration', val);}
    productionCompany(val) {return this.setProp('productionCompany', val);}

}

module.exports = Movie;
