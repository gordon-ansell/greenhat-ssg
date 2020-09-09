/**
 * @file        Base collection.
 * @module      Collection
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { syslog } = require("greenhat-util/syslog");

/**
 * Collection class.
 */
class Collection
{
    // Internal map.
    items = null;

    /**
     * Constructor.
     */
    constructor()
    {
        this.items = new Map();
    }

    /**
     * Set an item.
     * 
     * @param   {any}       key     Key.
     * @param   {any}       val     Value. 
     * @return  {object}            Ourself.
     */
    set(key, value)
    {
        this.items.set(key, value);
        return this;
    }

    /**
     * Do we have an item?
     * 
     * @param   {any}   key     Key.
     * @return  {boolean}       True if we do. 
     */
    has(key)
    {
        return this.items.has(key);
    }

    /**
     * Get an item?
     * 
     * @param   {any}   key     Key.
     * @return  {any}           Item value. 
     */
    get(key)
    {
        return this.items.get(key);
    }

    /**
     * The compare function for sorting articles.
     * 
     * @param   {object}    a   First article.
     * @param   {object}    b   Second article.
     */
    _sortDescCompare(a, b)
    {
        throw new GreenHatSSGError("You must overload a collection's '_sortDescCompare' function.")
    }

    /**
     * The compare function for sorting articles.
     * 
     * @param   {object}    a   First article.
     * @param   {object}    b   Second article.
     */
    _sortAscCompare(a, b)
    {
        throw new GreenHatSSGError("You must overload a collection's '_sortAscCompare' function.")
    }

    /**
     * Sort the articles descending.
     * 
     * @return  {object}        Ourself.
     */
    desc()
    {
        this.items = new Map([...this.items.entries()].sort(this._sortDescCompare));   
        return this;   
    }

    /**
     * Sort the articles ascending.
     * 
     * @return  {object}        Ourself.
     */
    asc()
    {
        this.items = new Map([...this.items.entries()].sort(this._sortAscCompare));   
        return this;   
    }

    /**
     * Get the keys.
     */
    keys()
    {
        return this.items.keys();
    }

    /**
     * Get the values.
     */
    values()
    {
        return this.items.values();
    }

    /**
     * Get the underlying entries.
     * 
     * @return  {object}        The underlying key => data values.
     */
    getData()
    {
        return this.items;
    }

}

module.exports = Collection

