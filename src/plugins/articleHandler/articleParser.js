/**
 * @file        Article parser.
 * @module      ArticleParser
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const fs = require('fs');
const syslog = require('greenhat-util/syslog');
const Article = require('./article');
const YamlFile = require('greenhat-util/yaml');
const path = require('path');
const GreenHatSSGError = require('../../ssgError');
const ArticleContent = require('./parts/articleContent');
const ArticleDate = require('./parts/articleDate');
const Html = require("greenhat-util/html");
const ArticleCollection = require("./articleCollection");
const TaxonomyType = require('../../taxonomyType');
const ArticleSchema = require('./parts/articleSchema');
const { merge } = require("greenhat-util/merge");
const arr = require("greenhat-util/array");
const str = require("greenhat-util/string");
const BreadcrumbProcessor = require("./breadcrumbProcessor");

class GreenHatSSGArticleError extends GreenHatSSGError {}

/**
 * Article psrser class.
 */
class ArticleParser extends BreadcrumbProcessor
{
    /**
     * Constructor.
     * 
     * @param   {string}    ctx         Context.
     */
    constructor(ctx)
    {
        super();
        this.ctx = ctx;
    }

    /**
     * Do the parse.
     * 
     * @param   {string}    file    File to parse.
     * @return  {object}            Article object.
     */
    async parse(file)
    {
        this.file = file;

        // Initialisation.
        let data = this._extractFrontMatter();
        data = this._renameLegacyFieldNames(data);
        data = this._processType(data);
        data = this._processLayout(data);
        this._createArticle(data);

        this.ctx.emit('AFTER_ARTICLE_PARSER_INIT', this.article);

        // Run.
        this._checkDates();
        this._determineOutput();
        this._processReferences();
        this._processAuthors();
        this._processName();
        this._processHeadline();
        this._processSummary();
        this._processExcerpt();
        this._processMetaDescription();
        this._processCitations();
        this._processBreadcrumbs();
        this._processEffort();
        this._processPagination();
        this._processPublished();
        this._saveArticle();

        this.ctx.emit('AFTER_ARTICLE_PARSER_RUN', this.article);

        this._processSchema();

        //this.article.dump();

        if (this.article.arq) {
            this.ctx.queueForRender(this.article, 'njk');
        }

        return this.article;
    }

    /**
     * Process schema.
     */
    _processSchema()
    {
        let parser = new ArticleSchema(this.ctx, this.article);
        parser.parse();
        this.article.schema = parser.coll.resolve();
    }

    /**
     * Save the article.
     */
    _saveArticle()
    {
        if (!this.ctx.articles) {
            this.ctx.articles = {};    
            this.ctx.articles.all = new ArticleCollection();        
        }

        if (this.ctx.articles.all.has(this.article.url)) {
            syslog.warning(`There is already and article filed under URL ${this.article.url}. It will be overwritten.`)
        }
        this.ctx.articles.all.set(this.article.url, this.article);

        if (!this.ctx.articles.type) {
            this.ctx.articles.type = {};
        }

        if (!this.ctx.articles.type[this.article.type]) {
            this.ctx.articles.type[this.article.type] = new ArticleCollection();
        }

        this.ctx.articles.type[this.article.type].set(this.article.url, this.article);

        let ts = this.ctx.cfg.taxonomySpec;

        for (let taxType in ts) {
            if (this.article[taxType]) {
                if (!this.ctx.articles.taxonomy) {
                    this.ctx.articles.taxonomy = {};
                }
                if (!this.ctx.articles.taxonomy[taxType]) {
                    this.ctx.articles.taxonomy[taxType] = new TaxonomyType(taxType);
                }
                for (let tax of this.article[taxType]) {
                    if (!this.ctx.articles.taxonomy[taxType].hasTaxonomy(tax)) {
                        this.ctx.articles.taxonomy[taxType].addTaxonomy(tax);
                        //this.ctx.articles.taxonomy[taxType][tax] = new ArticleCollection();
                    }
                    //this.ctx.articles.taxonomy[taxType][tax].set(this.article.url, this.article);
                    this.ctx.articles.taxonomy[taxType].getTaxonomy(tax).addArticle(this.article);
                }
            }
        }

    }

