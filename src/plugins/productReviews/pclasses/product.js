/**
 * @file        product/types/product.
 * @module      Product
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const syslog = require("greenhat-util/syslog");
const arr = require("greenhat-util/array");
const BaseProdType = require("./baseProdType");

/**
 * Product.
 */
class Product extends BaseProdType
{
    /**
     * Process.
     */
    process()
    {
        super.process();

        if (this._specs.brand) {
            this._brandLink = this.nameUrl(this._specs.brand);
        }

        if (this._specs.category) {
            this._categoryStr = arr.makeArray(this._specs.category).join(', ')
        }
    }

    /**
     * Get the brand link.
     * 
     * @return  {string}        Brand link.
     */
    get brandLink()
    {
        return this._brandLink || null;
    }

    /**
     * Get the category string.
     * 
     * @return  {string}        Category string.
     */
    get categoryStr()
    {
        return this._categoryStr || null;
    }
}

module.exports = Product
