/**
 * @file        GreenHat SSG Data.
 * @module      Config
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const syslog = require("greenhat-util/syslog");
const GreenHatSSGError = require("./ssgError");

class GreenHatSSGDataError extends GreenHatSSGError {}

/**
 * Data class.
 */
class Data
{
    // Internal data store.
    data = {};

    /**
     * Constructor.
     */
    constructor()
    {
    }

    /**
     * Add some data.
     * 
     * @param   {string}    key     Variable key.
     * @param   {any}       val     Variable value.
     */
    add(key, val)
    {
        if (this.data[key]) {
            throw new GreenHatSSGDataError(`Data already has a value for '${key}'.`);
        }
        this.data[key] = val;
    }

    /**
     * Set some data.
     * 
     * @param   {string}    key     Variable key.
     * @param   {any}       val     Variable value.
     */
    set(key, val)
    {
        this.data[key] = val;
    }

    /**
     * See if we have some data.
     * 
     * @param   {string}    key     Variable key.
     * @return  {boolean}           True if we do.
     */
    has(key)
    {
        return (key in this.data) ? true : false;
    }

    /**
     * Get some data.
     * 
     * @param   {string}    key     Variable key.
     * @param   {any}       def     Default to return if no data.
     * @param   {boolean}   ex      Throw exception if no data.
     * @return  {any}               Variable value.
     */
    get(key, def = null, ex = false)
    {
        if (!this.has(key)) {
            if (ex) {
                throw new GreenHatSSGDataError(`Data does not have a value for '${key}'.`);
            } else {
                return def;
            }
        }
        return this.data[key];
    }

    /**
     * Delete a data key.
     * 
     * @param   {string}    key     Variable key.
     */
    del(key)
    {
        if (this.has(key)) {
            delete this.data[key];
        }
    }

    /**
     * Get the internal data object.
     * 
     * @return  {object}    Internal data object. 
     */
    getData()
    {
        return this.data;
    }

}

module.exports = Data;
