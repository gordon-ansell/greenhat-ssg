/**
 * @file        Article collection.
 * @module      ArticleCollection
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { syslog } = require("greenhat-util/syslog");
const Collection = require("../../collection");

/**
 * Article collection class.
 */
class ArticleCollection extends Collection
{

    /**
     * The compare function for sorting articles.
     * 
     * @param   {object}    a   First article.
     * @param   {object}    b   Second article.
     */
    _sortDescCompare(a, b)
    {
        if (a[1].dates.published.ms < b[1].dates.published.ms) {
            return 1;
        }
        if (b[1].dates.published.ms < a[1].dates.published.ms) {
            return -1;
        }
        return 0;
    }

    /**
     * The compare function for sorting articles.
     * 
     * @param   {object}    a   First article.
     * @param   {object}    b   Second article.
     */
    _sortAscCompare(a, b)
    {
        if (a[1].dates.published.ms < b[1].dates.published.ms) {
            return -1;
        }
        if (b[1].dates.published.ms < a[1].dates.published.ms) {
            return 1;
        }
        return 0;
    }

    /**
     * Dump collection.
     */
    dump(level = "warning", context = '')
    {
        let res = new Map();
        for (let key of this.items.keys()) {
            let obj = {...this.items.get(key)};
            delete obj.ctx;
            res.set(key, obj);
        }
        syslog.inspect(res, level, context);
    }
}

module.exports = ArticleCollection
