/**
 * @file        Schema 'HowTo'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const CreativeWork = require("./creativeWork");

class HowTo extends CreativeWork
{

    prepTime(val) {return this.setProp('prepTime', val);}
    step(val) {return this.setProp('step', val);}
    supply(val) {return this.setProp('supply', val);}
    tool(val) {return this.setProp('tool', val);}
    totalTime(val) {return this.setProp('totalTime', val);}

}

module.exports = HowTo;
