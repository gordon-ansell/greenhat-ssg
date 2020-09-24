/**
 * @file        Image class.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const path = require('path');
const sizeOf = require('image-size');
const fs = require('fs');
const GreenHatError = require('greenhat-util/error')
const Html = require("greenhat-util/html");

class GreenHatSSGImageError extends GreenHatError {}

/**
 * Image class.
 */
class Image
{
    /**
     * Full path to the image.
     * @var {string}
     */
    fullPath = null;

    /**
     * Relative path.
     * @var {string}
     */
    relPath = null;

    /**
     * Cache path.
     * @var {string}
     */
    cachePath = null;

    /**
     * Width.
     * @var {number}
     */
    width = 0;

    /**
     * Height.
     * @var {number}
     */
    height = 0;

    /**
     * Is this a subimage?
     * @var {boolean}
     */
    isSubimage = false;

    /**
     * Subimages.
     * @var {Map}
     */
    subs = null;

    /**
     * Caption.
     * NB. This is ONLY set by a call to getHtml().
     * @var {string}
     */
    caption = null;

    /**
     * Constructor.
     * 
     * @constructor
     * @param   {string}    fullPath    Full path to the image.
     * @param   {string}    sitePath    Absolute path to site.
     * @param   {object}    opts        Options.
     * @param   {boolean}   subImage    Subimage?
     */
    constructor(fullPath, sitePath, opts, subImage = false)
    {
        this.fullPath = fullPath;
        this.isSubimage = subImage;

        // Set the relative path.
        this.relPath = fullPath.replace(sitePath, '');

        // Cache path.
        this.cachePath = path.join(sitePath, opts.cachePath, opts.cacheImages, this.relPath);

        // Dimensions?
        this.determineDimensions();
    }

    /**
     * Determine the dimensions.
     */
    determineDimensions()
    {
        let toTest = (this.isSubimage) ? this.cachePath : this.fullPath;
        if (!fs.existsSync(toTest)) {
            throw new GreenHatSSGImageError(`Cannot find image file to get dimensions of: ${toTest}`);
        }
        let dims = sizeOf(toTest);
        this.width = dims.width;
        this.height = dims.height;
    }

    /**
     * Do we have subimages?
     * 
     * @return  {boolean}       True if we do.
     */
    hasSubimages()
    {
        return this.subs && this.subs.size > 0;
    }

    /**
     * Get the subimage map in ascending order.
     * 
     * @return {object} Sorted subimages.
     */
    get subsAsc()
    {
        return new Map([...this.subs.entries()].sort((a, b) => {return a[0] - b[0]}));
    }

    /**
     * Get the subimage map in descending order.
     * 
     * @return {object} Sorted subimages.
     */
    get subsDesc()
    {
        return new Map([...this.subs.entries()].sort((a, b) => {return b[0] - a[0]}));
    }

    /**
     * Get the smallest subimage.
     * 
     * @return {object}     Subimage.
     */
    get smallest()
    {
        return this.subsAsc.values().next().value;
    }

    /**
     * Get the biggest subimage.
     * 
     * @return {object}     SubImage
     */
    get biggest()
    {
        return this.subsDesc.values().next().value;
    }

    /**
     * Get the HTML for this image.
     * 
     * @param   {object}            ctx         Context.
     * @param   {object|string}     adata       Variable image fields.
     */
    getHtml(ctx, adata)
    {
        if (!adata) {
            adata = {};
        }

        // Is this a figure?
        let isFig = (adata.caption || adata.credit || adata.copyright);

        // Allow lazy images?
        if (!('allowLazy' in adata)) {
            adata.allowLazy = true;
        }

        // Qualify URLs?
        if (!('qualify' in adata)) {
            adata.qualify = false;
        }

        // Responsive classes, could be on <img> or could be on <figure>.
        let respClasses = [];

        // Get the <img> HTML.
        let imgHtml = this._getImgHtml(adata, ctx, respClasses);

        // If no link, just link to self.
        if (!adata.link) {
            adata.link = ctx.cfg.imageSpec.defaultLink;
        }    
        
        // Process link.
        if (adata.link) {
            let linkHtml = this._getLinkHtml(adata, ctx);
            imgHtml = linkHtml.setData(imgHtml);
        }

        // Figure?
        if (isFig) {
            let figHtml = this._getFigureHtml(adata);
            figHtml.appendParam('class', respClasses.join(' '));
            imgHtml = figHtml.setData(imgHtml);
        } else {
            imgHtml.appendParam('class', respClasses.join(' '));
        }

        return imgHtml.resolve();
    }

    /**
     * Get the figure HTML.
     * 
     * @param   {object}    adata   Article image data.
     * @return  {object}            HTML object.
     */
    _getFigureHtml(adata)
    {
        let html = new Html('figure', 'figcaption');
        let capt = '';

        if (adata.caption) {
            capt = adata.caption;
        }

        if (adata.credit) {
            if (capt != '') {
                capt += '<br />';
            }

            capt += 'Credit: ' + adata.credit;
        }

        if (adata.copyright) {
            if (capt != '') {
                capt += '<br />';
            }

            capt += 'Copyright &copy; ' + adata.copyright;
        }

        this.caption = capt;

        html.getInner().setData(capt);

        return html;
    }

