/**
 * @file        An individual taxonomy.
 * @module      Taxonomy
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const Html = require("greenhat-util/html");
const path = require('path');
const syslog = require("greenhat-util/syslog");
const str = require("greenhat-util/string");

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
     * @param   {string}    dir     Directory name for links.  
     */
    constructor(name, type, dir)
    {
        this.name = name;
        this.type = type;
        this.dir = dir;
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
            if (a.datePublished.ms > b.datePublished.ms) {return -1;}
            if (b.datePublished.ms > a.datePublished.ms) {return 1;}
            return 0; 
        });
        return this;
    }

    /**
     * Get the taxonomy link.
     * 
     * @return  {string}        Link.
     */
    getLink()
    {
        let html = new Html('a');
        let url = path.join(path.sep, this.dir, str.slugify(this.name), path.sep);
        html.addParam('href', url);
        return html.resolve(this.name);
    }
}

module.exports = Taxonomy;
