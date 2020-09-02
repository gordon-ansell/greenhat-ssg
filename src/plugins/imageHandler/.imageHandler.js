/**
 * @file        Image handler plugin.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { syslog } = require('greenhat-util/syslog');
const ImageParser = require('./imageParser');
const ImagePrerenderer = require('./imagePrerenderer');
const path = require('path');
const fs = require('fs');
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

    let cacheChk = (this.args.noImageCacheCheck === true) ? false : true;

    if (cacheChk) {
        syslog.info("Parsing images.");
    } else {
        syslog.info("Parsing images (no cache check).");
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
    syslog.info("Copying images to target.");
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

    if (article.images) {

        for (let tag in article.images) {
            let img = article.images[tag];
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
 * Load.
 */
module.exports = ctx => {
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

    // Set up event responses.
    ctx.on('BEFORE_PARSE_EARLY', beforeParseEarly);
    ctx.on('AFTER_PARSE_EARLY', afterParseEarly);
    ctx.on('AFTER_ARTICLE_PARSER_RUN', afterArticleParserRun);
    ctx.on('ARTICLE_PRERENDER', articlePrerender);
}
