/**
 * @file        Article mutiformat content.
 * @module      article/ArticleContent
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const showdown = require('showdown');
const striptags = require("striptags");
const { syslog } = require('greenhat-base/src/logger');

/**
 * Article content
 * 
 * @property    {string}    md      Markdown.
 * @property    {string}    html    HTML.
 * @property    {string}    text    Plain text.
 */
class ArticleContent
{
    /**
     * Converter.
     * 
     * @var {object}
     */
    static _mdConv = null;

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
                syslog.error("Error parsing markdown: " + err.message, context);
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
        if (ArticleContent._mdConv === null) {
            ArticleContent._mdConv = new showdown.Converter();
            ArticleContent._mdConv.setOption('strikethrough', true);
            ArticleContent._mdConv.setOption('tables', true);
        }
        return ArticleContent._mdConv;
    }

}

module.exports = ArticleContent;