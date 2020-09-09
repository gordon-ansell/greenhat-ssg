/**
 * @file        Schema 'SoftwareApplication'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const CreativeWork = require("./creativeWork");

class SoftwareApplication extends CreativeWork
{

    applicationCategory(val) {return this.setProp('applicationCategory', val);}
    operatingSystem(val) {return this.setProp('operatingSystem', val);}
    softwareVersion(val) {return this.setProp('softwareVersion', val);}

}

module.exports = SoftwareApplication;
