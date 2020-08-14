/**
 * @file        Article parser.
 * @module      article/ArticleParser
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const Article = require('./article');
const ArticleContent = require('./articleContent');
const ArticleDate = require('./articleDate');
const { YamlFile, syslog, merge, makeArray, Html } = require('greenhat-base');
const fs = require('fs');
const path = require('path');
const GreenhatSSGError = require('../greenhatSSGError');
const ArticleSchema = require('./articleSchema');
const { articleDefault } = require('../defaultConfig');

class GreenhatSSGArticleError extends GreenhatSSGError {};

/**
 * Article parser class.
 */
class ArticleParser
{
    /**
     * Constructor.
     *
     * @param   {string}    filePath    Path to the SCSS file.
     * @param   {string}    sitePath    Absolute path to site.
     * @param   {string}    appPath     Application path.
     * @param   {object}    ctx         Context.
     */
    constructor(filePath, sitePath, appPath, ctx)
    {
        this._filePath = filePath;
        this._sitePath = sitePath;
        this._appPath = appPath;
        this._ctx = ctx;
        this._config = ctx.config;
        //this._article = new Article(this._filePath, this._sitePath);
    }

    /**
     * Initialise it.
     * 
     * @return  {object}        The article class instance.
     */
    async init()
    {
        let data = this._extractFrontMatter();
        this._processType(data);
        this._createArticle(data);

        return this._article;
    }

    /**
     * Parse it.
     * 
     * @return  {object}        The article class instance.
     */
    async parse()
    {
        this._checkDates();
        this._determineUrl();
        this._processReferences();
        this._processAuthors();
        this._processTitle();
        this._processSummary();
        this._processMetaDescription();
        this._processCitations();
        this._processBreadcrumbs();
        this._processEffort();
        //this._processSchema();

        return this._article;
    }

    /**
     * Process the schema.
     */
    processSchema()
    {
        let parser = new ArticleSchema(this._ctx, this._article);
        parser.parse();
        this._article.schema = JSON.stringify(parser.schema);
    }

    /**
     * Process effort.
     */
    _processEffort()
    {
        let wpm = (this._config.site.wpm) ? this._config.site.wpm : 250;

        let words = 0;
        
        if (this._article.content && this._article.content.text) {
            words += this._article.content.text.countwords();
        }

        if (this._article.summary && this._article.summary.text) {
            words += this._article.summary.text.countwords();
        }

        this._ctx.counts.words += words;

        this._article.words = words;

        if (words > 0) {
            this._article.readingTime = words / wpm;
            this._article.readingTimeRounded = Math.round(this._article.readingTime);
        } else {
            this._article.readingTime = 0;
            this._article.readingTimeRounded = 0;
        }
    }