    /**
     * Get the link HTML.
     * 
     * @param   {object}    adata   Article image data.
     * @param   {object}    ctx     Context.
     * @return  {object}            HTML object.
     */
    _getLinkHtml(adata, ctx)
    {
        let html = new Html('a');

        let url;

        if (adata.link == 'self') {
            if (this.hasSubimages()) {
                url = this.biggest.relPath;
            } else {
                url = this.relPath;
            }
        } else {
            url = adata.link;
        }

        if (adata.qualify) {
            url = ctx.qualify(url);
        }

        html.addParam('href', url);
        html.addParam('title', "See fullscreen version of this image.");
        html.addParam('class', 'respimg-link');

        return html;
    }

    /**
     * Get the image HTML.
     * 
     * @param   {object}    adata       Article image data.
     * @param   {object}    ctx         Context.
     * @param   {string[]}  respClasses Classes that might be on the img or the figure.
     * @return  {object}                HTML object.
     */
    _getImgHtml(adata, ctx, respClasses)
    {
        let html = new Html('img');
        respClasses.push('respimg');

        let lazy = ctx.cfg.site.lazyload;

        let srcName = 'src';
        let srcsetName = 'srcset';
        if (lazy && adata.allowLazy) {
            srcName = 'data-src';
            srcsetName = 'data-srcset';
            html.appendParam('class', 'lazyload');
        }

        if (adata.figClass) {
            if (!adata.class) {
                adata.class = adata.figClass;
            } else {
                adata.class += ' ' + adata.figClass;
            }
        }

        let sizeClass = null;
        if (adata.class) {
            respClasses.push(adata.class);
            sizeClass = this._extractSizeClass(adata.class);
        }

        if (this.hasSubimages()) {

            if (adata.size) {
                adata.sizes = adata.size;
            } 

            if (adata.sizes) {
                html.addParam('sizes', adata.sizes);
                if (!sizeClass) {
                    const sizesSplit = adata.sizes.split(" ");
                    if (sizesSplit.length == 1 && sizesSplit[0].slice(-2) == 'vw') {
                        const num = parseInt(sizesSplit[0].substring(0, sizesSplit[0].length - 2));
                        if (num > 0 && num < 100) {
                            respClasses.push('s' + num);
                        }
                    }        
                }
            } else if (sizeClass) {
                html.addParam('sizes', sizeClass + 'vw');
            }

            let defaultSize = (ctx.cfg.imageSpec.defaultSize) ?
                ctx.cfg.imageSpec.defaultSize : 1024;
            let ss = '';
            let gotDef = false;
            let max = 0;
            for (let size of this.subs.keys()) {
                if (size > max) {
                    max = size;
                }
                let url = this.subs.get(size).relPath;
                if (adata.qualify) {
                    url = ctx.qualify(url);
                }
                if (ss != '') {
                    ss += ', ';
                }
                ss += url + ' ' + size + 'w';
                if (size == defaultSize) {
                    if (adata.qualify) {
                        gotDef = ctx.qualify(url);
                    } else {
                        gotDef = url;
                    }
                }
            }
            html.addParam(srcsetName, ss);
            if (gotDef) {
                html.addParam(srcName, gotDef);
            } else {
                if (adata.qualify) {
                    html.addParam(srcName, ctx.qualify(this.biggest.relPath));
                } else {
                    html.addParam(srcName, this.biggest.relPath);
                }
            }

            html.addParam('width', max);

        } else {
            html.addParam(srcName, ctx.asset(this.relPath, adata.qualify));
        }

        if (adata.alt) {
            html.addParam('alt', adata.alt);
        } else if (adata.title) {
            html.addParam('alt', adata.title);
        } else if (adata.caption) {
            html.addParam('alt', adata.caption);
        }

        if (adata.title) {
            html.addParam('title', adata.title);
        } else if (adata.caption) {
            html.addParam('title', adata.caption);
        } else if (adata.alt) {
            html.addParam('title', adata.alt);
        }

        return html;
    }

    /**
     * Extract the size class.
     * 
     * @param   {string}    classStr    Class statement.
     * @return  {number}                The size if we have one, else null.
     */
    _extractSizeClass(classStr)
    {
        let classSplit = String(classStr).split(" ");
        for (let cls of classSplit) {
            if ('s' == cls.substring(0, 1)) {
                const num = parseInt(cls.substring(1));
                if (num > 0 && num < 100) {
                    return num;
                }
            }
        }    
        return null;
    }

    /**
     * Get all the URLs.
     * 
     * @return  {string[]}      Array of all URLs. 
     */
    allUrls()
    {
        let ret = [];

        if (this.subs) {
            for (let sub of this.subs.values()) {
                ret.push(sub.relPath);
            }
        } else {
            ret.push(this.relPath);
        }

        return ret;
    }

}

module.exports = Image;
