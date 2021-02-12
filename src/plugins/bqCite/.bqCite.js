/**
 * @file        Block quote citation plugin.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const syslog = require('greenhat-util/syslog');

/**
 * Called before rendering.
 */
async function articlePrerender(article)
{
    syslog.trace('.bqCite:articlePrerender', "Responding to hook.");

    for (let item of ['content', 'abstract']) {
    
        let html = article[item].html;
        let htmlRss = article[item + 'Rss'].html;
    
        const regex = /\(\(\(bqcite\-(.+?)\)\)\)/g;
        let m;
        while ((m = regex.exec(html)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }
    
            if (m) {
                if (m[1].includes('|')) {
                    let sp = m[1].split('|');
                    let c = "<cite>" + sp[0] + "</cite>";
                    let l1 = '<span class="article-bqcite">&mdash; ' + this.link(c, sp[1], 
                        "Go to the quoted article.", null, "_blank") + '</span>';
                    let l2 = '<span class="article-bqcite">&mdash; ' + this.link(c, this.qualify(sp[1]), 
                    "Go to the quoted article.", null, "_blank") + '</span>';
                    html = html.replace(m[0], l1);
                    htmlRss = htmlRss.replace(m[0], l2);
                } else {
                    let c = '<span class="article-bqcite">&mdash; <cite>' + m[1] + '</cite></span>';
                    html = html.replace(m[0], c);
                    htmlRss = htmlRss.replace(m[0], c);
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

    syslog.trace('.preRenderLinks', 'Initialising plugin.');
    // Set up event responses.
    ctx.on('ARTICLE_PRERENDER', articlePrerender, 50);
}