    /**
     * Process published status.
     */
    _processPublished()
    {
        if (this.article.published) {
            return;
        }

        let now = Date.now();

        if (now > this.article.dates.published.ms) {
            this.article.published = true;
        } else {
            this.article.published = false;
        }
    }

    /**
     * Process pagination.
     */
    _processPagination()
    {
        if (!this.article.paginate) {
            return;
        }

        if (!this.ctx.paginate) {
            this.ctx.paginate = {};
        }

        this.ctx.paginate[this.article.url] = this.article.paginate;
    }

    /**
     * Process effort.
     */
    _processEffort()
    {
        let wpm = (this.ctx.cfg.site.wpm) ? this.ctx.cfg.site.wpm : 250;

        let words = 0;
        
        if (this.article.content && this.article.content.text) {
            words += str.countWords(this.article.content.text);
        }

        if (this.article.summary && this.article.summary.text) {
            words += str.countWords(this.article.summary.text);
        }

        this.article.words = words;

        if (words > 0) {
            this.article.readingTime = words / wpm;
            this.article.readingTimeRounded = Math.round(this.article.readingTime);
        } else {
            this.article.readingTime = 0;
            this.article.readingTimeRounded = 0;
        }

    }

    /**
     * Process breadcrumbs.
     */
    _processBreadcrumbs()
    {
        let bcs = null;
        if (this.article.breadcrumbs) {
            bcs = this.article.breadcrumbs;
        } else {
            let as = this.ctx.cfg.articleSpec;
            if (as.defaultBreadcrumbs) {
                bcs = as.defaultBreadcrumbs;
            } 
        }

        if (bcs) {
            let final = [];
            let sep = " &rarr; ";

            for (let elemKey in bcs) {
                let elem = bcs[elemKey];
                let ret = ArticleParser.processBreadcrumbElement(elem, this.article);

                if (!ret.skip) {
                    final.push({name: ret.name, url: ret.url});
                }
            }

            let bcstr = '';
            let count = 1;
            for (let item of final) {
                if (count == final.length) {
                    if (bcstr != '') bcstr += sep;
                    bcstr += item.name;
                } else {
                    if (bcstr != '') bcstr += sep;
                    let html = new Html('a');
                    html.addParam('href', this._sanitizeUrl(item.url));
                    bcstr += html.resolve(item.name);
                }
                count++;
            }

            this.article.bcStr = bcstr;
        } else {
            syslog.error("No breadcrumbs found for article.", this.article.relPath);
        }
    }

    /**
     * Process citations.
     */
    _processCitations()
    {
        if (!this.article.citation) {
            return;
        }

        let citationList = [];

        if (this.article.citation.url || this.article.citation.title) {
            this._processSingleCitation(this.article.citation);
            citationList.push(this.article.citation);
        } else {
            for (let key in this.article.citation) {
                this._processSingleCitation(this.article.citation[key]);
                citationList.push(this.article.citation[key])
            }
        }

        this.article.citationList = citationList;
    }

