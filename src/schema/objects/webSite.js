/**
 * @file        Schema 'WebSite'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const CreativeWork = require("./creativeWork");

class WebSite extends CreativeWork
{

    comp = ['name', 'url'];

}

module.exports = WebSite;