    /**
     * Process the breadcrumbs.
     */
    _processBreadcrumbs()
    {
        let spec = this._config.site.breadcrumbSpec;
        let taxonomies = this._config.articleSpec.taxonomies;

        let bc = spec.format;
        if (this._article.breadcrumbSpec) {
            bc = this._article.breadcrumbSpec;
        }

        if (Array.isArray(bc)) {

            let bcStr = '';

            for (let part of bc) {
                switch (part) {
                    case ':home':
                        let home = new Html('a');
                        home.addParam('href', path.sep);
                        if (bcStr != '') bcStr += spec.sep;
                        bcStr += home.resolve('Home');
                        break;
                    case ':dir':
                        let dirname = this._article.dirname;
                        if (dirname[0] == path.sep) dirname = dirname.substr(1);
                        let sp = dirname.split(path.sep);
                        let link = '';
                        let sofar = '';
                        for (let sl of sp) {
                            sofar = path.join(sofar, sl);
                            if (link != '') {
                                link += spec.sep;
                            }
                            if (sofar.substr(-1) == path.sep) {
                                sofar = sofar.substr(0, sofar.length - 1);
                            }
                            link += this._ctx.link(sl.ucfirst(), sofar);
                        }
                        if (bcStr != '') bcStr += spec.sep;
                        bcStr += link;
                        break;
                    case 'tags':
                        let tags = new Html('a');
                        tags.addParam('href', '/tags/');
                        if (bcStr != '') bcStr += spec.sep;
                        bcStr += tags.resolve('Tags');
                        break;
                    case ':tags0':
                        if (this._article.tags && this._article.tags.length > 0) {
                            let taxLink1 = this._ctx.taxonomyLink(this._article['tags'][0], 'tags');
                            if (bcStr != '') bcStr += spec.sep;
                            bcStr += taxLink1;
                        }
                        break;
                    case ':tags1':
                        if (this._article.tags && this._article.tags.length > 1) {
                            let taxLink2 = this._ctx.taxonomyLink(this._article['tags'][1], 'tags');
                            if (bcStr != '') bcStr += spec.sep;
                            bcStr += taxLink2;
                        }
                        break;
                    case ':title':
                        if (bcStr != '') bcStr += spec.sep;
                        bcStr += this._article.title;
                        break;
                    default:
                        if (bcStr != '') bcStr += spec.sep;
                        bcStr += part;
                }
            }

            this._article.breadcrumbs = bcStr;

        } else {

            syslog.error("Breadcrumbs must be an array.", this._article.relPath);

            /*
            let home = new Html('a');
            home.addParam('href', path.sep);
            bc = bc.replace(':home', home.resolve('Home'));

            for (let taxType of taxonomies) {
                if (this._article[taxType]) {
                    for (let i = 0; i < 2; i++) {
                        let name = ':' + taxType + i;
                        if (this._article[taxType][i]) {
                            let taxLink = this._ctx.taxonomyLink(this._article[taxType][i], 'tags');
                            if (bc != '') {
                                taxLink = spec.sep + taxLink;
                            }
                            bc = bc.replace(name, taxLink)
                        } else {
                            bc = bc.replace(name, '');
                        }
                    }
                } else {
                    let name = ':' + taxType;
                    bc = bc.replace(name + '0', '').replace(name + '1', '');
                }
            }

            let title = this._article.title;
            if (bc != '') {
                title = spec.sep + title;
            }
            bc = bc.replace(':title', title);

            this._article.breadcrumbs = bc;
            */
        }

    }

    /**
     * Process single citation.
     * 
     * @param   {object}    citation    Citation object.
     */
    _processSingleCitation(citation)
    {
        if (!citation.title) {
            syslog.error("Citations must have a title.", this._article.relPath);
            return;
        }

        if (!citation.url) {
            syslog.warning("Citations should have a URL.", this._article.relPath);
        }

        let str = '';

        if (citation.url) {
            str += this._ctx.link('<cite>' + citation.title + '</cite>', citation.url);
        } else {
            str += '<cite>' + citation.title + '</cite>';
        }

        if (citation.author) {
            let author = '';
            if (!Array.isArray(citation.author)) {
                let auth = citation.author;
                if (auth.url && auth.name) {
                    author = this._ctx.link(auth.name, auth.url);                        
                } else if (auth.name) {
                    author = auth.name;
                } else if (auth.url) {
                    author = this._ctx.link(auth.url, auth.url);
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
                        author += this._ctx.link(auth.name, auth.url);                        
                    } else if (auth.name) {
                        author += auth.name;
                    } else if (auth.url) {
                        author += this._ctx.link(auth.url, auth.url);
                    } else {
                        author += auth;
                    }
                }
            }

            if (author != '') {
                str += ' by ' + author;
            }
        }

        if (citation.site) {
            if (citation.site.name || citation.site.url) {
                str += ' on ' + this._ctx.link(citation.site.name, citation.site.url);
            } else if (citation.site.name) {
                str += ' on ' + citation.site.name;
            } else if (citation.site.url) {
                str += ' on ' + this._ctx.link(citation.site.url, citation.site.url)
            } else {
                str += ' on ' + citation.site;
            }
        }

