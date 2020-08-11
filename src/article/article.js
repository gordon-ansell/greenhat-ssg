/**
 * @file        Article object.
 * @module      article/Article
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const path = require('path');
const { Html, makeArray, syslog, merge } = require('greenhat-base');

/**
 * Article class.
 * 
 * @property    {string}    basename        Base name.
 * @property    {object}    content         Article content.
 * @property    {object}    contentRss      RSS content.
 * @property    {boolean}   feed            Include in feed?
 * @property    {string}    fullPath        Full path to article.
 * @property    {string}    outputRelPath   Relative output path.
 * @property    {string}    layout          The layout.
 * @property    {boolean}   published       Are we published?
 * @property    {string}    relPath         Relative path.
 * @property    {boolean}   sitemap         Include in sitemap?
 * @property    {string}    sitePath        Path to site.
 * @property    {string}    title           Article title.
 * @property    {string}    url             Article URL.
 */
class Article
{
    /**
     * Constructor.
     * 
     * @param   {string}    fullPath    Full path to the article.
     * @param   {string}    sitePath    Absolute path to site.
     * @param   {string}    ctx         Context.
     */
    constructor(fullPath, sitePath, ctx)
    {
        this.fullPath = fullPath;
        this.sitePath = sitePath;
        this.ctx = ctx;
    }

    /**
     * Get the image URLS for specified images tags.
     * 
     * @param   {string|string[]}   tags    Tag or tags to get them for.
     * @return  {string[]}                  URLs for the tags.    
     */
    getImageUrlsForTags(tags)
    {
        tags = makeArray(tags);

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
        }

        return ret;
    }

    /**
     * Get the first author.
     * 
     * @return  {object}        First author object.
     */
    firstAuthor()
    {
        if (this.author) {
            return this.ctx.config.site.authors[this.author[0]];
        }
        return null;
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
        let fs = this.firstCitation();
        
        if (!fs) {
            return null;
        }

        let imgStr = '';
        if (this.ctx.config.site.externalLinkIcon) {
            let img = new Html('img');
            let srcName = 'src';
            if (this.ctx.config.site.lazyload) {
                img.addParam('class', this.ctx.config.site.lazyclass);
                srcName = 'data-src';
            }
            img.addParam(srcName, this.ctx.config.site.externalLinkIcon);
            img.addParam('alt', 'External link icon.');
            imgStr = ' ' + img.resolve();

        }

        let a = new Html('a');
        a.addParam('href', fs.url);
        a.addParam('title', 'Read the cited article on the external site.');

        return a.resolve(this.title + imgStr);

    }
}

module.exports = Article;