    /**
     * Process single citation.
     * 
     * @param   {object}    citation    Citation object.
     */
    _processSingleCitation(citation)
    {
        if (!citation.title) {
            syslog.error("Citations must have a title.", this.article.relPath);
            return;
        }

        if (!citation.url) {
            syslog.warning("Citations should have a URL.", this.article.relPath);
        }

        let str = '';

        if (citation.url) {
            str += this.ctx.link('<cite>' + citation.title + '</cite>', citation.url);
        } else {
            str += '<cite>' + citation.title + '</cite>';
        }

        if (citation.author) {
            let author = '';
            if (!Array.isArray(citation.author)) {
                let auth = citation.author;
                if (auth.url && auth.name) {
                    author = this.ctx.link(auth.name, auth.url);                        
                } else if (auth.name) {
                    author = auth.name;
                } else if (auth.url) {
                    author = this.ctx.link(auth.url, auth.url);
                } else {
                    author = auth;
                }
            } else {
                let authorArr = [];
                if (citation.author.name) {
                    authorArr.push(citation.author);
                } else {
                    for (let auth of citation.author) {
                        authorArr.push(auth);
                    }
                }

                for (let auth of authorArr) {
                    if (author != '') {
                        author += ', ';
                    }

                    if (auth.url && auth.name) {
                        author += this.ctx.link(auth.name, auth.url);                        
                    } else if (auth.name) {
                        author += auth.name;
                    } else if (auth.url) {
                        author += this.ctx.link(auth.url, auth.url);
                    } else {
                        author += auth;
                    }
                }
            }

            if (author != '') {
                str += ' ' + this.ctx.x('by') + ' ' + author;
            }
        }

        if (citation.site) {
            let on = ' ' + this.ctx.x('on') + ' ';
            if (citation.site.name || citation.site.url) {
                str += on + this.ctx.link(citation.site.name, citation.site.url);
            } else if (citation.site.name) {
                str += on + citation.site.name;
            } else if (citation.site.url) {
                str += on + this.ctx.link(citation.site.url, citation.site.url)
            } else {
                str += on + citation.site;
            }
        }

        citation.txt = str;
    }

    /**
     * Process meta description.
     */
    _processMetaDescription()
    {
        this.article.metaDescription = this.article.description;

        if (this.ctx.cfg.site.cleverDescriptions) {
            if (this.article.summary && !this.article.summaryIsList) {
                this.article.metaDescription = this.article.summary.text;
            } else {
                if (this.article.products) {
                    let pkeys = Object.keys(this.article.products);
                    if (pkeys.length == 1) {
                        let firstKey = pkeys[0];
                        if (this.article.reviews && this.article.reviews[firstKey]) {
                            this.article.metaDescription = this.article.reviews[firstKey].description;
                        }
                    }
                }
            }
        }

    }

    /**
     * Process the excerpt.
     */
    _processExcerpt()
    {
        this.article.excerptIsSpecified = true;
        if (!this.article.excerpt || this.article.excerpt.text == '') {
            this.article.excerptIsSpecified = false;
            this.article.excerpt = new ArticleContent(str.truncate(this.article.content.text, 100), this.article.relPath);
        }
        if (!this.article.excerptRss || this.article.excerptRss.text == '') {
            this.article.excerptRss = {...this.article.excerpt};
        }
    }

    /**
     * Process the summary.
     */
    _processSummary()
    {
        if (!this.article.summary) {
            return false;
        }

        if (Array.isArray(this.article.summary.md)) {
            this.article.summaryIsList = true;
        }
    }

    /**
     * Process the headline.
     */
    _processHeadline()
    {
        if (!this.article.headline) {
            this.article.headline = this.article.name;
        }
    }

    /**
     * Process the name.
     */
    _processName()
    {
        if (this.article.name) {
            return;
        }

        if (this.article.headline) {
            this.article.name = this.article.headline;
        } else {
            this.article.name = str.ucfirst(str.deslugify(this.article.baseop));
        }
    }

    /**
     * Process authors.
     */
    _processAuthors()
    {
        if (!this.article.author) {
            if (this.ctx.cfg.site.authors) {
                this.article.author = Object.keys(this.ctx.cfg.site.authors)[0];
            }
        }

        if (!this.article.author) {
            return;
        }

        this.article.author = arr.makeArray(this.article.author);

        let authObjs = [];

        for (let auth of this.article.author) {
            if (this.ctx.cfg.site.authors[auth]) {
                authObjs.push(this.ctx.cfg.site.authors[auth]);
            } else {
                authObjs.push({name: auth});
            }
        }

        this.article.authorObjs = authObjs;
    }

