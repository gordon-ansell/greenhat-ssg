/**
 * @file        GreenHat SSG context.
 * @module      Context
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { syslog } = require("greenhat-util/syslog");
const EventManager = require('greenhat-util/event');
const GreenHatSSGError = require('./ssgError');
const Html = require("greenhat-util/html");
const path = require('path');
const urlp = require("url");
const dateformat = require("dateformat");
const fs = require('fs');

require("greenhat-util/array");

class GreenHatSSGContextError extends GreenHatSSGError {}

/**
 * Context class.
 * 
 * @property    {object}    args    Command line args.
 * @property    {object}    cfg     Configs.        
 * 
 */
class Context extends EventManager
{
    // Callables.
    callables = {};

    // Template filters.
    tplFilters = {};

    // Template paths.
    tplPaths = null;

    // Dummy paths.
    tplDummies = null;

    /**
     * Constructor.
     */
    constructor()
    {
        super();
        this.renderQueue = [];
    }

    /**
     * Add a template filter.
     * 
     * @param   {string}    name    Filter name.
     * @param   {function}  func    Callable function.
     */
    addTemplateFilter(name, func)
    {
        this.tplFilters[name] = func;
    }

    /**
     * Add the default template paths.
     */
    _addDefaultTemplatePaths()
    {
        if (this.tplPaths == null) {
            this.tplPaths = [];
            this.tplPaths.push(path.join(this.sitePath, this.cfg.locations.layouts));
            this.tplPaths.push(path.join(this.appPath, this.cfg.locations.sysLayouts));
        }
    }

    /**
     * Add template path.
     * 
     * @param   {string}    path    Path to add.
     * @param   {boolean}   pre     Prepend?
     */
    addTemplatePath(path, pre = false)
    {
        this._addDefaultTemplatePaths();

        if (pre) {
            this.tplPaths.unshift(path);
        } else {
            this.tplPaths.push(path);
        }
    }

    /**
     * Get the template paths.
     * 
     * @return  {string[]}          Array of template paths.
     */
    getTemplatePaths()
    {
        this._addDefaultTemplatePaths();
        return this.tplPaths;
    }

    /**
     * Add the default template dummy paths.
     */
    async _addDefaultTemplateDummyPaths()
    {
        if (this.tplDummies == null) {
            this.tplDummies = [];
            this.tplDummies.push(path.join(this.sitePath, this.cfg.locations.layouts, 'dummies'));
            this.tplDummies.push(path.join(this.appPath, this.cfg.locations.sysLayouts, 'dummies'));
        }
    }

    /**
     * Add template dummy path.
     * 
     * @param   {string}    path    Dummy path to add.
     * @param   {boolean}   pre     Prepend?
     */
    async addTemplateDummyPath(path, pre = false)
    {
        await this._addDefaultTemplateDummyPaths();

        if (pre) {
            this.tplDummies.unshift(path);
        } else {
            this.tplDummies.push(path);
        }
    }

    /**
     * Get the template dummy paths.
     * 
     * @return  {string[]}          Array of template dummy paths.
     */
    async getTemplateDummyPaths()
    {
        await this._addDefaultTemplateDummyPaths();
        return this.tplDummies;
    }

    /**
     * Find a dummy template.
     * 
     * @param   {string}    file    Template file to look for.
     * @return  {string}            Path to file or null if not found.
     */
    async findTemplateDummy(file)
    {
        let fn = null;
        for (let p of await this.getTemplateDummyPaths()) {
            if (fs.existsSync(path.join(p, file))) {
                fn = path.join(p, file);
                break;
            }
        }  
        return fn;  
    }

    /**
     * Get the first author.
     * 
     * @return  {object}            Author object. 
     */
    getFirstAuthor()
    {
        if (!this.cfg.site.authors) {
            syslog.warning("You must define at lease one author.");
            return null;
        }

        return this.cfg.site.authors[Object.keys(this.cfg.site.authors)[0]];
    }

    /**
     * Add an article callable.
     * 
     * @param   {function}  func    Function to be called.
     */
    addContextCallable(func)
    {
        this.callables[func.name] = func;
    }

    /**
     * See if we have a callable.
     * 
     * @param   {string}    name    Callable name.
     * @return  {boolean}           True if we have it, else false.
     */
    hasCallable(name) 
    {
        if (this.callables[name]) {
            return true;
        }
        return false;
    }

    /**
     * Do an article call.
     * 
     * @param   {string}    func        Name of the function.
     * @param   {any}       args        Arguments.
     * @return  {any}                   Whatever.
     */
    callable(func, ...args)
    {
        if (!this.callables[func]) {
            throw new GreenHatSSGContextError(`No article callable with name '${func}' found.`);
        }

        return this.callables[func].call(this, ...args);
    }

    /**
     * Translate.
     * 
     * @param   {string}    key     Key to translate.
     * @param   {number}    count   Count.
     * @return  {string}            Translated string. 
     */
    x(key, count = 1)
    {
        if (!this.xlator) {
            throw new GreenHatSSGContextError("No language translations defined.");
        }
        return this.xlator.x(key, count);
    }

