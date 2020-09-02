/**
 * @file        Base template.
 * @module      loaders/BaseTemplate
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { syslog } = require("greenhat-util/syslog");
const Data = require('../data');

/**
 * Base template class.
 */
class BaseTemplate
{
    // Data object.
    #data = null;

    /**
     * Render an article.
     * 
     * @param   {object}    article     Article instance to render.
     * @param   {object}    ctx         Context object.
     * @return  {string}                Rendered string.
     */
    async renderArticle(article, ctx)
    {
        await ctx.emit('ARTICLE_PRERENDER', article);

        if (this.#data == null) {
            this.#data = new Data();
            let ctxTmp = {...ctx};
            for (let key in ctxTmp.cfg) {
                this.#data.add(key, ctxTmp.cfg[key]);
            }
            delete ctxTmp.cfg;
            if (ctxTmp.data) {
                for (let key in ctxTmp.data) {
                    this.#data.add(key, ctxTmp.data[key]);
                }
                delete ctxTmp.data;
            }
            this.#data.add('ctx', ctx);
        }

        this.#data.del('article');
        this.#data.add('article', article);

        return this._renderArticleHere(article.layoutPath, this.#data.getData(), article.relPath);

        //syslog.inspect(this.#data);
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

    /**
     * Render a file.
     * 
     * @param   {string}    file        File to render.
     * @param   {object}    data        Data to use.
     * @param   {string}    context     Context. 
     * @return  {string}                Rendered output.
     */
    _renderArticleHere(file, data, context)
    {
        syslog.error("You must create a 'renderFile' function for template processors.")
    }

}

module.exports = BaseTemplate