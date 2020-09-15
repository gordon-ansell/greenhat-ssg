/**
 * @file        Pre render links plugin.
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
    syslog.trace('.preRenderLinks:articlePrerender', "Responding to hook.");

    for (let item of ['content', 'excerpt']) {
    
        let html = article[item].html;
        let htmlRss = article[item + 'Rss'].html;
    
        const regex = /\(\(\((.+?)\|(.+?)\)\)\)/g;
        let m;
        while ((m = regex.exec(html)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }
    
            if (m) {
                if (m[2].includes('|')) {
                    let sp = m[2].split('|');
                    let l1 = this.link(m[1], sp[0], sp[1]);
                    let l2 = this.link(m[1], this.qualify(sp[0]), sp[1]);
                    html = html.replace(m[0], l1);
                    htmlRss = htmlRss.replace(m[0], l2);
                } else {
                    let l1 = this.link(m[1], m[2]);
                    let l2 = this.link(m[1], this.qualify(m[2]));
                    html = html.replace(m[0], l1);
                    htmlRss = htmlRss.replace(m[0], l2);
                }
            }
        }
            
        // Check all preprocessing done.
        const chk = /\(\(\((.+?)\)\)\)/;
        if (chk.exec(html) !== null) {
            syslog.warning("Preprocessing '(((...)))' elements still remain.", article.relPath);
        }

        // Now replace escaped stuff.
        html = html.split("%(%(%(").join("(((");
        html = html.split("%)%)%)").join(")))");
        htmlRss = htmlRss.split("%(%(%(").join("(((");
        htmlRss = htmlRss.split("%)%)%)").join(")))");

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
    ctx.on('ARTICLE_PRERENDER', articlePrerender, 100);
}

