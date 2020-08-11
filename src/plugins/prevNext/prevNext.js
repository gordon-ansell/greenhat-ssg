/**
 * @file        Previous/Next post plugin.
 * @module      plugins/prevNext
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { syslog } = require("greenhat-base/src/logger");

/**
 * Called after article sort processing.
 */
function AfterArticleSort()
{
    syslog.trace('plugin:prevNext:afterArticleSort', "Responding to hook.");

    if (!this.ctx.articles.post) {
        return;
    }

    let next = null;    // Newer.

    // Going through in order from newer articles to older ones.
    for (let currKey of this.ctx.articles.post.keys()) {

        if (next != null) {
            let nextObj = this.ctx.articles.post.get(next);
            this.ctx.articles.post.get(currKey).next = {
                title: nextObj.title,
                url: nextObj.url,
            }

            let thisObj = this.ctx.articles.post.get(currKey);
            this.ctx.articles.post.get(next).prev = {
                title: thisObj.title,
                url: thisObj.url,
            }

        }

        next = currKey;

    }

}

exports.AfterArticleSort = AfterArticleSort;