/**
 * @file        Pre-render links.
 * @module      plugins/preLinks
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

const { syslog } = require("greenhat-base"); 

/**
 * Called before rendering.
 */
async function PreRenderArticle(article)
{
    syslog.trace('plugin:preLinks:PreRenderArticle', "Responding to hook.");

    let html = article.content.html;
    let htmlRss = article.contentRss.html;
 
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
                let l1 = this.ctx.link(m[1], sp[0], sp[1]);
                let l2 = this.ctx.qualify(l1);
                html = html.replace(m[0], l1);
                htmlRss = htmlRss.replace(m[0], l2);
            } else {
                let l1 = this.ctx.link(m[1], m[2]);
                let l2 = this.ctx.qualify(l1);
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

    article.content.html = html;
    article.contentRss.html = htmlRss;

}

exports.PreRenderArticle = PreRenderArticle;

