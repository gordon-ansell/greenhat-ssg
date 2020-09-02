/**
 * @file        Webmentions processor.
 * @module      WebmentionsProcessor
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

const path = require('path');
const fs = require('fs');
const sanitizeHTML = require('sanitize-html');
const wmsend = require('send-webmention')
const { syslog } = require("greenhat-util/syslog");
const { mkdirRecurse } = require('greenhat-util/fs');
const GreenHatSSGError = require("../../ssgError");

/**
 * Webmentions processing class.
 */
class WebmentionsProcessor
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
        if (WebmentionsProcessor.proc == null) {
            WebmentionsProcessor.proc = new WebmentionsProcessor(ctx);
        }
        return WebmentionsProcessor.proc;
    }

    /**
     * Constructor.
     * 
     * @param   {object}    ctx     Context.
     */
    constructor(ctx)
    {
        this.ctx = ctx;
        this.spec = this.ctx.cfg.webmentionsSpec;
        this.mentions = this.ctx.data.webmentions;
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
                    throw new GreenHatSSGError("Failed to send webmention from: " + source + " to: " + target);
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

module.exports = WebmentionsProcessor;
