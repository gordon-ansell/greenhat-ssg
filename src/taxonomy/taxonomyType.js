/**
 * @file        A type of taxonomies (i.e. cats, tags).
 * @module      taxonomy/TaxonomyType
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const GreenhatSSGError = require('../greenhatSSGError');
const Taxonomy = require('./taxonomy');

class GreenhatSSGTaxonomyError extends GreenhatSSGError {};

/**
 * Taxonomy type.
 * 
 * @property    {object}    items   The items.
 */
class TaxonomyType
{
    /**
     * Constructor.
     * 
     * @param   {string}    name    The name of this taxonomy.
     */
    constructor(name)
    {
        this.name = name;
        this.items = new Map();
    }

    /**
     * Add a taxonomy type.
     * 
     * @param   {string}    name    Name of the taxonomy to create.
     * @return  {object}            Ourself.    
     */
    addTaxonomy(name)
    {
        this.items.set(name, new Taxonomy(name, this.name));
        return this;
    }

    /**
     * Do we have a taxonomy?
     * 
     * @param   {string}    name    Name to test.
     * @return  {boolean}           True if we do.
     */
    hasTaxonomy(name)
    {
        return this.items.has(name);
    }

    /**
     * Get the taxonomy.
     * 
     * @param   {string}    name    Name to get.
     * @return  {object}            The item map.
     */
    getTaxonomy(name)
    {
        if (this.hasTaxonomy(name)) {
            return this.items.get(name);
        }
        throw new GreenhatSSGTaxonomyError(`No taxonomy ${name} found for type ${this.name}.`);
    }

    /**
     * Sort the items by the count.
     * 
     * @return  {object}            Ourself.
     */
    sortByCount()
    {
        this.items = new Map([...this.items.entries()].sort((a, b) => {
            if (a[1].count > b[1].count) {return -1;}
            if (b[1].count > a[1].count) {return 1;}
            return 0; 
        }));

        return this;
    }

    /**
     * Sort all the taxonomies.
     */
    async sortTaxonomies()
    {
        await Promise.all(Array.from(this.items.keys()).map(async name => {
            this.getTaxonomy(name).sortArticlesByDate();
        }));
    }
}

module.exports = TaxonomyType;
