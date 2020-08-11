/**
 * @file        Webmentions plugin.
 * @module      plugins/webMentions
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

const WebMentionsProcessor = require("./webMentionsProcessor");
const { syslog, merge } = require("greenhat-base");

/**
 * Called after config processing.
 */
function AfterConfig()
{
    syslog.trace('plugin:webMentions:afterConfig', "Responding to hook.");

    let defaultWebmentionsSpec = {
        apiKey: undefined,
        cacheFile: 'received.json',
        cacheFileTest: 'testReceived.json',
        id: undefined,
        mentionsApi: "https://webmention.io/api/mentions.jf2",
        on: false,
        ownUrls: undefined,
        perPage: 10000,
        sentFile: 'sent.json',
        sentFileTest: 'testSent.json',
        typeIcons: true,
        types: ['mention-of', 'in-reply-to'],
        wmDir: '_webmentions',
    };

    if (this.ctx.config.webmentionsSpec) {
        this.ctx.config.webmentionsSpec = merge(defaultWebmentionsSpec, this.ctx.config.webmentionsSpec);
    } else {
        this.ctx.config.webmentionsSpec = defaultWebmentionsSpec;
    }
}

/**
 * Called after the filesystem parse.
 */
async function AfterFileSystemParse()
{
    syslog.trace('plugin:webMentions:afterFileSystemParse', "Responding to hook.");

    if (this.ctx.config.site.webMentions !== true) {
        return true;
    }  

    syslog.notice("Processing webmentions received.");

    let proc = WebMentionsProcessor.getProcessor(this.ctx);
    await proc.process();
}

/**
 * Called after article is parsed.
 */
async function AfterArticleParse(article)
{
    syslog.trace('plugin:webMentions:AfterArticleParse', "Responding to hook.");

    if (!this.ctx.config.site.webMentions) {
        return;
    }

    let proc = WebMentionsProcessor.getProcessor(this.ctx);

    // Received.

    let wmentions = proc.mentionsForUrl(this.ctx.qualify(article.url));

    if (wmentions && wmentions.length > 0) {
        article.wmentions = wmentions;
        syslog.info(`Post ${article.url} has ${wmentions.length} webmentions.`);
    } else {
        syslog.trace(`Post ${article.url} has no webmentions.`);
    }

    // To send.

    if (!article.webmentions) {
        return;
    }

    let test = (this.ctx.mode == 'dev') ? true : false;

    for (let wm of article.webmentions) {
        if (!proc.hasBeenSent(article.url, wm, test)) {
            await proc.send(article.url, wm, test);
        }
    }

}

exports.AfterConfig = AfterConfig;
exports.AfterFileSystemParse = AfterFileSystemParse;
exports.AfterArticleParse = AfterArticleParse;

