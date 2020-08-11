/**
 * @file        Menu plugin.
 * @module      plugins/menu
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { syslog } = require("greenhat-base"); 

/**
 * Called after config processing.
 */
function AfterConfig()
{
    syslog.trace('plugin:menu:afterConfig', "Responding to hook.");

    this.ctx.config.menus = {};
}

/**
 * Called after an article is parsed.
 */
function AfterArticleParse(article)
{
    syslog.trace('plugin:menu:afterArticleParse', "Responding to hook.");
    
    if (!article.menus) {
        return;
    }

    for (let menuName in article.menus) {
        if (!this.ctx.config.menus[menuName]) {
            this.ctx.config.menus[menuName] = [];
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

        this.ctx.config.menus[menuName].push(menuItem);
    }

}

/**
 * Called after an article is parsed.
 */
function AfterAllArticlesProcessed()
{
    syslog.trace('plugin:menu:afterAllArticlesProcessed', "Responding to hook.");

    if (!this.ctx.config.menus) {
        return;
    }

    for (let menuName in this.ctx.config.menus) {
        this.ctx.config.menus[menuName] = this.ctx.config.menus[menuName].sort((a, b) => {
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

exports.AfterConfig = AfterConfig;
exports.AfterArticleParse = AfterArticleParse;
exports.AfterAllArticlesProcessed = AfterAllArticlesProcessed;
