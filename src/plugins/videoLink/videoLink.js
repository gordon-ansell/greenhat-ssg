/**
 * @file        Video link handler plugin.
 * @module      plugins/videoLink
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

const { syslog, merge } = require("greenhat-base"); 
const Video = require('./video');

/**
 * Called after config processing.
 */
function AfterConfig()
{
    syslog.trace('plugin:videoLink:afterConfig', "Responding to hook.");

    let defaultVideoSpec = {
        youtube: {
            contentUrl: "https://www.youtube.com/watch?v=[[TAG]]",
            embedUrl: "https://www.youtube.com/embed/[[TAG]]",
            thumbnailUrl: "https://img.youtube.com/vi/[[TAG]]/default.jpg",
        },
        bbc: {
            embedUrl: "https://www.bbc.co.uk/[[SECTION]]/av/embed/[[TAG]]",
            thumbnailUrl: "https://static.bbc.co.uk/news/1.315.03594/web-app-launch-icon.png",
        }
    };

    if (this.ctx.config.videoSpec) {
        this.ctx.config.videoSpec = merge(defaultVideoSpec, this.ctx.config.videoSpec);
    } else {
        this.ctx.config.videoSpec = defaultVideoSpec;
    }

    this.ctx.videos = new Map();
}

/**
 * Called after article is parsed.
 */
async function AfterArticleParse(article)
{
    syslog.trace('plugin:videoLink:AfterArticleParse', "Responding to hook.");

    if (!article.videos) {
        return;
    }

    article.videoObjs = {};

    for (let videoKey in article.videos) {
        let newVid = new Video(this.ctx.config.videoSpec, article.videos[videoKey], this.ctx);
        if (!newVid.type) {
            newVid.type = 'youtube';
        }
        article.videoObjs[videoKey] = newVid; 
    }

    //syslog.inspect(article.videoObjs);
}

/**
 * Called before rendering.
 */
async function PreRenderArticle(article)
{
    syslog.trace('plugin:videoLink:PreRenderArticle', "Responding to hook.");

    if (!article.videos || !article.videoObjs) {
        return;
    }

    let html = article.content.html;
    let htmlRss = article.contentRss.html;

    if (article.videoObjs) {
        const regex = /\(\(\(video\-(.+?)\)\)\)/g;
        let m;
        while ((m = regex.exec(html)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }

            if (m) {
                if (article.videoObjs[m[1]]) {
                    html = html.replace(m[0], article.videoObjs[m[1]].getHtml());
                    htmlRss = htmlRss.replace(m[0], article.videoObjs[m[1]].getHtml(false));
                } else {
                    syslog.error("Could not find an video object with ID '" + m[0] + "'.", article.relPath);
                }
            }
        }

    }

    article.content.html = html;
    article.contentRss.html = htmlRss;
}

exports.AfterConfig = AfterConfig;
exports.AfterArticleParse = AfterArticleParse;
exports.PreRenderArticle = PreRenderArticle;
