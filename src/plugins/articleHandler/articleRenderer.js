/**
 * @file        Article renderer.
 * @module      ArticleRenderer
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const fs = require('fs');
const ghfs = require("greenhat-util/fs");
const { syslog } = require('greenhat-util/syslog');
const { mkdirRecurse } = require("greenhat-util/fs");
const path = require('path');
const NunjucksTemplate = require("../../template/nunjucksTemplate");

/**
 * Article renderer class.
 */
class ArticleRenderer
{
    // Privates.
    #templateHandlers = {};

    /**
     * Constructor.
     * 
     * @param   {string}    ctx         Context.
     */
    constructor(ctx)
    {
        this.ctx = ctx;
    }

    /**
     * Do the pre-render.
     * 
     * @param   {object}    article     Article to render.
     */
    async prerender(article)
    {
        syslog.trace('plugin:preLinks:PreRenderArticle', "Responding to hook.");

        let html = article.content.html;
        let htmlRss = article.contentRss.html;
     
        const regex = /\(\(\((.+?)\|(.+?)\)\)\)/g;
        let m;
        while ((m = regex.exec(html)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }
    
            if (m) {
                if (m[2].includes('|')) {
                    let sp = m[2].split('|');
                    let l1 = this.ctx.link(m[1], sp[0], sp[1]);
                    let l2 = this.ctx.qualify(l1);
                    html = html.replace(m[0], l1);
                    htmlRss = htmlRss.replace(m[0], l2);
                } else {
                    let l1 = this.ctx.link(m[1], m[2]);
                    let l2 = this.ctx.qualify(l1);
                    html = html.replace(m[0], l1);
                    htmlRss = htmlRss.replace(m[0], l2);
                }
            }
        }
    
        // Check all preprocessing done.
        const chk = /\(\(\((.+?)\)\)\)/;
        if (chk.exec(html) !== null) {
            syslog.warning("Preprocessing '(((...)))' elements still remain.", article.relPath);
        }
    
        // Now replace escaped stuff.
        html = html.split("%(%(%(").join("(((");
        html = html.split("%)%)%)").join(")))");
        htmlRss = htmlRss.split("%(%(%(").join("(((");
        htmlRss = htmlRss.split("%)%)%)").join(")))");
    
        article.content.html = html;
        article.contentRss.html = htmlRss;
    }

    /**
     * Do the render.
     * 
     * @param   {object}    article     Article to render.
     */
    async render(article)
    {
        if (!article.layoutType) {
            article.layoutType = 'njk';
        }

        if (!this.#templateHandlers[article.layoutType]) {

            let layoutPaths = [
                path.join(this.ctx.sitePath, this.ctx.cfg.locations.layouts),
                path.join(this.ctx.appPath, this.ctx.cfg.locations.sysLayouts)
            ];

            switch (article.layoutType) {
                case 'njk':
                    this.#templateHandlers.njk = new NunjucksTemplate(this.ctx, layoutPaths);
                    this.#templateHandlers.njk.setThrowExceptions(true);
                    break;
                default:
                    syslog.error(`No support for rendering '${article.layoutType}' files.`)
            }
        }

        let output = await this.#templateHandlers[article.layoutType].renderArticle(article);

        // Copy the article to the output location.
        let opPath = path.join(this.ctx.sitePath, this.ctx.cfg.locations.site, article.outputFileName);
        mkdirRecurse(path.dirname(opPath));
        fs.writeFileSync(opPath, output);

    }
}

module.exports = ArticleRenderer;