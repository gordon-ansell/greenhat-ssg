/**
 * @file        Schema 'Thing'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const BaseType = require("../baseType");

class Thing extends BaseType
{

    alternateName(val) { return this.setProp('alternateName', val);}
    description(val) { return this.setProp('description', val);}
    identifier(val) { return this.setProp('identifier', val);}
    image(val) { return this.setProp('image', val);}
    mainEntityOfPage(val) { return this.setProp('mainEntityOfPage', val);}
    name(val) { return this.setProp('name', val);}
    sameAs(val) { return this.setProp('sameAs', val);}
    url(val) { return this.setProp('url', val);}

}

module.exports = Thing;
