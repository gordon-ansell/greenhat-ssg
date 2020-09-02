/**
 * @file        Article content object.
 * @module      ArticleContent
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const showdown = require('showdown');
const striptags = require("striptags");
const { syslog } = require('greenhat-util/syslog');

/**
 * Article content object.
 */
class ArticleContent
{
    /**
     * Converter.
     * 
     * @var {object}
     */
    static #mdConv = null;

    /**
     * Constructor.
     * 
     * @param   {string}    raw         Raw input.
     * @param   {object}    context     Context.
     */
    constructor(raw, context)
    {
        this.md = '';
        this.html = '';
        this.text = '';

        if (raw && raw != '') {
            this.md = raw;
            try {
                this.html = ArticleContent.mdConv.makeHtml(raw);
            } catch (err) {
                syslog.error(`Error parsing markdown: ${err.message}`, context);
                return;
            }
            this.text = striptags(this.html);
        }
    }

    /**
     * Get the markdown converter.
     * 
     * @return  {object}
     */
    static get mdConv()
    {
        if (ArticleContent.#mdConv === null) {
            ArticleContent.#mdConv = new showdown.Converter();
            ArticleContent.#mdConv.setOption('strikethrough', true);
            ArticleContent.#mdConv.setOption('tables', true);
        }
        return ArticleContent.#mdConv;
    }
}

module.exports = ArticleContent;
