/**
 * @file        Srcset image plugin - pre-render.
 * @module      plugins/respImages
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { GreenhatError, Html } = require('greenhat-base');
const { syslog } = require('greenhat-base/src/logger');

class GreenhatSSGImagePreRenderError extends GreenhatError {};

/**
 * Pre-render class.
 */
class PreRender {

    /**
    * Constructor.
    * 
    * @param    {object}    article     Article class.
    * @param    {object}    ctx         Context.
    */
    constructor(article, ctx)
    {
        this.article = article;
        this.ctx = ctx;
    }

    /**
     * Get the image HTML for a tag.
     * 
     * @param   {string}    tag         Image tag. 
     * @param   {boolean}   allowLazy   Allow lazy images?
     */
    getHtml(tag, allowLazy = true)
    {
        if (!this.article.images[tag]) {
            throw new GreenhatSSGImagePreRenderError(`Article has no image with tag ${tag}.`, this.article.relPath);
        }

        let adata = this.article.images[tag];

        if (!this.ctx.images.has(adata.url)) {
            throw new GreenhatSSGImagePreRenderError(`System has no image with URL ${adata.url} for tag ${tag}.`, 
                this.article.relPath);
        }

        let cdata = this.ctx.images.get(adata.url);

        let isFig = this._isFigure(adata);

        let respClasses = [];

        let imgHtml = this._getImgHtml(adata, cdata, respClasses, allowLazy);

        if (!adata.link) {
            adata.link = this.ctx.config.imageSpec.defaultLink;
        }        

        if (adata.link) {
            let linkHtml = this._getLinkHtml(adata, cdata);
            imgHtml = linkHtml.setData(imgHtml);
        }

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
     * Get the link HTML.
     * 
     * @param   {object}    adata   Article image data.
     * @param   {object}    cdata       Context image data.
     * @return  {object}            HTML object.
     */
    _getLinkHtml(adata, cdata)
    {
        let html = new Html('a');

        let url;

        if (adata.link == 'self') {
            if (cdata.hasSubimages()) {
                url = cdata.biggest.relPath;
            } else {
                url = cdata.relPath;
            }
        } else {
            url = adata.link;
        }

        html.addParam('href', url);
        html.addParam('title', "See fullscreen version of this image.");
        html.addParam('class', 'respimg-link');

        return html;
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

        html.getInner().setData(capt);

        return html;
    }

    /**
     * Get the image HTML.
     * 
     * @param   {object}    adata       Article image data.
     * @param   {object}    cdata       Context image data.
     * @param   {string[]}  respClasses Classes that might be on the img or the figure.
     * @param   {boolean}   allowLazy   Allow lazy images?
     * @return  {object}                HTML object.
     */
    _getImgHtml(adata, cdata, respClasses, allowLazy = true)
    {
        let html = new Html('img');
        respClasses.push('respimg');

        let lazy = this.ctx.config.site.lazyload;

        let srcName = 'src';
        let srcsetName = 'srcset';
        if (lazy && allowLazy) {
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

        if (cdata.hasSubimages()) {

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

            let defaultSize = (this.ctx.config.imageSpec.defaultSize) ?
                this.ctx.config.imageSpec.defaultSize : 1024;
            let ss = '';
            let gotDef = false;
            let max = 0;
            for (let size of cdata.subs.keys()) {
                if (size > max) {
                    max = size;
                }
                let url = cdata.subs.get(size).relPath;
                if (ss != '') {
                    ss += ', ';
                }
                ss += url + ' ' + size + 'w';
                if (size == defaultSize) {
                    gotDef = url;
                }
            }
            html.addParam(srcsetName, ss);
            if (gotDef) {
                html.addParam(srcName, gotDef);
            } else {
                html.addParam(srcName, cdata.biggest.relPath);
            }

            html.addParam('width', max);

        } else {
            html.addParam(srcName, this.ctx.asset(cdata.relPath));
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
        let classSplit = classStr.split(" ");
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
     * See if an image is a figure.
     * 
     * @param   {object}    adata   Article data to test.
     * @return  {boolean} 
     */
    _isFigure(adata)
    {
        return (adata.caption || adata.credit || adata.copyright);
    }

}

module.exports = PreRender;
