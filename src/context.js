/**
 * @file        GreenHat template context.
 * @module      Context
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { Html, slugify, replaceAll } = require('greenhat-base');
const urlp = require('url');
const path = require('path');
const { makeArray } = require('greenhat-base/src/utils/array');
const GreenhatSSGError = require('./greenhatSSGError');
const { syslog } = require('greenhat-base/src/logger');
const { config } = require('process');
const dateformat = require('dateformat');

class GreenhatSSGContextError extends GreenhatSSGError {}

/**
 * Context class.
 * 
 * @property    {string}    appPath         Application path.
 * @property    {object}    args            Command line arguments.
 * @property    {object}    articles        The articles.
 * @property    {object}    config          Configuration.
 * @property    {string[]}  filesProcessed  From the filesystem parser.
 * @property    {string[]}  filesToProcess  From the filesystem parser.
 * @property    {string}    mode            Run mode.
 * @property    {string}    sitePath        Path to the site.             
 */
class Context
{
    /**
     * Get the first author.
     * 
     * @return  {object}            Author object. 
     */
    getFirstAuthor()
    {
        if (!this.config.site.authors) {
            syslog.warning("You must define at lease one author.");
            return null;
        }

        return this.config.site.authors[Object.keys(this.config.site.authors)[0]];
    }

    /**
     * Get the various articles.
     * 
     * @param   {string}    type    Type of articles to get.
     * @return  {object[]}          Articles for request type. 
     */
    getArticles(type)
    {
        if (this.articles[type]) {
            return this.articles[type].values();
        }
        return [];
    }

    /**
     * Get the taxonomy type.
     * 
     * @param   {string}    type    Type of articles to get.
     * @return  {object[]}          Taxonomy type. 
     */
    getTaxonomyType(type)
    {
        if (this.articles.taxonomy[type]) {
            return this.articles.taxonomy[type].items;
        }
        return [];
    }

    /**
     * Get the articles for a taxonomy.
     * 
     * @param   {string}    type    Type of articles to get.
     * @param   {string}    tax     Taxonomy name.
     * @return  {object[]}          Articles for request type. 
     */
    getTaxonomy(type, name)
    {
        if (this.articles.taxonomy[type] && this.articles.taxonomy[type].hasTaxonomy(name)) {
            return this.articles.taxonomy[type].getTaxonomy(name);
        }
        return [];
    }

    /**
     * Generate a link.
     * 
     * @param   {string}    txt     Link text.
     * @param   {string}    url     Link URL.
     * @param   {string}    title   Link title (optional).
     * @return  {string}            Link HTML. 
     */
    link(txt, url, title)
    {
        let html = new Html('a');

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            if (!url.startsWith(path.sep)) {
                url = path.sep + url;
            }
            let aspec = this.config.articleSpec;
            if (aspec.terminateUrl) {
                if (url[-1] != aspec.terminateUrl) {
                    url += aspec.terminateUrl;
                }
            }
        }

