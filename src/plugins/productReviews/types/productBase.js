/**
 * @file        product/types/base product.
 * @module      ProductBase
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const syslog = require("greenhat-util/syslog");
const arr = require("greenhat-util/array");

/**
 * Base class for all products.
 */
class ProductBase
{
    /** @type {object} */
    _specs = null;
    /** @type {string} */
    _key = null;
    /** @type {string} */
    _file = null;
    /** @type {object} */
    _ctx = null;

    /**
     * Constructor.
     * 
     * @param   {object}    specs       Input product specs.
     * @param   {string}    key         Key we're processing.
     * @param   {string}    file        File we're processing.
     * @param   {object}    ctx         Context.
     */
    constructor(specs, key, file, ctx)
    {
        this._specs = specs;
        this._key = key;
        this._file = file;
        this._ctx = ctx;

        this._frigSpecs();
    }

    /**
     * Frig parameters as necessary.
     */
    _frigSpecs()
    {
    }

    /**
     * Process.
     */
    process()
    {
        if (!this.specs.name) {
            syslog.warning(`Products should have a name (${this._key}).`, this._file);
        }

        let common = ['name', 'description', 'url', 'mpn', 'sku', 'gtin', 'gtin8', 'gtin12', 'gtin13', 'gtin14'];
        for (let item of common) {
            if (this._specs[item]) {
                this[name] = this._specs[name];
            }
        }

        if (this.mpn && !this.sku) {
            this.sku = this.mpn;
        } else if (this.sku && !this.mpn) {
            this.mpn = this.sku;
        }

        if (this.url) {
            this._urlStr = this._ctx.link("Product URL", this.url)
        }

        if (this._specs.sameAs) {
            let sa = arr.makeArray(this._specs.sameAs);
            let saArr = [];
            for (let item of sa) {
                if (item.includes('imdb.com')) {
                    saArr.push(this._ctx.link('IMDB', item));
                } else if (item.includes('wikipedia.org')) {
                    saArr.push(this._ctx.link('Wikipedia', item));
                } else {
                    saArr.push(this._ctx.link(item, item));
                }
            }
            this._sameAsStr = saArr.join(', ');
        }
    }

    /**
     * Get the URL string.
     * 
     * @return  {string}        URL link string.
     */
    get urlStr()
    {
        return this._urlStr || null;
    }

    /**
     * Get the sameAs string.
     * 
     * @return  {string}        sameAs string.
     */
    get sameAsStr()
    {
        return this._sameAsStr || null;
    }

    /**
     * Process name/url field.
     * 
     * @param   {any}   item    Item to process.
     * @return  {any}           Returned value.
     */
    nameUrl(item)
    {
        let ret;

        if (item.url && item.name) {
            ret = this._ctx.link(item.name, item.url);
        } else if (item.url) {
            ret = this._ctx.link(item.url, item.url);
        } else if (item.name) {
            ret = item.name;
        } else {
            ret = item;
        }

        return ret;
    }
}

module.exports = ProductBase
