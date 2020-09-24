/**
 * @file        Image prerenderer.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

const syslog = require("greenhat-util/syslog");
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


        for (let item of ['content', 'abstract']) {
    
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

        adata.allowLazy = allowLazy;
        adata.qualify = qualify;

        return this.ctx.images.get(adata.url).getHtml(this.ctx, adata);

    }

}

module.exports = ImagePrerenderer;
