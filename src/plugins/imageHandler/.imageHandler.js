/**
 * @file        Image handler plugin.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const syslog = require('greenhat-util/syslog');
const ImageParser = require('./imageParser');
const ImagePrerenderer = require('./imagePrerenderer');
const path = require('path');
const fs = require('fs');
const { merge } = require("greenhat-util/merge");
const { copyDir, mkdirRecurse } = require('greenhat-util/fs');

/**
 * Parse image.
 *
 * @param   {string}  file  Image file.
 */
async function parse(file)
{
    let c = new ImageParser(file, this);
    await c.parse();
    this.counts.images++;
}

/**
 * Prerender images.
 * 
 * @param   {object}   article  Article.
 */
async function articlePrerender(article)
{
    let p = new ImagePrerenderer(this);
    await p.prerender(article);
}

/**
 * Called before early parse starts.
 * Implicit this pointer passed.
 */
async function beforeParseEarly()
{
    syslog.trace('.imageHandler:beforeParseEarly', 'Event intercepted.');

    this.counts.images = 0;

    let cacheChk = (this.args.noImageCacheCheck === true) ? false : true;

    if (cacheChk) {
        if (!this.watch) {
            syslog.notice("Parsing images.");
        }
    } else {
        if (!this.watch) {
            syslog.notice("Parsing images (no cache check).");
        }
    }

    if (cacheChk) {
        if (this.cfg.imageSpec.cacheMds) {
            syslog.trace('.imageHandler:createParserClass', 'We are cacheing MDs.')
            let cacheFile = path.join(this.sitePath, this.cfg.locations.cache, 'images.json');
            let cache = {};
            if (fs.existsSync(cacheFile)) {
                cache = JSON.parse(fs.readFileSync(cacheFile));
            }
            ImageParser.cache = cache;
            ImageParser.cacheCheck = true;
        }
    }
}

/**
 * Called when early parse is finished.
 * Implicit this pointer passed.
 */
async function afterParseEarly()
{
    syslog.trace('.imageHandler:afterParseEarly', 'Event intercepted.');

    if (ImageParser.cache !== null) {
        syslog.trace('.imageHandler:afterParseEarly', 'Writing back image cache.');
        let cdir = path.join(this.sitePath, this.cfg.locations.cache);
        let cacheFile = path.join(cdir, 'images.json');
        if (!fs.existsSync(cdir)) {
            mkdirRecurse(cdir);
        }
        fs.writeFileSync(cacheFile, JSON.stringify(ImageParser.cache));
    }

    // Copy the images.
    if (!this.watch) {
        syslog.info("Copying images to target.");
    }
    const opts = {fileNotBeginsWith: ['.'], fileNotExt: ['.orig']};
    let from = path.join(this.sitePath, this.cfg.locations.cache, 
        this.cfg.imageSpec.cacheImages);
    let to = path.join(this.sitePath, this.cfg.locations.site);
    copyDir(from, to, opts);
}


/**
 * Called after article is parsed.
 */