    /**
     * Proces references.
     */
    _processReferences()
    {
        if (!this.article.references) {
            return;
        }

        let refs = this.article.references;

        syslog.info(`Article ${this.article.relPath} has references.`);

        this.article.hasRefs = true;

        for (let index in refs) {
            let refFile = refs[index];
            let full = path.join(this.ctx.sitePath, refFile);

            if (!fs.existsSync(full)) {
                syslog.error(`Reference file '${refFile}' does not exist.`, this.article.relPath);
                continue;
            }

            let yamlFile = new YamlFile(full, {partial: true});
            let yamlData = yamlFile.parse();

            if (yamlData['products'] && yamlData['products'][index]) {
                if (!this.article.productRefs) {
                    this.article.productRefs = {};
                }
                let blah = {...yamlData['products'][index]};
                if (!blah['reviewUrl']) {
                    let type = (yamlData.type) ? yamlData.type : 'post';
                    let permalink = this._getPermalink((yamlData.permalink) ? yamlData.permalink : null, type);
                    let [published, modified] = this._getPublishedModifiedDates(full, type,
                        (yamlData.date) ? yamlData.date : null, (yamlData.mdate) ? yamlData.mdate : null)
                    let base = path.basename(refFile, path.extname(refFile));
                    let dir = path.dirname(refFile);
                    let [ofn, url, baseop] = this._getOutputLocations(type, permalink, published, base, dir,
                        (yamlData.isPlainFile) ? yamlData.isPlainFile : false)

                    blah['reviewUrl'] = url;
                }

                this.article.productRefs[index] = blah;
            }
    
            if (yamlData['reviews'] && yamlData['reviews'][index]) {
                if (!this.article.reviewRefs) {
                    this.article.reviewRefs = {};
                }
                this.article.reviewRefs[index] = yamlData['reviews'][index];
            }

            if (yamlData['images']) {
                if (!this.article.imageRefs) {
                    this.article.imageRefs = {};
                }
                for (let imgIndex in yamlData['images']) {
                    this.article.imageRefs[imgIndex] = yamlData['images'][imgIndex];
                }
            }
        }

    }

    /**
     * Get the permalink.
     * 
     * @param   {string}    articlePermalink    Permalink in the article. 
     * @param   {string}    type                Article type.
     * @return  {string}                        Permalink pattern.
     */
    _getPermalink(articlePermalink, type)
    {
        let as = this.ctx.cfg.articleSpec;
        let ts = as.types[type];

        let permalink = null;

        if (articlePermalink) {
            permalink = articlePermalink;
        } else if (ts.permalink) {
            permalink = ts.permalink;
        } else if (as.defaultPermalink) {
            permalink = as.defaultPermalink;
        } else {
            syslog.warning("No permalink found, will use a suitable default.", this.article.relPath);
            permalink = ':fn';
        }
        return permalink;
    }

    /**
     * Get the output filename, URL, base output.
     * 
     * @param   {string}    type            Article type.
     * @param   {string}    permalink       Permalink.
     * @param   {object}    published       Published date.
     * @param   {string}    basename        Article basename.
     * @param   {string}    dirname         Article dirname.
     * @param   {boolean}   isPlainFile     Is this a plain file?
     * @return  {string[]}                  [ofn, url, baseop]

     */
    _getOutputLocations(type, permalink, published, basename, dirname, isPlainFile)
    {
        let as = this.ctx.cfg.articleSpec;
        let ts = as.types[type];

        // Grab some replacement values.
        let month = published.month.toString();
        if (month.length == 1) month = '0' + month;
        let day = published.day.toString();
        if (day.length == 1) day = '0' + day;

        let fn = path.basename(basename, path.extname(basename));
        if (ts.fnGrabLen) {
            fn = fn.substring(ts.fnGrabLen + 1);
        }

        let baseop = fn;

        let reps = {
            year: published.year,
            month: month,
            day: day,
            fn: fn,
            path: dirname,
        }

        let ofn = permalink;
        for (let key in reps) {
            ofn = ofn.replace(':' + key, reps[key]);
        }
        ofn = path.join('/', ofn);

        // For the moment, just set the URL to the output filename.
        let url = ofn;

        // At this stage we have a raw output file without an extension.
        // We need to adjust this for our output mode.

        if (!isPlainFile) {

            let filePart = path.basename(ofn);

            if (filePart == as.indexFn) {
                ofn = ofn + as.outputExt;
                url = path.dirname(url);
            } else if (as.outputMode == 'directory') {
                ofn = path.join(ofn, as.indexFn + as.outputExt);
            } else {
                ofn = ofn + as.outputExt;
            }

            // Terminate the URL?
            if (as.terminateUrl && as.terminateUrl != '' && url.substring(-1) != as.terminateUrl) {
                url = url + as.terminateUrl;
            }
        }

        // Final add the _site directory to the output file name.
        ofn = path.join('/', ofn);

        return [ofn, url, baseop];
    }

