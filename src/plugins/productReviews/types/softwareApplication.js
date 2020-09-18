/**
 * @file        product/types/softwareApplication.
 * @module      Product
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const ProductBase = require("./productBase");
const syslog = require("greenhat-util/syslog");
const arr = require("greenhat-util/array");

/**
 * SoftwareApplication.
 */
class SoftwareApplication extends ProductBase
{
    /**
     * Frig parameters as necessary.
     */
    _frigSpecs()
    {
        if (this._specs.brand && !this._specs.creator) {
            this._specs.creator = this._specs.brand;
        }
        if (this._specs.os && !this._specs.operatingSystem) {
            this._specs.operatingSystem = this._specs.os;
        }
        if (this._specs.category && !this._specs.applicationCategory) {
            this._specs.applicationCategory = this._specs.category;
        }
    }

    /**
     * Process.
     */
    process()
    {
        super.process();

        if (this._specs.operatingSystem) {
            this._osStr = arr.makeArray(this._specs.operatingSystem).join(', ');
        }

        if (this._specs.version) {
            this._versionStr = arr.makeArray(this._specs.version).join(', ');
        }

        if (this._specs.applicationCategory) {
            this._applicationCategoryStr = arr.makeArray(this._specs.applicationCategory).join(', ')
        }
    }

    /**
     * Get the OS string.
     * 
     * @return  {string}        OS string.
     */
    get osStr()
    {
        return this._osStr || null;
    }

    /**
     * Get the version string.
     * 
     * @return  {string}        Version string.
     */
    get versionStr()
    {
        return this._versionStr || null;
    }

    /**
     * Get the application category string.
     * 
     * @return  {string}        Application category string.
     */
    get applicationCategoryStr()
    {
        return this._applicationCategoryStr || null;
    }
}

module.exports = SoftwareApplication
