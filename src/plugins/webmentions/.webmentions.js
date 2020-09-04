/**
 * @file        Webmentions plugin.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { syslog } = require("greenhat-util/syslog");
const WebmentionsProcessor = require("./webmentionsProcessor");

/**
 * Called after article parsed.
 */
async function afterArticleParserRun(article)
{
    syslog.trace('.webmentions:afterArticleParserRun', "Responding to hook.");

    if (!this.cfg.site.webmentions || !this.cfg.site.webmentions.id) {
        syslog.error("Webmentions plugin enabled but no 'webmentions.id' specified in site config.");
        return;
    }

    let proc = WebmentionsProcessor.getProcessor(this);

    // Received.

    let wmentions = proc.mentionsForUrl(this.qualify(article.url));

    if (wmentions && wmentions.length > 0) {
        article.wmentions = wmentions;
        syslog.info(`Post ${article.url} has ${wmentions.length} webmentions.`);
    } else {
        syslog.trace('.webmentions:afterArticleParserRun', `Post ${article.url} has no webmentions.`);
    }

    // To send.

    if (!article.webmentions) {
        return;
    }

    let test = (this.mode == 'dev') ? true : false;

    for (let wm of article.webmentions) {
        if (!proc.hasBeenSent(article.url, wm, test)) {
            await proc.send(article.url, wm, test);
        }
    }
}


/**
 * Initialisation.
 */
module.exports.init = ctx => {

    syslog.trace('.webmentions', 'Initialising plugin.');

    // Load some configs.
    let defaultWebmentionsSpec = {
        cacheFile: 'received.json',
        cacheFileTest: 'testReceived.json',
        mentionsApi: "https://webmention.io/api/mentions.jf2",
        on: false,
        ownUrls: undefined,
        perPage: 10000,
        sentFile: 'sent.json',
        sentFileTest: 'testSent.json',
        typeIcons: true,
        types: ['mention-of', 'in-reply-to'],
        wmDir: '_data/webmentions/cache',
    };
    ctx.cfg.mergeSect('webmentionsSpec', defaultWebmentionsSpec, true);

    // Set up event responses.
    ctx.on('AFTER_ARTICLE_PARSER_RUN', afterArticleParserRun);
}

