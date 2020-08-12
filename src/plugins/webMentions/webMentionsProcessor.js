/**
 * @file        Webmentions processor.
 * @module      plugins/webMentions
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

const fetch = require('node-fetch');
const unionBy = require('lodash/unionBy');
const path = require('path');
const fs = require('fs');
const sanitizeHTML = require('sanitize-html');
const wmsend = require('send-webmention')
const { syslog, GreenhatError } = require("greenhat-base");
const { mkdirRecurse } = require('greenhat-base/src/utils/filesystem');

/**
 * Webmentions processing class.
 */
class WebMentionsProcessor
{
    /**
     * Processor.
     */
    static proc = null;

    /**
     * The mentions (received) themselves.
     */
    mentions = null;

    /**
     * The mentions (sent).
     */
    mentionsSent = null;

    /**
     * Get the processor.
     * 
     * @param   {object}    ctx     Context.
     * @return  {object}            Processor instance.
     */
    static getProcessor(ctx)
    {
        if (WebMentionsProcessor.proc == null) {
            WebMentionsProcessor.proc = new WebMentionsProcessor(ctx);
        }
        return WebMentionsProcessor.proc;
    }

    /**
     * Constructor.
     * 
     * @param   {object}    ctx     Context.
     */
    constructor(ctx)
    {
        this.ctx = ctx;
        this.spec = this.ctx.config.webmentionsSpec;
    }

    /**
     * Merge the webmentions.
     * 
     * @param   {object}    a   First object.
     * @param   {object}    b   Second object.
     * 
     * @return  {object}        Unioned object.
     */
    mergeWebMentions(a, b)
    {
        return unionBy(a.children, b.children, 'wm-id');
    }

    /**
     * Read webmentions cache.
     * 
     * @param   {boolean}   test    Test?
     * @return  {object}            Object with last fetched date and all the mentions.
     */
    readWebMentionsCache(test = false)
    {
        let ret = {
            lastFetched: null,
            children: []
        };

        let fn = (test) ? this.spec.cacheFileTest : this.spec.cacheFile;

        const wmCachePath = path.join(this.ctx.sitePath, this.spec.wmDir, fn);

        if (fs.existsSync(wmCachePath)) {
            let parsed = JSON.parse(fs.readFileSync(wmCachePath));
            ret.lastFetched = parsed.lastFetched;
            ret.children = parsed.children;
        }

        return ret;
    }

    /**
     * Write webmentions cache.
     * 
     * @param   {object}    data    Data to write.
     * @param   {boolean}   test    Test?
     */
    writeWebMentionsCache(data, test = false)
    {
        let fn = (test) ? this.spec.cacheFileTest : this.spec.cacheFile;

        const wmCachePath = path.join(this.ctx.sitePath, this.spec.wmDir, fn);

        let final = JSON.stringify(data, null, 2);

        fs.writeFileSync(wmCachePath, final);
    }

    /**
     * Fetch any new webmentions.
     * 
     * @param   {string}    since   Fetch since when?
     * @return  {object}            New webmentions.
     */
    async fetchNewWebMentions(since = null)
    {
        // Sanity checks.     
        if (!this.spec.mentionsApi) {
            syslog.error("No webmentions API URL specified.");
            return null;
        }

        if (!this.spec.id) {
            syslog.error("No webmentions id specified.");
            return null;
        }

        if (!this.spec.apiKey) {
            syslog.error("No webmentions API key specified.");
            return null;
        }

        // See if there are any new webmentions.
        let wmUrl = this.spec.mentionsApi + '?domain=' + this.spec.id + 
            '&token=' + this.spec.apiKey;

        if (since) {
            wmUrl += '&since=' + since;
        }

        if (this.spec.perPage) {
            wmUrl += '&per-page=' + this.spec.perPage; 
        }

        const response = await fetch(wmUrl);

        let feed = null;

        if (response.ok) {
            feed = await response.json();
            return feed;
        } 

        return null;
    }