        html.addParam('href', url);
        if (title) {
            html.addParam('title', title);
        }
        return html.resolve(txt);
    }

    /**
     * Fully qualify a URL.
     * 
     * @param   {string}    url     URL to qualify.
     * @return  {string}            Fully qualified URL.
     */
    qualify(url)
    {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }

        return urlp.resolve(this.config.site.url, url);
    }

    /**
     * Get an asset URL.
     * 
     * @param   {string}    asset       Asset to get.
     * @param   {boolean}   qualify     Fully qualify?
     * @return  {string}                URL to asset.
     */
    asset(asset, qualify = false)
    {
        if (asset.startsWith('http://') || asset.startsWith('https://')) {
            return asset;
        }

        let assetsUrl = this.config.site.assetsUrl;

        if (!asset.startsWith(path.sep)) {
            asset = path.sep + asset;
        }

        if (!asset.startsWith(assetsUrl)) {
            asset = path.join(assetsUrl, asset);
        }

        if (qualify) {
            return this.qualify(asset);
        }
        return asset;
    }

    /**
     * Basic image.
     * 
     * @param   {object}    spec    Image spec.
     * @param   {string}    title   Image title (optional).
     * 
     * @return  {string}            Image html,
     */
    imgBasic(spec, title)
    {
        if (title) {
            spec.title = title;
        }

        let srcName = (this.config.site.lazyload) ? 'data-src' : 'src';

        let html = new Html('img'); 

        for (let i in spec) {
            if (i == 'src' || i == 'url') {
                html.addParam(srcName, this.asset(spec[i]));
            } else {
                html.addParam(i, spec[i]);
            }
        }

        if (this.config.site.lazyload) {
            let lc = (this.config.site.lazyclass) ? this.config.site.lazyclass : 'lazyload';
            html.appendParam('class', lc);
        }

        return html.resolve();
    }

    /**
     * Slugify a string.
     *
     * @param   {string}    str     Input string.
     * @param   {object}    opts    Options.
     *
     * @return  {string}            Output string.
     */ 
    slugify(str, opts = {lower: true, strict: true, replacement: '-'})
    {
        return slugify(str, opts);
    }

    /**
     * Get an article's taxomony names array.
     * 
     * @param   {object}            article     Article in question.
     * @param   {string|string[]}   taxonomies  Taxonomies to get links for.
     * @return  {string[]}                      Array of taxonomies.
     */
    taxonomyNamesArray(article, taxonomies)
    {
        if (!taxonomies) {
            taxonomies = this.config.articleSpec.taxonomies;
        }

        taxonomies = makeArray(taxonomies);

        let result = [];

        for (let tax of taxonomies) {
            if (!this.config.articleSpec.taxonomies.includes(tax)) {
                throw new GreenhatSSGContextError(`Invalid taxonomy: ${tax}.`)
            }

            if (article[tax]) {
                let taxEnts = makeArray(article[tax]);

                for (let ent of taxEnts) {
                    result.push(ent);
                }
            }
        }

        return result;
    }

    /**
     * Get an article's taxomony names.
     * 
     * @param   {object}            article     Article in question.
     * @param   {string|string[]}   taxonomies  Taxonomies to get links for.
     * @return  {string}                        Comma separated taxonomy links.
     */
    taxonomyNames(article, taxonomies)
    {
        return this.taxonomyNamesArray(article, taxonomies).join(", ");
    }

    /**
     * Get a taxomony link.
     * 
     * @param   {string}            name        Name of taxonomy.
     * @param   {string}            taxonomy    Taxonomies to get link for.
     * @return  {string}                        Taxonomy link.
     */
    taxonomyLink(name, taxonomy)
    {
        let dir = path.join(path.sep, taxonomy, this.slugify(name), path.sep);
        let html = new Html('a');
        html.addParam('href', dir);
        return html.resolve(name);
    }

    /**
     * Get an article's taxomony links.
     * 
     * @param   {object}            article     Article in question.
     * @param   {string|string[]}   taxonomies  Taxonomies to get links for.
     * @return  {string}                        Comma separated taxonomy links.
     */
    taxonomyLinks(article, taxonomies)
    {
        if (!taxonomies) {
            taxonomies = this.config.articleSpec.taxonomies;
        }

        taxonomies = makeArray(taxonomies);

        let result = [];

        for (let tax of taxonomies) {
            if (!this.config.articleSpec.taxonomies.includes(tax)) {
                throw new GreenhatSSGContextError(`Invalid taxonomy: ${tax}.`)
            }

            if (article[tax]) {
                let taxEnts = makeArray(article[tax]);

                for (let ent of taxEnts) {
                    let dir = path.join(path.sep, tax, this.slugify(ent), path.sep);
                    let html = new Html('a');
                    html.addParam('href', dir);
                    result.push(html.resolve(ent));
                }
            }
        }

        return result.join(", ");
    }

    /**
     * Get an article's tag links.
     * 
     * @param   {object}            article     Article in question.
     * @return  {string}                        Comma separated taxonomy links.
     */
    tagLinks(article)
    {
        return this.taxonomyLinks(article, 'tags');
    }

    /**
     * Get the sharelinks for this article.
     * 
     * @param   {object}    article     Article to get links for.
     * @return  {string}                Share links. 
     */
    getShareLinks(article)
    {
        if (!this.hasPlugin('socialShares')) {
            syslog.warning("The 'socialShares' plugin is not loaded.");
            return;
        }

        let ret = '';

        let spec = this.config.socialSharesSpec;
    
        for (let item of spec.wanted) {
            if (!spec.linkDefs[item]) {
                syslog.warning(`No social share definition for ${item}.`, article.relPath);
                continue;
            }
    
            let img = new Html('img');
    
            let srcName = 'src'
            if (this.config.site.lazyload) {
                srcName = 'data-src';
                img.appendParam('class', this.config.site.lazyclass);
            }
    
            let p = path.join(spec.iconLoc, item + spec.iconExt);
    
            img.addParam(srcName, p);
            img.addParam('alt', "Share icon for " + item + ".");
    
            let link = spec.linkDefs[item];
    
            link = replaceAll(link, '[URL]', this.qualify(article.url));
            link = replaceAll(link, '[TITLE]', encodeURI(article.title));
            link = replaceAll(link, '[WSURL]', escape(this.qualify('/')));
            link = replaceAll(link, '[WSTITLE]', encodeURI(this.config.site.title));

            if (item == 'email') {
                if (!this.config.site.publisher.email) {
                    syslog.warning("Publisher email is requited for 'email' share.");
                } else {
                    link = replaceAll(link, '[EMAIL]', this.config.site.publisher.email);
                }
            }
    
            let a = new Html('a');
            a.addParam('href', link);
            if (item == 'permalink') {
                a.addParam('title', "Permalink for this article.");
            } else if (item == "email") {
                a.addParam('title', "Respond to the author of this article via email.");
            } else {
                a.addParam('title', "Share on " + item + ".");
            }
    
            ret += '<span class="sharelink">' + a.resolve(img) + '</span>';
        } 

        return ret;
    
    }

    /**
     * See if we have a particular plugin.
     * 
     * @param   {string}    name    Name to check.
     * @return  {boolean}           True if we do, else false. 
     */
    hasPlugin(name)
    {
        return this.pluginsLoaded.includes(name);
    }

    /**
     * Is this one of my own webmentions?
     * 
     * @param   {object}    webmention  To check.
     * @return  {boolean}               True if is, else false.
     */
    isOwnWebmention(webmention)
    {
        const urls = (this.config.webmentionsSpec.ownUrls) ? (this.config.webmentionsSpec.ownUrls) : 
            [this.config.site.url];
        const authorUrl = webmention['author'] ? webmention['author']['url'] : null;
        return authorUrl && urls.includes(authorUrl);
    }

    /**
     * Convert an ISO date to the readable format specified here.
     * 
     * @param   {string}    dt  Input date.
     * @return  {string}        Formatted date. 
     */
    convertDate(dt)
    {
        let dobj = new Date(dt);
        return dateformat(dobj, this.config.articleSpec.dispDate) + ', ' + 
        dateformat(dobj, this.config.articleSpec.dispTime);
    }

}

module.exports = Context;
