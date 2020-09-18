/**
 * @file        product/types/tvSeries.
 * @module      TVSeries
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const ProductBase = require("./productBase");
const syslog = require("greenhat-util/syslog");
const arr = require("greenhat-util/array");

/**
 * TVSeries.
 */
class TVSeries extends ProductBase
{
    /**
     * Frig parameters as necessary.
     */
    _frigSpecs()
    {
        if (this._specs.brand && !this._specs.productionCompany) {
            this._specs.productionCompany = this._specs.brand;
        }
    }

    /**
     * Process.
     */
    process()
    {
        super.process();

        if (this._specs.productionCompany) {
            this._productionCompanyLink = this.nameUrl(this._specs.productionCompany);
        }
    }

    /**
     * Get the productionCompany link.
     * 
     * @return  {string}        Production company link.
     */
    get productionCompanyLink()
    {
        return this._productionCompanyLink || null;
    }

}

module.exports = TVSeries
