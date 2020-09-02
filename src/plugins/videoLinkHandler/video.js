/**
 * @file        Video link object.
 * @module      Video
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

const Html = require("greenhat-util/html");
const { syslog } = require("greenhat-util/syslog");

/**
 * Video link class.
 */
class Video
{
    tag = '';
    section = '';
    url = '';

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

        for (let item in spec.types[this.type].urls) {
            this[item] = spec.types[this.type].urls[item]
                .replaceAll('[[TAG]]', this.tag)
                .replaceAll('[[SECTION]]', this.section)
                .replaceAll('[[URL]]', this.url);
        }

        /*
        if (this.type == 'youtube') {
            this.embedUrl = "https://www.youtube.com/embed/" + this.tag;
            this.contentUrl = "https://www.youtube.com/watch?v=" + this.tag;
            this.thumbnailUrl = "https://img.youtube.com/vi/" + this.tag + "/default.jpg";
        } else if (this.type == 'bbc') {
            this.embedUrl = "https://www.bbc.co.uk/" + this.section + "/av/embed/" + this.tag;
            this.contentUrl = this.url;
            this.thumbnailUrl =  "https://static.bbc.co.uk/news/1.315.03594/web-app-launch-icon.png";
        }
        */
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
        let src = this.embedUrl;
        let t = this.spec.types[this.type];

        let srcName = 'src';
        if (this.ctx.cfg.site.lazyload && lazy) {
            srcName = 'data-src';
        }

        html.addParam(srcName, src);

        html.addParam('width', t.width);
        html.addParam('height', t.height);
        html.addParam('frameborder', '0');
        html.addParam('allowfullscreen', true);

        classes.push('video-frame');

        if (this.ctx.cfg.site.lazyload && lazy) {
            html.appendParam('class', this.ctx.cfg.site.lazyclass);
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
        let src = this.embedUrl;
        let t = this.spec.types[this.type];

        let srcName = 'src';
        if (this.ctx.cfg.site.lazyload && lazy) {
            srcName = 'data-src';
        }

        html.addParam(srcName, src);

        html.addParam('width', t.width);
        html.addParam('height', t.height);
        html.addParam('frameborder', '0');
        html.addParam('allowfullscreen', true);

        classes.push('video-frame');

        if (this.ctx.cfg.site.lazyload && lazy) {
            html.appendParam('class', this.ctx.cfg.site.lazyclass);
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
        let typeKeys = Object.keys(this.spec.types);
        if (!typeKeys.includes(this.type)) {
            syslog.error(`Invalid video type '${this.type}'.`);
            return '';
        }

        let func = 'getHtml' + this.type;
        if (typeof this[func] != 'function') {
            syslog.error(`No video processing function for type '${this.type}'.`);
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
