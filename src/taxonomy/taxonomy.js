/**
 * @file        An individual taxonomy.
 * @module      taxonomy/Taxonomy
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { Html } = require("greenhat-base");
const path = require('path');

/**
 * Taxonomy.
 * 
 * @property    {string}    name        Name of the taxonomy.
 * @property    {number}    count       Count of the number of articles.
 * @property    {string[]}  articles    Articles in the taxonomy.
 */
class Taxonomy
{
    /**
     * Constructor.
     * 
     * @param   {string}    name    The name of this taxonomy.
     * @param   {string}    type    The type of this taxonomy.
     */
    constructor(name, type)
    {
        this.name = name;
        this.type = type;
        this.count = 0;
        this.articles = [];
    }

    /**
     * Add an article to the taxonomy.
     * 
     * @param   {object}    article     The article to add.
     * @return  {object}                Ourself.    
     */
    addArticle(article)
    {
        this.articles.push(article);
        this.count++;
        return this;
    }

    /**
     * Get the articles.
     * 
     * @return  {string[]}              The array of articles.
     */
    getArticles()
    {
        return this.articles;
    }

    /**
     * Get the count.
     * 
     * @return  {number}                The number of articles.
     */
    getCount()
    {
        return this.count;
    }

    /**
     * Sort the article by the date.
     */
    sortArticlesByDate()
    {
        this.articles = this.articles.sort((a, b) => {
            if (a.dates.published.ms > b.dates.published.ms) {return -1;}
            if (b.dates.published.ms > a.dates.published.ms) {return 1;}
            return 0; 
        });
    }

    /**
     * Get the taxonomy link.
     * 
     * @return  {string}        Link.
     */
    getLink()
    {
        let html = new Html('a');
        let url = path.join(path.sep, this.type, this.name.slugify(), path.sep);
        html.addParam('href', url);
        return html.resolve(this.name);
    }
}

module.exports = Taxonomy;
