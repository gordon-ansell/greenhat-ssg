/**
 * @file        Article object.
 * @module      Article
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const fs = require('fs');
const ghfs = require("greenhat-util/fs");
const syslog = require('greenhat-util/syslog');
const Html = require('greenhat-util/html');
const arr = require("greenhat-util/array");
const str = require("greenhat-util/string");
const path = require('path');
const { merge } = require("greenhat-util/merge");

/**
 * Article object.
 */
class Article
{
    /**
     * Constructor.
     * 
     * @param   {string}    ctx         Context.
     */
    constructor(ctx)
    {
        this.ctx = ctx;
    }

    /**
     * Get the taxonomies.
     * 
     * @param   {string|string[]}   type        Type of taxonomy.
     * @param   {boolean}           asArray     As array?
     * @param   {boolean}           asLinks     As links?
     * @return  {string|string[]}               Taxonomies.
     */
    getTaxonomies(type = null, asLinks = false, asArray = false)
    {
        if (type === null) {
            type = Object.keys(this.ctx.cfg.taxonomySpec);
        }

        type = arr.makeArray(type);

        let retArr = [];

        for (let taxType of type) {
            if (this[taxType]) {
                let tt = arr.makeArray(this[taxType]);
                for (let tax of tt) {
                    if (asLinks) {
                        let ts = this.ctx.cfg.taxonomySpec[taxType];
                        let link = this.ctx.link(tax, path.join(ts.path, str.slugify(tax)));
                        retArr.push(link);
                    } else {
                        retArr.push(tax);
                    }
                }
            }
        }

        if (asArray) {
            return retArr;
        } else {
            return retArr.join(', ');
        }
    }

    /**
     * Get the first citation.
     * 
     * @return  {object}        First citation object.
     */
    firstCitation()
    {
        if (this.citation) {
            return this.citationList[0];
        }
        return null;
    }

    /**
     * Get the first citation link.
     * 
     * @return  {string}        First citation link.
     */
    firstCitationLink()
    {
        let fc = this.firstCitation();
        
        if (!fc) {
            return null;
        }

        let imgStr = '';
        if (this.ctx.cfg.site.externalLinkIcon) {
            let img = new Html('img');
            let srcName = 'src';
            if (this.ctx.cfg.site.lazyload) {
                img.addParam('class', this.ctx.cfg.site.lazyclass);
                srcName = 'data-src';
            }
            img.addParam(srcName, this.ctx.cfg.site.externalLinkIcon);
            img.addParam('alt', 'External link icon.');
            imgStr = ' ' + img.resolve();

        }

        let a = new Html('a');
        a.addParam('href', fc.url);
        a.addParam('title', 'Read the cited article on the external site.');

        return a.resolve(this.title + imgStr);

    }

    /**
     * Get the first review.
     * 
     * @return  {object}        First review object.
     */
    firstReview()
    {
        if (this.reviews) {
            return this.reviews[Object.keys(this.reviews)[0]];
        }
        return null;
    }

    /**
     * Get the image URLS for specified images tags.
     * 
     * @param   {string|string[]}   tags    Tag or tags to get them for.
     * @return  {string[]}                  URLs for the tags.    
     */
    getImageUrlsForTags(tags)
    {
        tags = arr.makeArray(tags);

        let ret = [];

        for (let tag of tags) {

            let url = null;
            
            if (this.images && this.images[tag]) {
                url = this.images[tag].url;
            } else if (this.imageRefs && this.imageRefs[tag]) {
                url = this.imageRefs[tag].url;
            } else {
                syslog.error(`No '${tag}' image tag found.`, this.relPath);
                continue;
            }

            if (!this.ctx.images.has(url)) {
                syslog.error(`No image with URL ${url} found (tag '${tag}').`, this.relPath);
                continue;
            }

            let u = this.ctx.images.get(url).allUrls();

            ret = merge(ret, u);
            //ret = Object.merge(ret, u);
        }

        return ret;
    }

    /**
     * Dump.
     */
    dump(level = "warning", context = '')
    {
        let n = {...this};
        delete n.ctx;
        syslog.inspect(n, level, context);
    }

}

module.exports = Article;