        citation.txt = str;
    }

    /**
     * Process citations.
     */
    _processCitations()
    {
        if (!this._article.citation) {
            return;
        }

        let citationList = [];

        if (this._article.citation.url || this._article.citation.title) {
            this._processSingleCitation(this._article.citation);
            citationList.push(this._article.citation);
        } else {
            for (let key in this._article.citation) {
                this._processSingleCitation(this._article.citation[key]);
                citationList.push(this._article.citation[key])
            }
        }

        this._article.citationList = citationList;
    }

    /**
     * Process meta description.
     */
    _processMetaDescription()
    {
        this._article.metaDescription = this._article.description;

        if (this._config.site.cleverDescriptions) {
            if (this._article.summary && !this._article.summaryIsList) {
                this._article.metaDescription = this._article.summary.text;
            } else {
                if (this._article.products) {
                    let pkeys = Object.keys(this._article.products);
                    if (pkeys.length == 1) {
                        let firstKey = pkeys[0];
                        if (this._article.reviews && this._article.reviews[firstKey]) {
                            this._article.metaDescription = this._article.reviews[firstKey].description;
                        }
                    }
                }
            }
        }
    }

    /**
     * Process the summary.
     */
    _processSummary()
    {
        if (!this._article.summary) {
            return false;
        }

        if (Array.isArray(this._article.summary.md)) {
            this._article.summaryIsList = true;
        }
    }

    /**
     * Process the title.
     */
    _processTitle()
    {
        if (!this._article.title) {
            syslog.warning("Article has no title.", this._article.relPath)        
        }

        if (this._article.title && !this._article.headline) {
            this._article.headline = this._article.title;
        }
    }

    /**
     * Process the authors.
     */
    _processAuthors()
    {
        if (!this._article.author && this._config.site.authors) {
            let key = Object.keys(this._config.site.authors)[0];
            this._article.author = key;
        }


        if (this._article.author) {
            this._article.author = makeArray(this._article.author);

            let result = {};

            for (let key of this._article.author) {
                if (this._config.site.authors && this._config.site.authors[key]) {
                    result[key] = this._config.site.authors[key];
                } else {
                    result[key] = {name: this._article.author[key]};
                }
            }

            this._article.author = result;
        }

    }

    /**
     * Process references.
     */
    _processReferences()
    {
        if (!this._article.references) {
            return;
        }

        let refs = this._article.references;

        syslog.info("Article " + this._article.relPath + " has references.");

        this._article.hasRefs = true;

        for (let index in refs) {
            let refFile = refs[index];
            let full = path.join(this._sitePath, refFile);

            if (!fs.existsSync(full)) {
                syslog.error("Reference file '" + refFile + "' does not exist.", this._article.relPath);
                continue;
            }

            let yamlFile = new YamlFile(full, {partial: true});
            let yamlData = yamlFile.parse();

            if (yamlData['products'] && yamlData['products'][index]) {
                if (!this._article.productRefs) {
                    this._article.productRefs = {};
                }
                let blah = {...yamlData['products'][index]};
                if (!blah['reviewUrl']) {
                    let base = path.basename(refFile, path.extname(refFile));
                    blah['reviewUrl'] = path.join('/', base.substring(11));
                }

                this._article.productRefs[index] = blah;
            }
    
            if (yamlData['reviews'] && yamlData['reviews'][index]) {
                if (!this._article.reviewRefs) {
                    this._article.reviewRefs = {};
                }
                this._article.reviewRefs[index] = yamlData['reviews'][index];
            }

            if (yamlData['images']) {
                if (!this._article.imageRefs) {
                    this._article.imageRefs = {};
                }
                for (let imgIndex in yamlData['images']) {
                    this._article.imageRefs[imgIndex] = yamlData['images'][imgIndex];
                }
            }
        }

        //syslog.inspect(this._article.productRefs);
        //syslog.inspect(this._article.reviewRefs);
        //syslog.inspect(this._article.imageRefs);
    }

    /**
     * Determine the URL.
     */
    _determineUrl()
    {
        // Grab the spec.
        let articleSpec = this._config.articleSpec;

        // Grab the permalink, either one specified or the default.
        let permalink = (this._article.permalink) ? this._article.permalink : 
            articleSpec.types[this._article.type].permalink;

        // Grab some date-related stuff for permalink replacements.
        let year = this._article.dates.published.year;
        let month = this._article.dates.published.month.toString();
        if (month.length == 1) {month = "0" + month};
        let day = this._article.dates.published.day.toString();
        if (day.length == 1) {day = "0" + day};

        // Grab the filename for permalink replacement.
        let fn = this._article.basename;
        if (this._article.type == 'post' && articleSpec.posts.postFnStart) {
            fn = this._article.basename.substr(articleSpec.posts.postFnGrabLen + 1);
        }
        fn = path.basename(fn, path.extname(fn));

        // Grab the path for permalink replacement.
        let pth = path.dirname(this._article.relPath);

        // Replace all but the filename.
        this._article.url = permalink.replace(':year', year).replace(':month', month).replace(':day', day)
            .replace(':path', pth);

        // With the filename, we don't want it for indexes.
        if (fn != 'index') {
            this._article.url = this._article.url.replace(':fn', fn);
        } else {
            this._article.url = this._article.url.replace(':fn', '');
        }

        // Remove any double // we find.
        this._article.url = this._article.url.replace('//', '/');

        // Add a / on the front if necessary.
        if (this._article.url[0] != path.sep) this._article.url = path.sep + this._article.url; 

        // Add any terminators, possibly a trailing /.
        if (this._article.url[this._article.url.length - 1] != articleSpec.terminateUrl) {
            if (!this._article.isPlainFile) {
                this._article.url += articleSpec.terminateUrl;
            }
        }

        // Output mode.
        if (articleSpec.outputMode == "directory" && !this._article.isPlainFile) {
            this._article.outputRelPath = path.join(this._article.url, articleSpec.indexFn);
        } else {
            if (this._article.isPlainFile) {
                this._article.outputRelPath = this._article.url;
            } else {
                this._article.outputRelPath = this._article.url + articleSpec.outputExt;
            }
        }

        syslog.trace("ArticleParser._determineUrl", 
            `URL <=> Output Path: ${this._article.url} <=> ${this._article.outputRelPath}`);
    }

    /**
     * Check dates.
     */
    _checkDates()
    {
        let articleSpec = this._config.articleSpec;

        // Get the file stats.
        let stats = fs.statSync(this._filePath, true);
        //syslog.inspect(stats);

        // New structure.
        if (!this._article.dates) {
            this._article.dates = {};
        }

        // Published.
        if (this._article.date) {
            this._article.dates.published = new ArticleDate(this._article.date, "published", 
                articleSpec.dispDate, articleSpec.dispTime);
        } else {
            let regex =  new RegExp(articleSpec.posts.postFnStart);
            if (this._article.type == 'post' && articleSpec.posts.postFnStart && regex.test(this._article.basename)) {
                let ex = this._article.basename.substring(0, articleSpec.posts.postFnGrabLen);
                this._article.dates.published = new ArticleDate(ex, "published", 
                    articleSpec.dispDate, articleSpec.dispTime);
            } else {
                this._article.dates.published = new ArticleDate(stats.birthtimeMs, "published", 
                    articleSpec.dispDate, articleSpec.dispTime);
            }
        }

        // Modified.
        if (this._article.mdate) {
            this._article.dates.modified = new ArticleDate(this._article.mdate, "modified", 
                articleSpec.dispDate, articleSpec.dispTime);
        } else {
            this._article.dates.modified = new ArticleDate(stats.mtimeMs, "modified", 
                articleSpec.dispDate, articleSpec.dispTime);
        }

    }

    /**
     * Locate the layout.
     * 
     * @param   {string}    layoutName      Layoutname.
     * @return  {string}                    Full path to layout or null if not found.                    
     */
    _locateLayout(layoutName)
    {
        let ts = this._config.templateSpec[this._config.templateSpec.type];
        layoutName += ts.ext;

        let layoutPaths = [
            path.join(this._sitePath, this._config.dirs.layouts),
            path.join(this._appPath, this._config.dirs.sysLayouts),
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
     * Create the article.
     * 
     * @param   {object}    data    Article data.
     */
    _createArticle(data)
    {
        // Default data.
        let defaultData = this._config.articleDefault;

        // Determine the layout.
        if (!data.layout) {
            data.layout = data.type;
        } 

        // Locate the layout.
        let layoutPath = this._locateLayout(data.layout);
        if (layoutPath === null) {
            throw new GreenhatSSGArticleError(`Unable to find layout '${data.layout}'.`, data.relPath);
        }
        data.layoutPath = layoutPath;

        // Limited?
        let ltd = false;
        if (this._filePath.includes('htaccess') || data.limited) {
            ltd = true;
        }

        // Grab the YAML from the layout.
        let yamlParser = new YamlFile(layoutPath, {open: '<!--@', close: '@-->', partial: true, limited: ltd});
        let layoutData = yamlParser.parse();

        // Merge all the data in order.
        let finalData = defaultData;
        finalData = merge(finalData, layoutData);
        finalData = merge(finalData, data);

        // Create the article.
        this._article = new Article(this._filePath, this._sitePath, this._ctx);

        // Copy the data into the article.
        for (let key in finalData) {
            if (this._config.articleSpec.multiFormat.includes(key)) {
                if (Array.isArray(finalData[key])) {
                    let tmp = '';
                    for (let item of finalData[key]) {
                        if (tmp != '') tmp += '\n';
                        tmp += '1. ' + item;
                    }
                    this._article[key] = new ArticleContent(tmp, this._filePath)
                } else {
                    this._article[key] = new ArticleContent(finalData[key], this._filePath);
                }
            } else {
                this._article[key] = finalData[key];
            }
        }

    }

    /**
     * Deal with article type.
     * 
     * @param   {object}    data    Article data.
     */
    _processType(data)
    {
        data.relPath = this._filePath.replace(this._sitePath, '');
        data.basename = path.basename(data.relPath);
        data.dirname = path.dirname(data.relPath);

        if (data.type) {
            return;
        }     

        let articleSpec = this._config.articleSpec;
        
        let isPost = false;        

        let fnStart = (articleSpec.posts.postFnStart) ? 
            new RegExp(articleSpec.posts.postFnStart).test(data.basename) :
            true;

        let loc = false;
        if (articleSpec.posts.postDirs) {
            for (let item of articleSpec.posts.postDirs) {
                if (data.relPath.startsWith(item)) {
                    loc = true;
                    break;
                }
            }
        } else {
            loc = true;
        }

        let combine = (articleSpec.posts.postCombineTest) ? articleSpec.posts.postCombineTest : 'and';

        if ((combine == 'and' && (fnStart && loc)) || (combine == 'or' && (fnStart || loc))) {
            isPost = true;
        }

        if (isPost) {
            data.type = 'post';
        } else {
            data.type = 'page';
        }
    }

    /**
     * Extract the front matter.
     * 
     * @return  {object}     Data object.
     */
    _extractFrontMatter()
    {
        let yamlParser = new YamlFile(this._filePath, {partial: true});
        let data = yamlParser.parse();
        data.content = yamlParser.content;
        data.contentRss = yamlParser.content;
        return data;
    }
}

module.exports = ArticleParser;