    /**
     * Determine the output locations.
     */
    _determineOutput()
    {
        // Grab the permalink pattern.
        let permalink = this._getPermalink((this.article.permalink) ? this.article.permalink : null, 
            this.article.type);
        this.article.permalink = permalink;

        let [ofn, url, baseop] = this._getOutputLocations(this.article.type, permalink,
            this.article.dates.published, this.article.basename, this.article.dirname,
            (this.article.isPlainFile)? this.article.isPlainFile : false);

        this.article.baseop = baseop;
        this.article.outputFileName = ofn;
        this.article.url = url;

        syslog.trace('ArticleParser:_determineOutput', `(ofn => url): ${ofn} => ${url}`);
    }

    /**
     * Get the published and modified dates.
     * 
     * @param   {string}    file            File.
     * @param   {string}    type            Article type.
     * @param   {string}    userPubDate     The user published date.
     * @param   {string}    userModDate     The user modified date.
     * @return  {object[]}                  [published, modified] 
     */
    _getPublishedModifiedDates(file, type, userPubDate, userModDate)
    {
        let as = this.ctx.cfg.articleSpec;
        let stats = fs.statSync(file, true);

        let published = null;
        let modified = null;

        let relPath = file.replace(this.ctx.sitePath, '');
        if (relPath == '') {
            relPath = '/';
        }
        let basename = path.basename(relPath);

        if (userPubDate) {
            published = userPubDate;
        } else {
            let ts = as.types[type];
            if (ts.fnStart) {
                let regex =  new RegExp(ts.fnStart);
                if (regex.test(basename)) {
                    let len = (ts.fnGrabLen) ? ts.fnGrabLen : 10;
                    published = basename.substring(0, len);
                }
            } else {
                published = stats.birthtimeMs;
            }
        }

        if (userModDate) {
            modified = userModDate;
        } else {
            modified = stats.mtimeMs;
        }

        let pub = new ArticleDate(published, 'published', as.dispDate, as.dispTime);
        let mod = new ArticleDate(modified, 'modified', as.dispDate, as.dispTime);

        return [pub, mod];

    }

    /**
     * Check the dates.
     */
    _checkDates()
    {
        let as = this.ctx.cfg.articleSpec;
        //let stats = fs.statSync(this.file, true);

        if (this.article.dates) {
            syslog.warning("Article already has a 'dates' property. This will be overwritten.", this.article.relPath);
        }

        this.article.dates = {};

        let [published, modified] = this._getPublishedModifiedDates(this.file, this.article.type,
            (this.article.date) ? this.article.date : null, (this.article.mdate) ? this.article.mdate : null)

        this.article.dates.published = published;
        this.article.dates.modified = modified;

    }

    /**
     * Craete the article.
     * 
     * @param   {object}    data    Data do far.
     * @return  {object}            Current data.
     */
    _createArticle(data)
    {
        this.article = new Article(this.ctx);

        let as = this.ctx.cfg.articleSpec;

        for (let key in data) {
            if (as.multiFormat.includes(key)) {
                if (Array.isArray(data[key])) {
                    let tmp = '';
                    for (let item of data[key]) {
                        if (tmp != '') tmp += '\n';
                        tmp += '1. ' + item;
                    }
                    this.article[key] = new ArticleContent(tmp, this.file)
                } else {
                    this.article[key] = new ArticleContent(data[key], this.file);
                }
            } else {
                this.article[key] = data[key];
            }
        }
    }