    /**
     * Processor.
     * 
     * @return  True.
     */
    async process()
    {
        if (this.ctx.config.site.webMentions !== true) {
            return true;
        }  

        let isDev = (this.ctx.mode == 'dev') ? true : false;

        let wmCached; 
        
        if (isDev) {
            wmCached = this.readWebMentionsCache(true);
            syslog.info("Using test webmentions as we're in dev mode.")
        } else {
            wmCached = this.readWebMentionsCache();
        }

        if (!isDev) {
            let newFeed = await this.fetchNewWebMentions(wmCached.lastFetched);

            if (newFeed) {
                syslog.notice("==> We have " + newFeed.children.length + " NEW webmentions.");
                const wmFeed = {
                    lastFetched: new Date().toISOString(),
                    children: this.mergeWebMentions(wmCached, newFeed).children
                }

                this.writeWebMentionsCache(wmFeed, isDev);
                this.mentions = wmFeed.children;

                return true;
            }
        }

        this.mentions = wmCached.children;
        syslog.info('We have ' + this.mentions.length + ' webmentions in total.');
        return true;
    }

    /**
     * Get the web mentions for a particular URL.
     * 
     * @param   {string}    url     URL to get them for.
     * @return  {object}            Webmentions.
     */
    mentionsForUrl(url)
    {
        if (!this.mentions) {
            return null;
        }

        const hasRequiredFields = (entry) => {
            const { author, published, content } = entry
            return author.name && published && content
        }

        const sanitize = (entry) => {
            const { content } = entry;
            if (content['content-type'] === 'text/html') {
                content.value = sanitizeHTML(content.value);
            }
            return entry
        }

        return this.mentions
            .filter((entry) => entry['wm-target'] === url)
            .filter((entry) => this.spec.types.includes(entry['wm-property']))
            .filter(hasRequiredFields)
            .map(sanitize)
    }

    /**
     * Get the webmentions sent.
     * 
     * @param   {boolean}   reload  Reload from the disk file?
     * @param   {bollean}   test    Test mode?
     * 
     * @returns {string[]}          Array of webmentions sent.
     */
    webMentionsSent(reload = false, test = false)
    {
        if (reload) {
            this.mentionsSent = null;
        }

        if (this.mentionsSent === null) {
            let fnt = (test) ? this.spec.sentFileTest : this.spec.sentFile;
            let fn = path.join(this.ctx.sitePath, this.spec.wmDir, fnt);
            if (fs.existsSync(fn)) {
                this.mentionsSent = JSON.parse(fs.readFileSync(fn, 'utf8'));
            } else {
                this.mentionsSent = [];
            }
        }

        return this.mentionsSent;
    }

    /**
     * See if we've sent a webmention.
     * 
     * @param   {string}    source  Source URL.
     * @param   {string}    target  Target URL.
     * 
     * @return  {string|boolean}    DateTime it has been sent, else false.
     */
    hasBeenSent(source, target, test = false)
    {
        let t = source + '|' + target;
        for (let line of this.webMentionsSent(false, test)) {
            if (line.startsWith(t)) {
                return line.split('|')[2];
            }
        }
        return false;
    }
 
    /**
     * Send a web mention.
     * 
     * @param   {string}    source  Source URL.
     * @param   {string}    target  Tarjet URL.
     * @param   {string}    test    Testing?
     */
    async send(source, target, test = false)
    {
        if (!test) {

            await wmsend(this.ctx.qualify(source), target, (err, obj) => {
                if (err) throw err;

                if (obj.success) {
                    syslog.notice("==> Sent webmention from: " + source + " to: " + target);
                    this.logSent(source, target, false);
                } else {
                    throw new GreenhatError("Failed to send webmention from: " + source + " to: " + target);
                }
            });

        } else {

            syslog.notice("==> Dummy webmention send from: " + source + " to: " + target);
            this.logSent(source, target, true);

        }
    }
 
    /**
     * Log that webmention has been sent.
     * 
     * @param   {string}    source  Source URL.
     * @param   {string}    target  Target URL.
     * @param   {boolean}   test    Testing?
     */
    logSent(source, target, test = false)
    {
        let line = source + '|' + target + '|' + new Date().toISOString();
        this.mentionsSent.unshift(line);    
        let fnt = (test) ? this.spec.sentFileTest : this.spec.sentFile;
        let fn = path.join(this.ctx.sitePath, this.spec.wmDir, fnt);
        mkdirRecurse(path.dirname(fn));
        fs.writeFileSync(fn, JSON.stringify(this.mentionsSent, null, 1));
        this.mentionsSent = null;   
    }

}

module.exports = WebMentionsProcessor;
