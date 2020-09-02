/**
 * @file        Image prerenderer.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

const { syslog } = require("greenhat-util/syslog");
const Html = require("greenhat-util/html");
const GreenHatSSGError = require('../../ssgError');

class GreenHatSSGImageError extends GreenHatSSGError {}

/**
 * Image prerenderer class.
 */
class ImagePrerenderer
{
    /**
     * Constructor.
     * 
     * @param   {object}    ctx     Context.
     */
    constructor(ctx)
    {
        this.ctx = ctx;
    }

    /**
     * Prerender.
     * 
     * @param   {object}    article     The article. 
     */
    async prerender(article)
    {
        if (!article.images) {
            return;
        }


        for (let item of ['content', 'excerpt']) {
    
            let html = article[item].html;
            let htmlRss = article[item + 'Rss'].html;
        
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
                            let l1 = this.getHtml(m[1], article);
                            let l2 = this.getHtml(m[1], article, false, true);
                            html = html.replace(m[0], l1);
                            htmlRss = htmlRss.replace(m[0], l2);

                        } else {
                            syslog.error("Could not find an image with ID '" + m[0] + "'.", article.relPath);
                        }
                    }
                }
        
            }
        
            article[item].html = html;
            article[item + 'Rss'].html = htmlRss;
        }
    
    }

    /**
     * Get the image HTML for a tag.
     * 
     * @param   {string}    tag         Image tag. 
     * @param   {object}    article     Article,
     * @param   {boolean}   allowLazy   Allow lazy images?
     * @param   {boolean}   qualify     Qualify URLs?
     */
    getHtml(tag, article, allowLazy = true, qualify = false)
    {
        if (!article.images[tag]) {
            throw new GreenHatSSGImageError(`Article has no image with tag ${tag}.`, article.relPath);
        }

        let adata = article.images[tag];

        if (!this.ctx.images.has(adata.url)) {
            //syslog.inspect(this.ctx.images);
            throw new GreenHatSSGImageError(`System has no image with URL ${adata.url} for tag ${tag}.`, 
                article.relPath);
        }

        let cdata = this.ctx.images.get(adata.url);

        let isFig = this._isFigure(adata);

        let respClasses = [];

        let imgHtml = this._getImgHtml(adata, cdata, respClasses, allowLazy, qualify);

        if (!adata.link) {
            adata.link = this.ctx.cfg.imageSpec.defaultLink;
        }        

        if (adata.link) {
            let linkHtml = this._getLinkHtml(adata, cdata, qualify);
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
     * @param   {object}    cdata   Context image data.
     * @param   {boolean}   qualify Qualify links?    
     * @return  {object}            HTML object.
     */
    _getLinkHtml(adata, cdata, qualify = false)
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

        if (qualify) {
            url = this.ctx.qualify(url);
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
     * @param   {boolean}   qualify     Qualify URLs?
     * @return  {object}                HTML object.
     */
    _getImgHtml(adata, cdata, respClasses, allowLazy = true, qualify = false)
    {
        let html = new Html('img');
        respClasses.push('respimg');

        let lazy = this.ctx.cfg.site.lazyload;

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

            let defaultSize = (this.ctx.cfg.imageSpec.defaultSize) ?
                this.ctx.cfg.imageSpec.defaultSize : 1024;
            let ss = '';
            let gotDef = false;
            let max = 0;
            for (let size of cdata.subs.keys()) {
                if (size > max) {
                    max = size;
                }
                let url = cdata.subs.get(size).relPath;
                if (qualify) {
                    url = this.ctx.qualify(url);
                }
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
            html.addParam(srcName, this.ctx.asset(cdata.relPath, qualify));
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

module.exports = ImagePrerenderer;
