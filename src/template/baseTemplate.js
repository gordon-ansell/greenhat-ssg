/**
 * @file        Base template.
 * @module      loaders/BaseTemplate
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const syslog = require("greenhat-util/syslog");
//const Data = require('../data');

/**
 * Base template class.
 */
class BaseTemplate
{
    // Data object.
    #data = null;

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
     * Cue the common filters.
     */
    _cueCommonFilters()
    {
        this.ctx.addTemplateFilter('log', function(str, level = "info") {
            this.env.getGlobal('ctx').log(str, level);
            return str;
        });    

        this.ctx.addTemplateFilter('inspect', function(thing, level = "info") {
            this.env.getGlobal('ctx').inspect(thing, level);
            return str;
        });    

        this.ctx.addTemplateFilter('img', function(url, spec = {}, title = null, cls = null) {
            spec.src = url;
            return this.env.getGlobal('ctx').img(spec, title, cls);
        });    
    }

    /**
     * Render an article.
     * 
     * @param   {object}    article     Article instance to render.
     * @return  {string}                Rendered string.
     */
    async renderArticle(article)
    {
        await this.ctx.emit('ARTICLE_PRERENDER', article);

        return this._renderArticleHere(article._layoutPath, {article: article}, article.relPath);
    }

    /**
     * Local render of an article.
     * 
     * @param   {string}    layoutPath  Path to layout.
     * @param   {object}    data        Data to render.
     * @param   {string}    context     Identifier.
     * @return  {string}                Rendered string.
     */
    _renderArticleHere(layoutPath, data, context)
    {
        syslog.error("You must create a '_renderArticleHere' function for template processors.")
    }

}

module.exports = BaseTemplate