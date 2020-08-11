/**
 * @file        Video link object.
 * @module      plugins/videoLink
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

const { Html } = require("greenhat-base");
const { syslog } = require("greenhat-base/src/logger");

/**
 * Vodeo link class.
 */
class Video
{
    /**
     * Constructor.
     * 
     * @param   {object}    spec    Video spec. 
     * @param   {object}    defs    Definitions for this video.
     * @param   {object}    ctx     Context.
     */
    constructor(spec, defs, ctx)
    {
        this.spec = spec;
        this.ctx = ctx;
        for (let key in defs) {
            this[key] = defs[key];
        }

        if (!this.type) {
            this.type = 'youtube';
        }

        if (this.type == 'youtube') {
            this.embedUrl = "https://www.youtube.com/embed/" + this.tag;
            this.contentUrl = "https://www.youtube.com/watch?v=" + this.tag;
            this.thumbnailUrl = "https://img.youtube.com/vi/" + this.tag + "/default.jpg";
        } else if (this.type == 'bbc') {
            this.embedUrl = "https://www.bbc.co.uk/" + this.section + "/av/embed/" + this.tag;
            this.contentUrl = this.url;
            this.thumbnailUrl =  "https://static.bbc.co.uk/news/1.315.03594/web-app-launch-icon.png";
        }
    }

    /**
     * Get the HTML for a youtube video.
     * 
     * @param   {string[]}  classes Possible classes.
     * @param   {boolean}   lazy    Allow lazy load?
     * @return  {object}            HTML object.
     */
    getHtmlyoutube(classes, lazy = true)
    {
        let html = new Html('iframe');
        let src = "https://www.youtube.com/embed/" + this.tag;

        let srcName = 'src';
        if (this.ctx.config.site.lazyload && lazy) {
            srcName = 'data-src';
        }

        html.addParam(srcName, src);

        html.addParam('width', 500);
        html.addParam('height', 315);
        html.addParam('frameborder', '0');
        html.addParam('allowfullscreen', true);

        classes.push('video-frame');

        if (this.ctx.config.site.lazyload && lazy) {
            html.appendParam('class', this.ctx.config.site.lazyclass);
        }

        return html;
    }

    /**
     * Get the HTML for a bbc video.
     * 
     * @param   {string[]}  classes Possible classes.
     * @param   {boolean}   lazy    Allow lazy load?
     * @return  {object}            HTML object.
     */
    getHtmlbbc(classes, lazy = true)
    {
        let html = new Html('iframe');
        let src = "https://www.bbc.co.uk/" + this.section + "/av/embed/" + this.tag

        let srcName = 'src';
        if (this.ctx.config.site.lazyload && lazy) {
            srcName = 'data-src';
        }

        html.addParam(srcName, src);

        html.addParam('width', 560);
        html.addParam('height', 315);
        html.addParam('frameborder', '0');
        html.addParam('allowfullscreen', true);

        classes.push('video-frame');

        if (this.ctx.config.site.lazyload && lazy) {
            html.appendParam('class', this.ctx.config.site.lazyclass);
        }

        return html;
    }

    /**
     * Get the video HTML.
     * 
     * @param   {boolean}   lazy    Allow lazy load?
     * @return  {string}            HTML string.
     */
    getHtml(lazy = true)
    {
        let typeKeys = Object.keys(this.spec);
        if (!typeKeys.includes(this.type)) {
            syslog.error(`Invalid video type '${this.type}'.`);
            return '';
        }

        let func = 'getHtml' + this.type;
        if (typeof this[func] != 'function') {
            syslog.error(`No video processing function for type '${video.type}'.`);
            return '';
        }

        let classes = [];

        let iframe = this[func].call(this, classes, lazy);

        if (this.caption) {
            let figHtml = new Html('figure', 'figcaption');
            figHtml.appendParam('class', classes.join(' '));
            figHtml.getInner().setData(this.caption);
            return figHtml.resolve(iframe);
        } else {
            iframe.appendParam('class', classes.join(' '));
            return iframe.resolve();
        }
    }
}

module.exports = Video;
