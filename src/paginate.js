/**
 * @file        Pagination.
 * @module      Paginate
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const syslog = require("greenhat-util/syslog");
const path = require('path');
const fs = require('fs');
const { mkdirRecurse } = require("greenhat-util/fs");
const GreenHatSSGError = require("./ssgError");
const str = require("greenhat-util/string");

/**
 * Pagination class.
 */
class Paginate
{
    map = null;
    articlesPerPage = 20;
    totalPages = 0;
    alias = null;

    /**
     * Constructor.
     * 
     * @param   {object}    data                Data object to page.
     * @param   {object}    ctx                 Context.
     * @param   {string}    alias               Alias name.
     * @param   {string}    dummy               Dummy layout name.
     * @param   {number}    articlesPerPage     Number of articles per page.
     */
    constructor(map, ctx, alias, dummy, articlesPerPage = null)
    {
        this.map = map;
        this.ctx = ctx;
        this.alias = alias;
        this.dummy = dummy;

        if (articlesPerPage) {
            this.articlesPerPage = articlesPerPage;
        } else if (ctx.cfg.site.articlesPerPage) {
            this.articlesPerPage = ctx.cfg.site.articlesPerPage;
        } else {
            this.articlesPerPage = 20;
        }
        this.calculatePaging();
        this.prevNext();
        this.generatePages();
    }

    /**
     * Calculate the paging.
     */
    calculatePaging()
    {
        let articleCount = this.map.size;
        this.totalPages = Math.ceil(articleCount / this.articlesPerPage);
    }

    /**
     * Manage the prev/next links.
     */
    prevNext()
    {
        let next = null;    // Newer.

        for (let currKey of this.map.keys()) {
    
            if (next != null) {
                let nextObj = this.map.get(next);
                this.map.get(currKey).next = {
                    title: nextObj.title,
                    url: nextObj.url,
                }
    
                let thisObj = this.map.get(currKey);
                this.map.get(next).prev = {
                    title: thisObj.title,
                    url: thisObj.url,
                }
    
            }
    
            next = currKey;    
        }
    
    }

    /**
     * Generate the extra pages.
     */
    async generatePages()
    {
        if (this.totalPages < 2) {
            return;
        }

        let pagesIter = [];
        for (let i = 2; i <= this.totalPages; i++) {
            pagesIter.push(i);
        }

        // Get the dummy.
        let fn = await this.ctx.findTemplateDummy(this.dummy);
        if (!fn) {
            syslog.error(`Could not find dummy layout '${this.dummy}'.`);
            return;
        }
        // Read the dummy.
        let dummy = fs.readFileSync(fn, 'utf-8');

        // Loop for necessary pages.
        await Promise.all(pagesIter.map(async page => {

            let start = (page * this.articlesPerPage) - this.articlesPerPage + 1;
            let end = start + this.articlesPerPage - 1;

            let fileData = dummy;
            fileData = str.replaceAll(fileData, '-page-', page);
            fileData = str.replaceAll(fileData, '-title-', this.ctx.cfg.site.title);
            fileData = str.replaceAll(fileData, '-description-', this.ctx.cfg.site.description);
            fileData = str.replaceAll(fileData, '-start-', start);
            fileData = str.replaceAll(fileData, '-end-', end);

            // Define a file name and write to it.
            let fileName = path.join(this.ctx.sitePath, this.ctx.cfg.locations.temp, 
                'dummy', str.slugify(String(page)) + '.html');
            let dir = path.dirname(fileName);
            if (!fs.existsSync(dir)) {
                mkdirRecurse(dir);
            }
            fs.writeFileSync(fileName, fileData, 'utf-8');

            // Parse the article.
            let article = await this.ctx.cfg.parsers['md'].call(this.ctx, fileName);
            article[this.alias] = this;

            // Render the article.
            await this.ctx.cfg.renderers['njk'].call(this.ctx, article)
            
            // Save the article.
            //this.ctx.articles.all.set(article.url, article);
            //this.ctx.articles.page.set(article.url, article);
        }));
    }

    /**
     * Get the entries for a page.
     * 
     * @param   {number}    num     Page number.
     * @return  {object[]}          Objects in range.
     */
    page(num = 1)
    {
        if (num < 1) {
            throw new GreenHatSSGError(`Invalid pagination page number: ${num}.`);
        }
        if (num > this.totalPages) {
            throw new GreenHatSSGError(`Pagination page number ${num} does not exist.`);
        }

        let keys = Array.from(this.map.keys());
 
        let start = (num * this.articlesPerPage) - this.articlesPerPage + 1;
        let end = start + this.articlesPerPage - 1;

        let filtered = keys.filter((val, idx) => {
            return (idx >= start - 1 && idx <= end - 1);
        });

        let ret = [];
        for (let want of filtered) {
            ret.push(this.map.get(want));
        }

        return ret;
    }

}

module.exports = Paginate
