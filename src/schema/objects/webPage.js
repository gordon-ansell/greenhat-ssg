/**
 * @file        Schema 'WebPage'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const CreativeWork = require("./creativeWork");

class WebPage extends CreativeWork
{

    comp = ['name', 'url'];

    breadcrumb(val) {return this.setProp('breadcrumb', val);}
    mainContentOfPage(val) {return this.setProp('mainContentOfPage', val);}
    primaryImageOfPage(val) {return this.setProp('primaryImageOfPage', val);}
    relatedLink(val) {return this.setProp('relatedLink', val);}
    significantLink(val) {return this.setProp('significantLink', val);}

}

module.exports = WebPage;
