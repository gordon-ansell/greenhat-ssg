/**
 * @file        product/types/localBusiness.
 * @module      LocalBusiness
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const ProductBase = require("./productBase");
const syslog = require("greenhat-util/syslog");
const arr = require("greenhat-util/array");
const str = require("greenhat-util/string");

/**
 * LocalBusiness.
 */
class LocalBusiness extends ProductBase
{
    /**
     * Process.
     */
    process()
    {
        super.process();

        if (this._specs.map) {
            let txt = str.ucfirst(this._ctx.x('map')) + ' ' + str.ucfirst(this._ctx.x('link')); 
            this._mapLink = this._ctx.link(txt, prod.map);
        }
    }

    /**
     * Get the map link.
     * 
     * @return  {string}        Map link.
     */
    get mapLink()
    {
        return this._mapLink || null;
    }

}

module.exports = LocalBusiness