async function afterArticleParserRun(article)
{
    syslog.trace('.imageHandler:afterArticleParserRun', "Responding to hook.");

    let extracted = this.callable('extractArticleImages', article.content.html, article);

    if (article.abstract) {
        let extractedAbstract = this.callable('extractArticleImages', article.abstract.html, article);
        extracted = extracted.concat(extractedAbstract);
    }

    let defImg = false;
    if (!this.cfg.site.defaultArticleImage) {
        syslog.advice("Recommend setting a 'defaultArticleImage' in your 'site' configs.", article.relPath);
    } else {
        defImg = this.cfg.site.defaultArticleImage;
    }

    let defaultSize = (this.cfg.imageSpec.defaultSize) ?
                this.cfg.imageSpec.defaultSize : 1024;

    let imageFuncs = {
        og: false,
        twitter: false,
        featured: false,
        rss: false,
        summary: false,
        icon: false,
    }

    let spec = this.cfg.imageSpec;

    let firstResizable = null;
    let firstAny = null;

    if (extracted && extracted.length > 0) {
        for (let ex of extracted) {
            let tag = (ex.tag) ? ex.tag : ex.url;

            if (!article._images) {
                article._images = {};
            }

            if (article._images[tag]) {
                article._images[tag] = merge(article._images[tag], ex);
            } else {
                article._images[tag] = ex;
            }
        }
    }

    if (article._images) {

        for (let tag in article._images) {

            if (typeof article._images[tag] != "object") {
                continue;
            }

            let img = article._images[tag];
            let aurl = img.url;
            if (!this.images.has(aurl)) {
                syslog.warning(`Image for tag ${tag}, URL ${aurl} cannot be found.`, article.relPath);
                continue;
            }
    
            let simg = this.images.get(aurl);
    
            if (simg.hasSubimages() && firstResizable === null) {
                firstResizable = simg;
                firstAny = simg;
            }
    
            if (!simg.hasSubimages() && firstAny === null) {
                firstAny = simg;
            }
    
            for (let func of Object.keys(imageFuncs)) {
                let key = func + 'Image';
    
                if (img[key] && img[key] == true) {
    
    
                    if (simg.hasSubimages()) {
                        if (func == 'icon' || func == 'summary') {
                            imageFuncs[func] = simg.smallest.relPath;
                        } else {
                            if (simg.subs.has(defaultSize)) {
                                imageFuncs[func] = simg.subs.get(defaultSize).relPath;
                            } else {
                                imageFuncs[func] = simg.biggest.relPath;
                            }
                        }
                    } else {
                        imageFuncs[func] = simg.relPath;
                    }
    
                }
            }
    
        }
    }

    if (!imageFuncs.featured && spec.useFirstResizableAsFeatured && firstResizable) {
        
        if (firstResizable.subs.has(defaultSize)) {
            imageFuncs.featured = firstResizable.subs.get(defaultSize).relPath;
        } else {
            imageFuncs.featured = firstResizable.biggest.relPath;
        }

    } else if (!imageFuncs.featured && spec.useFirstAnyAsFeatured && firstAny) {
        imageFuncs.featured = firstAny.relPath;
    }


    if (!imageFuncs.featured && defImg) {
        imageFuncs.featured = defImg;
    }

    if (imageFuncs.featured && !imageFuncs.og) {
        imageFuncs.og = imageFuncs.featured;
    }

    if (imageFuncs.og && !imageFuncs.twitter) {
        imageFuncs.twitter = imageFuncs.og;
    }

    if (imageFuncs.og && !imageFuncs.rss) {
        imageFuncs.rss = imageFuncs.og;
    }

    article.imageFuncs = imageFuncs;

}

/**
 * Get all the image URLs.
 * 
 * @param   {object}            ctx     Context.
 * @param   {string}            url     Key URL to get complete URLs for.
 * @return  {string|string[]}           All URLs. 
 */
function getImageUrls(url)
{
    if (!this.images.has(url)) {
        syslog.warning(`No image object found for '${url}'.`);
        return url;
    }
    return this.images.get(url).allUrls();
}

/**
 * See if we have an image object.
 * 
 * @param   {object}            ctx     Context.
 * @param   {string}            url     Key URL to test.
 * @return  {boolean}                   True if we have it. 
 */
function hasImage(url)
{
    if (!this.images.has(url)) {
        false;
    }
    return true;
}

/**
 * Get an the image object.
 * 
 * @param   {object}            ctx     Context.
 * @param   {string}            url     Key URL to get object for.
 * @return  {object}                    Image object. 
 */
function getImage(url)
{
    if (!this.images.has(url)) {
        syslog.warning(`No image object found for '${url}'.`);
        return url;
    }
    return this.images.get(url);
}

/**
 * Extract article images from given HTML.
 * 
 * @param   {string}        html        HTML to extract from.
 * @param   {object}        article     Article we're processing.
 * @return  {object}                    Object with image details.
 */
