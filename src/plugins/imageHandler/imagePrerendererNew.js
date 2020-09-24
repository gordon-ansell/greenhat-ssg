/**
 * @file        Image prerenderer (New).
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

const syslog = require("greenhat-util/syslog");
const GreenHatSSGError = require('../../ssgError');
const path = require('path');

class GreenHatSSGImageError extends GreenHatSSGError {}

/**
 * Image prerenderer class (New).
 */
class ImagePrerendererNew
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
        for (let item of ['content', 'abstract']) {
    
            let html = article[item].html;
            let htmlRss = article[item + 'Rss'].html;
        
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
                                syslog.error(`Image prerender (respimg) requires parameters in the form 'x=y'.`, 
                                    article.relPath);
                                continue;
                            }
                            let parts = working.split('=');

                            let n = parts[0].trim();
                            let v = parts[1].trim();

                            if (!allowedParams.includes(n)) {
                                syslog.warning(`Image prerender (respimg) does not support parameter '${n}'. Are you a buffoon in your spare time?`, 
                                    article.relPath);
                            } else {
                                adata[n] = v;
                            }
                        }

                    } else {
                        iUrl = m[1];
                    }

                    if (!iUrl.startsWith(path.sep)) {
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

                    if (this.ctx.images.has(iUrl)) {
                        let imgObj = this.ctx.images.get(iUrl);
                        let l1 = imgObj.getHtml(this.ctx, adata);
                        adata.qualify = true;
                        adata.allowLazy = false;
                        let l2 = imgObj.getHtml(this.ctx, adata);
                        html = html.replace(m[0], l1);
                        htmlRss = htmlRss.replace(m[0], l2);

                    } else {
                        syslog.error("Could not find an image with ID '" + iUrl + "'.", article.relPath);
                    }
                }
            }
        
            article[item].html = html;
            article[item + 'Rss'].html = htmlRss;
        }
    
    }

}

module.exports = ImagePrerendererNew;