    /**
     * Set an extension parser.
     * 
     * @param   {string|string[]}   exts        Extension(s).
     * @param   {callable}          parser      Parser function to call.
     * @return  {callable|string}               Previous parser.
     */
    setExtensionParser(exts, parser)
    {
        let saved = null;
        exts = Array.makeArray(exts);
        for (let ext of exts) {
            if (typeof parser != 'function') {
                syslog.error(`Invalid parser for extension '${ext}'. It will be ignored.`);
                continue;
            }

            syslog.trace('Context:setExtensionParser', `Setting extension parser for '${ext}'.`);

            if (this.cfg.parsers[ext]) { 
                syslog.warning(`There is already a parser for extension '${ext}': ${this.cfg.parsers[ext].name}. We'll overwrite it.`);
                saved = this.cfg.parsers[ext];
            }
            this.cfg.parsers[ext] = parser;
        }

        return saved;
    }

    /**
     * Set an extension renderer.
     * 
     * @param   {string|string[]}   exts        Extension(s).
     * @param   {callable}          renderer    Renderer function to call.
     * @return  {callable|string}               Previous renderer.
     */
    setExtensionRenderer(exts, renderer)
    {
        let saved = null;
        exts = Array.makeArray(exts);
        for (let ext of exts) {
            if (typeof renderer != 'function') {
                syslog.error(`Invalid renderer for extension '${ext}'. It will be ignored.`);
                continue;
            }
            if (this.cfg.renderers[ext]) { 
                syslog.warning(`There is already a renderer for extension '${ext}'. We'll overwrite it.`);
                saved = this.cfg.renderers[ext];
            }
            this.cfg.renderers[ext] = renderer;
        }

        return saved;
    }

    /**
     * Queue something to be rendered.
     * 
     * @param   {any}       obj         Item to be rendered. 
     * @param   {string}    renderExt   Render extension.
     */
    queueForRender(obj, renderExt)
    {
        this.renderQueue.push({obj: obj, renderExt: renderExt});
    }

    /**
     * Generate a link.
     * 
     * @param   {string}            txt     Link text.
     * @param   {string|object}     url     Link URL or object with all fields.
     * @param   {string}            title   Link title (optional).
     * @param   {string}            cls     Class (optional).
     * @return  {string}                    Link HTML. 
     */
    link(txt, url, title, cls)
    {
        let html = new Html('a');

        let href;

        if (typeof url == "object") {
            if (!url.url && !url.href) {
                throw new GreenHatSSGContextError("Link needs an 'href' or 'url' specification.");
            } else if (url.url) {
                href = url.url;
                delete url.url;
            } else if (url.href) {
                href = url.href;
                delete uel.href;
            }
        } else {
            href = url;
        }

        if (!href.startsWith('http://') && !href.startsWith('https://')) {
            if (!href.startsWith(path.sep)) {
                href = path.sep + href;
            }
            let aspec = this.cfg.articleSpec;
            if (aspec.terminateUrl) {
                if (href.substr(-1) != aspec.terminateUrl) {
                    href += aspec.terminateUrl;
                }
            }
        }

        html.addParam('href', href);

        if (typeof url == "object") {
            for (let key in url) {
                html.addParam(key, url[key]);
            }
        }

        if (title) {
            html.addParam('title', title);
        }
        if (cls) {
            html.addParam('class', cls);
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

        return urlp.resolve(this.cfg.site.url, url);
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

        let assetsUrl = this.cfg.site.assetsUrl;

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
     * @param   {string}    cls     Class (optional),
     * @return  {string}            Image html,
     */
    img(spec, title, cls)
    {
        if (title) {
            spec.title = title;
        }

        let srcName = (this.cfg.site.lazyload) ? 'data-src' : 'src';

        let html = new Html('img'); 

        for (let i in spec) {
            if (i == 'src' || i == 'url') {
                html.addParam(srcName, this.asset(spec[i]));
            } else {
                html.addParam(i, spec[i]);
            }
        }

        if (this.cfg.site.lazyload) {
            let lc = (this.cfg.site.lazyclass) ? this.cfg.site.lazyclass : 'lazyload';
            html.appendParam('class', lc);
        }

        if (cls) {
            html.appendParam('class', cls);
        }

        return html.resolve();
    }

    /**
     * See if we have a plugin.
     * 
     * @param   {string}    name    Plugin name.
     * @return  {boolean}           True if it's loaded.
     */
    hasPlugin(name)
    {
        return (name in this.plugins) ? true : false;
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
            return this.articles.taxonomy[type].sortByCount().items;
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
     * Is this one of my own webmentions?
     * 
     * @param   {object}    webmention  To check.
     * @return  {boolean}               True if is, else false.
     */
    isOwnWebmention(webmention)
    {
        const urls = (this.cfg.webmentionsSpec.ownUrls) ? (this.cfg.webmentionsSpec.ownUrls) : 
            [this.cfg.site.url];
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
        return dateformat(dobj, this.cfg.articleSpec.dispDate) + ', ' + 
        dateformat(dobj, this.cfg.articleSpec.dispTime);
    }

    /**
     * Log.
     * 
     * @param   {string}    str     String to log.
     * @param   {string}    level   Log level.
     */
    log(str, level = "info")
    {
        syslog.log(level, str);
    }

    /**
     * Inspect.
     * 
     * @param   {any}       thing   Thing to inspect.
     * @param   {string}    level   Level.
     */
    inspect(thing, level = "advice")
    {
        syslog.inspect(thing, level);
    }
}

module.exports = Context;