    /**
     * Process the layout.
     * 
     * @param   {object}    data    Data do far.
     * @return  {object}            Current data.
     */
    _processLayout(data)
    {
        let as = this.ctx.cfg.articleSpec;

        let defCfg = {};
        if (as.types[data.type].defaultConfig) {
            defCfg = as.types[data.type].defaultConfig;
        }

        if (!data.layout) {
            data.layout = data.type;
        }

        data.layoutName = data.layout;

        if (!path.extname(data.layout)) {
            if (this.ctx.cfg.templateSpec && this.ctx.cfg.templateSpec.defaultType) {
                data.layout += '.' + this.ctx.cfg.templateSpec.defaultType;
            } else {
                data.layout += '.njk';
            }
        }

        data.layoutType = path.extname(data.layout).slice(1);

        data.layoutPath = this._locateLayout(data.layout);
        if (data.layoutPath == null) {
            throw new GreenHatSSGArticleError(`Unable to locate layout '${data.layout}'.`, data.relPath);
        }

        let ltd = false;
        if (this.file.includes('htaccess') || data.limited) {
            ltd = true;
        }

        // Grab the YAML from the layout.
        let yamlParser = new YamlFile(data.layoutPath, {open: '<!--@', close: '@-->', partial: true, limited: ltd});
        let layoutData = yamlParser.parse();

        // Merge all the data.
        let finalData = defCfg;
        //finalData = Object.merge(finalData, layoutData);
        //finalData = Object.merge(finalData, data);
        finalData = merge(finalData, layoutData);
        finalData = merge(finalData, data);

        return finalData;
    }

    /**
     * Locate the layout.
     * 
     * @param   {string}    layoutName      Layoutname.
     * @return  {string}                    Full path to layout or null if not found.                    
     */
    _locateLayout(layoutName)
    {

        let layoutPaths = [
            path.join(this.ctx.sitePath, this.ctx.cfg.locations.layouts),
            path.join(this.ctx.appPath, this.ctx.cfg.locations.sysLayouts),
        ];

        for (let p of layoutPaths) {
            let f = path.join(p, layoutName);
            if (fs.existsSync(f)) {
                return f;
            }
        }

        return null;
    }

    /**
     * Process the type.
     * 
     * @param   {object}    data    Data do far.
     * @return  {object}            Current data.
     */
    _processType(data)
    {
        data.relPath = this.file.replace(this.ctx.sitePath, '');
        if (data.relPath == '') {
            data.relPath = '/';
        }
        data.basename = path.basename(data.relPath);
        data.dirname = path.dirname(data.relPath);

        let as = this.ctx.cfg.articleSpec;

        if (!data.type) {

            if (!as.types && !as.defaultType) {
                throw new GreenHatSSGArticleError(`Article has no type and no default type is specified.`, 
                    data.relPath);
            }

            for (let key in as.types) {
                let item = as.types[key];
                let combine = (item.combineTest) ? item.combineTest : 'and';

                if (!item.fnStart && ! item.dirs) {
                    continue;
                }

                let st = (item.fnStart) ? new RegExp(item.fnStart).test(data.basename) : false;
                let ds = false;
                if (item.dirs) {
                    for (let d of item.dirs) {
                        if (data.relPath.startsWith(d)) {
                            ds = true;
                            break;
                        }
                    }
                }

                if (!st && !ds) {
                    continue;
                }

                if (combine == 'and' && st && ds) {
                    data.type = key;
                    break;
                } else if (combine == 'or' && (st || ds)) {
                    data.type = key;
                    break;
                }
            }

        }

        if (!data.type) {
            if (as.defaultType) {
                data.type = as.defaultType;
            } else {
                throw new GreenHatSSGArticleError("Cannot determine article type.", data.relPath);
            }
        }

        return data;
    }

    /**
     * Rename legacy field names.
     * 
     * @param   {object}    data    Current data.
     * @return  {object}            Updared data. 
     */
    _renameLegacyFieldNames(data)
    {
        if (data.title) {
            data.name = data.title;
            delete data.title
        }
        return data;
    }

    /**
     * Extract the front matter.
     * 
     * @return  {object}    Data extracted from file.
     */
    _extractFrontMatter()
    {
        let yamlParser = new YamlFile(this.file, {partial: true});
        let data = yamlParser.parse();
        data.content = yamlParser.content;
        if (!data.contentRss) {
            data.contentRss = yamlParser.content;
        }
        return data;
    }
}

module.exports = ArticleParser;