/**
 * @file        Base schema builder.
 * @module      Schema
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

class SchemaCollection
{
    // Items.
    items = {}

    // Context.
    context = "https://schema.org";

    /**
     * Constructor.
     *
     * @param   {string}    context            Context.
     */
    constructor(context = "http://schema.org")
    {
        this.context = context;
    }

    /**
     * Add an item.
     * 
     * @param   {string}    name                Name of item to add.
     * @param   {object}    item                Schema item to add.
     * @return  {object}                        Ourself.
     */
    add(name, item)
    {
        if (this.items[name]) {
            throw new Error(`Schema collwction already has an item called '${item}'.`)
        }
        this.items[name] = item;
        return this;
    }

    /**
     * Resolve the graph.
     * 
     * @param   {boolean}   stringify   Stringify it?
     * @param   {string}    spacer      Spacer.
     * @return  {object}                Full schema.
     */
    resolve(stringify = true, spacer = null)
    {
        let ret = {
            '@context': this.context,
            '@graph': []
        }

        for (let key in this.items) {
            ret['@graph'].push(this.items[key].resolveProps());
        }

        if (stringify) {
            return JSON.stringify(ret, null, spacer);
        } else {
            return ret;
        }
    }



}

module.exports = SchemaCollection;
