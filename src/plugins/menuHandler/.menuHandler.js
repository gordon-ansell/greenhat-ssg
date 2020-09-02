/**
 * @file        Menu handler plugin.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { syslog } = require('greenhat-util/syslog');

/**
 * Called after article parsed.
 */
async function afterArticleParserRun(article)
{
    syslog.trace('.menuHandler:afterArticleParserRun', "Responding to hook.");

    if (!article.menus) {
        return;
    }

    if (!this.menus) {
        this.menus = {};
    }

    for (let menuName in article.menus) {
        if (!this.menus[menuName]) {
            this.menus[menuName] = [];
        }
        let menuItem = article.menus[menuName];

        if (!menuItem.title && article.title) {
            menuItem.title = article.title;
        } else {
            menuItem.title = "unnamed";
            syslog.warning("Unnamed menu title.", article.relPath);
        }

        if (!menuItem.description && article.description) {
            menuItem.description = article.description;
        }

        if (!menuItem.pos) {
            menuItem.pos = 5;
        }

        this.menus[menuName].push(menuItem);
    }

}

/**
 * Called after all articles parsed.
 */
async function afterParseLate()
{
    syslog.trace('.menuHandler:afterParseLate', "Responding to hook.");

    if (!this.menus) {
        return;
    }

    for (let menuName in this.menus) {
        this.menus[menuName] = this.menus[menuName].sort((a, b) => {
            if (a.pos > b.pos) {
                return 1;
            }
            if (b.pos > a.pos) {
                return -1;
            }
            return 0;
        });
    }
}

/**
 * Initialisation.
 */
module.exports = ctx => {

    syslog.trace('.menuHandler', 'Initialising plugin.');
    // Set up event responses.
    ctx.on('AFTER_ARTICLE_PARSER_RUN', afterArticleParserRun);
    ctx.on('AFTER_PARSE_LATE', afterParseLate);

}