function extractArticleImages(html, article)
{
    let extracted = [];

    const regex = /\(\(\(respimg\-(.+?)\)\)\)/g;
    let m;
    while ((m = regex.exec(html)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === regex.lastIndex) {
            regex.lastIndex++;
        }

        if (m) {
            let adata = {
                qualify: false,
                allowLazy: true
            }
            let iUrl = null;
            if (m[1].includes('|')) {
                let sp = m[1].split('|');
                iUrl = sp[0];
                let allowedParams = ['caption', 'credit', 'copyright', 'title', 'link', 'class', 
                    'sizes', 'size', 'qualify', 'allowLazy', 'figClass', 'alt'];

                for (let i = 1; i < sp.length; i++) {
                    let working = sp[i];
                    if (!working.includes('=')) {
                        syslog.error(`Image achema (respimg) requires parameters in the form 'x=y'.`, 
                            article.relPath);
                        continue;
                    }
                    let parts = working.split('=');

                    let n = parts[0].trim();
                    let v = parts[1].trim();

                    if (!allowedParams.includes(n)) {
                        syslog.warning(`Image achema (respimg) does not support parameter '${n}'. Are you a buffoon in your spare time?`, 
                            article.relPath);
                    } else {
                        adata[n] = v;
                    }
                }

            } else {
                iUrl = m[1];
            }

            if (!iUrl.startsWith(path.sep)) {
                adata.tag = iUrl;
                if (article._images && article._images[iUrl]) {
                    let aobj = article._images[iUrl];
                    if (typeof aobj == "object" && aobj.url) {
                        iUrl = aobj.url;
                        for (let it in aobj) {
                            adata[it] = aobj[it];
                        }
                    } else if (typeof aobj == "string") {
                        iUrl = aobj;
                    } else {
                        syslog.error(`Yikes, your article's 'image' spec is wrong for '${iUrl}'. I have no time for you.`,
                            article.relPath);
                    }
                } else {
                    syslog.error(`Look, there's no article image with the tag '${iUrl}'. I'm not a mind reader.`,
                        article.relPath);
                }
            } 

            if (this.images.has(iUrl)) {

                let stor = adata;
                stor.url = iUrl;

                extracted.push(stor);

            } else {
                syslog.error("Could not find an image with ID '" + iUrl + "'.", article.relPath);
            }
        }
    }

    return extracted;

}

/**
 * Custom template tag for 'respimg'.
 * 
 * @param   {object}    ctx     Context.
 */
function respimgTag(ctx)
{
    this.tags = ['respimg'];

    this.parse = function(parser, nodes) {
        var tok = parser.nextToken();
        var args = parser.parseSignature(null, true);
        parser.advanceAfterBlockEnd(tok.value);
        return new nodes.CallExtension(this, "run", args);
    }

    this.run = function(context, myImg) {
        let ret = ctx.images.get(myImg).getHtml(ctx);
        return ret;
    }
}

/**
 * Load.
 */
module.exports.init = ctx => {
    syslog.trace('.imageHandler', 'Initialising plugin.');

    // Load some configs.
    let icfg = {
        resizeableExts: ['jpg', 'jpeg', 'png'],
        sizesRequired: [1920, 1600, 1366, 1024, 768, 640, 320],
        defaultSize: 1024,
        resizeableFileNameRegex: "-\\d{2,6}w\\.",
        cacheMds: true,
        upscaling: false,
        cachePath: ctx.cfg.locations.cache,
        cacheImages: 'images',
        defaultLink: 'self',
        useFirstResizableAsFeatured: true,
        useFirstAnyAsFeatured: false,
        licencePage: null,
    }

    ctx.cfg.mergeSect('imageSpec', icfg, true);
    ctx.cfg.mergeSect('earlyParse', ctx.cfg.imageSpec.imageExts);

    // Set the image parser.
    ctx.setExtensionParser(ctx.cfg.imageSpec.imageExts, parse);

    // Callable.
    ctx.addContextCallable(getImageUrls);
    ctx.addContextCallable(getImage);
    ctx.addContextCallable(hasImage);
    ctx.addContextCallable(extractArticleImages);

    // Template custom tag.
    ctx.addTemplateCustomTag('respimg', respimgTag);

    // Set up event responses.
    ctx.on('BEFORE_PARSE_EARLY', beforeParseEarly);
    ctx.on('AFTER_PARSE_EARLY', afterParseEarly);
    ctx.on('AFTER_ARTICLE_PARSER_RUN', afterArticleParserRun);
    ctx.on('ARTICLE_PRERENDER', articlePrerender);

}
