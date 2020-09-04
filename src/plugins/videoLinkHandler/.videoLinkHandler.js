/**
 * @file        Video link handler plugin.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { syslog } = require("greenhat-util/syslog");
const Video = require("./video");

/**
 * Called after article parsed.
 */
async function afterArticleParserRun(article)
{
    syslog.trace('.videoLinkHandler:afterArticleParserRun', "Responding to hook.");

    if (!article.videos) {
        return;
    }

    article.videoObjs = {};

    for (let videoKey in article.videos) {
        let newVid = new Video(this.cfg.videoLinkSpec, article.videos[videoKey], this);
        article.videoObjs[videoKey] = newVid; 
    }

}

/**
 * Called before rendering.
 */
async function articlePrerender(article)
{
    syslog.trace('.videoLinkHandler:articlePrerender', "Responding to hook.");

    if (!article.videos || !article.videoObjs) {
        return;
    }

    for (let item of ['content', 'excerpt']) {
        
        let html = article[item].html;
        let htmlRss = article[item + 'Rss'].html;

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
                
        article[item].html = html;
        article[item + 'Rss'].html = htmlRss;
    }
}

/**
 * Initialisation.
 */
module.exports.init = ctx => {

    syslog.trace('.videoLinkHandler', 'Initialising plugin.');

    // Load some configs.
    let vcfg = {
        types: {
            youtube: {
                urls: {
                    contentUrl: "https://www.youtube.com/watch?v=[[TAG]]",
                    embedUrl: "https://www.youtube.com/embed/[[TAG]]",
                    thumbnailUrl: "https://img.youtube.com/vi/[[TAG]]/default.jpg",
                },
                width: 500,
                height: 315,
            },
            bbc: {
                urls: {
                    contentUrl: "[[URL]]",
                    embedUrl: "https://www.bbc.co.uk/[[SECTION]]/av/embed/[[TAG]]",
                    thumbnailUrl: "https://static.bbc.co.uk/news/1.315.03594/web-app-launch-icon.png",
                },
                width: 560,
                height: 315,
            }
        }
    }
    ctx.cfg.mergeSect('videoLinkSpec', vcfg, true);

    // Set up event responses.
    ctx.on('AFTER_ARTICLE_PARSER_RUN', afterArticleParserRun);
    ctx.on('ARTICLE_PRERENDER', articlePrerender);
}

