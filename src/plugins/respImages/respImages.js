/**
 * @file        Responsive image handler plugin.
 * @module      plugins/respImages
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

const { syslog, merge, mkdirRecurse, copyDir } = require("greenhat-base"); 
const path = require('path');
const fs = require('fs');
const ImageParser = require('./imageParser');
const PreRender = require("./preRender");

/**
 * Called after config processing.
 */
function AfterConfig()
{
    syslog.trace('plugin:respImages:afterConfig', "Responding to hook.");

    let defaultImageSpec = {
        resizeableExts: ['jpeg', 'jpg', 'png'],
        exts: ['gif','jpg','jpeg','png','webp','tiff','svg'],
        sizesRequired: [1920, 1600, 1366, 1024, 768, 640, 320],
        defaultSize: 1024,
        resizeableFileNameRegex: "-\\d{2,6}w\\.",
        cacheMds: true,
        upscaling: false,
        cachePath: '_cache',
        cacheImages: 'images',
        defaultLink: 'self',
        useFirstResizableAsFeatured: true,
        useFirstAnyAsFeatured: false,
        licencePage: null,
    };

    if (this.ctx.config.imageSpec) {
        this.ctx.config.imageSpec = merge(defaultImageSpec, this.ctx.config.imageSpec);
    } else {
        this.ctx.config.imageSpec = defaultImageSpec;
    }

    this.ctx.images = new Map();
    this.ctx.counts.images = 0;
}

/**
 * Called after file system parse.
 */
async function AfterFileSystemParse()
{
    syslog.trace('plugin:respImages:afterFileSystemParse', "Responding to hook.");

    let cacheChk = (this.ctx.args.noImageCacheCheck === true) ? false : true;

    if (cacheChk) {
        syslog.notice("Processing images.");
    } else {
        syslog.notice("Processing images (no cache check).");
    }

    let cacheFile = path.join(this.ctx.sitePath, this.ctx.config.imageSpec.cachePath, 'images.json');

    if (cacheChk) {
        if (this.ctx.config.imageSpec.cacheMds) {
            syslog.trace('plugin:respImages:afterFileSystemParse', 'We are cacheing MDs.')
            let cache = {};
            if (fs.existsSync(cacheFile)) {
                cache = JSON.parse(fs.readFileSync(cacheFile));
            }
            ImageParser.cache = cache;
            ImageParser.cacheCheck = true;
        }
    }

    let imagesToProcess = this.ctx.filesToProcess.filter(f => 
        {return this.ctx.config.imageSpec.exts.includes(path.extname(f).substring(1));});

    
    await Promise.all(imagesToProcess.map(async f => {
        syslog.trace('plugin:respImages:afterFileSystemParse', `Processing image file: ${f}`);
        let newImg = await new ImageParser(f, this.ctx.sitePath, this.ctx.config.imageSpec).parse();
        if (this.ctx.images.has(newImg.relPath)) {
            syslog.warning(`Image for ${newImg.relPath} already defined. It will be overwritten.`)
        }
        this.ctx.images.set(newImg.relPath, newImg);
        this.ctx.filesProcessed.push(f);
        this.ctx.counts.images++;
    }));

    if (ImageParser.cache !== null) {
        syslog.trace('plugin:respImages:afterFileSystemParse', 'Writing back image cache.');
        let cdir = path.join(this.ctx.sitePath, this.ctx.config.imageSpec.cachePath);
        if (!fs.existsSync(cdir)) {
            mkdirRecurse(cdir);
        }
        fs.writeFileSync(cacheFile, JSON.stringify(ImageParser.cache));
    }

    // Copy the images.
    syslog.notice("Copying images to target.");
    const opts = {fileNotBeginsWith: ['.'], fileNotExt: ['.orig']};
    let from = path.join(this.ctx.sitePath, this.ctx.config.imageSpec.cachePath, 
        this.ctx.config.imageSpec.cacheImages);
    let to = path.join(this.ctx.sitePath, this.ctx.config.dirs.site);
    copyDir(from, to, opts);
}

/**
 * Called after article is parsed.
 */
async function AfterArticleParse(article)
{
    syslog.trace('plugin:respImages:AfterArticleParse', "Responding to hook.");

    let defImg = false;
    if (!this.ctx.config.site.defaultArticleImage) {
        syslog.advice("Recommend setting a 'defaultArticleImage' in your 'site' configs.", article.relPath);
    } else {
        defImg = this.ctx.config.site.defaultArticleImage;
    }

    let defaultSize = (this.ctx.config.imageSpec.defaultSize) ?
                this.ctx.config.imageSpec.defaultSize : 1024;

    let imageFuncs = {
        og: false,
        twitter: false,
        featured: false,
        rss: false,
        summary: false,
        icon: false,
    }

    let spec = this.ctx.config.imageSpec;

    let firstResizable = null;
    let firstAny = null;

    if (article.images) {

        for (let tag in article.images) {
            let img = article.images[tag];
            let aurl = img.url;
            if (!this.ctx.images.has(aurl)) {
                syslog.warning(`Image for tag ${tag}, URL ${aurl} cannot be found.`, article.relPath);
                continue;
            }
    
            let simg = this.ctx.images.get(aurl);
    
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
 * Called before rendering.
 */
async function PreRenderArticle(article)
{
    syslog.trace('plugin:respImages:PreRenderArticle', "Responding to hook.");

    if (!article.images) {
        return;
    }

    let html = article.content.html;
    let htmlRss = article.contentRss.html;
    let preRenderer = new PreRender(article, this.ctx);

    if (article.images && Object.keys(article.images).length > 0) {
        const regex = /\(\(\(image\-(.+?)\)\)\)/g;
        let m;
        while ((m = regex.exec(html)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }

            if (m) {
                if (article.images[m[1]]) {
                    let l1 = preRenderer.getHtml(m[1]);
                    let l2 = this.ctx.qualify(preRenderer.getHtml(m[1], false));
                    html = html.replace(m[0], l1);
                    htmlRss = htmlRss.replace(m[0], l2);
                } else {
                    syslog.error("Could not find an image with ID '" + m[0] + "'.", article.relPath);
                }
            }
        }

    }

    article.content.html = html;
    article.contentRss.html = htmlRss;
}


exports.AfterConfig = AfterConfig;
exports.AfterFileSystemParse = AfterFileSystemParse;
exports.AfterArticleParse = AfterArticleParse;
exports.PreRenderArticle = PreRenderArticle;

