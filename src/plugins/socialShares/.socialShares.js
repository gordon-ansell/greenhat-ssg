/**
 * @file        Social shares plugin.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

 const { syslog } = require('greenhat-util/syslog');
 const Html = require('greenhat-util/html');
 const path = require('path');

/**
 * Get the social share links.
 * 
 * @param   {object}    article     Article to get the links for.
 * @return  {string}                Share links. 
 */
function getSocialShareLinks(article)
{
    let ret = '';

    let spec = this.cfg.socialSharesSpec;

    for (let item of spec.wanted) {
        if (!spec.linkDefs[item]) {
            syslog.warning(`No social share definition for ${item}.`, article.relPath);
            continue;
        }

        let img = new Html('img');

        let srcName = 'src'
        if (this.cfg.site.lazyload) {
            srcName = 'data-src';
            img.appendParam('class', this.cfg.site.lazyclass);
        }

        let p = path.join(spec.iconLoc, item + spec.iconExt);

        img.addParam(srcName, p);
        img.addParam('alt', "Share icon for " + item + ".");

        let link = spec.linkDefs[item];

        link = link.replaceAll('[URL]', this.qualify(article.url))
            .replaceAll('[TITLE]', encodeURI(article.title))
            .replaceAll('[WSURL]', escape(this.qualify('/')))
            .replaceAll('[WSTITLE]', encodeURI(this.cfg.site.title));

        if (item == 'email') {
            if (!this.cfg.site.publisher.email) {
                syslog.warning("Publisher email is requited for 'email' share.");
            } else {
                link = link.replaceAll('[EMAIL]', this.cfg.site.publisher.email);
            }
        }

        let a = new Html('a');
        a.addParam('href', link);
        if (item == 'permalink') {
            a.addParam('title', "Permalink for this article.");
        } else if (item == "email") {
            a.addParam('title', "Respond to the author of this article via email.");
        } else {
            a.addParam('title', "Share on " + item + ".");
        }

        ret += '<span class="sharelink">' + a.resolve(img) + '</span>';
    } 

    return ret;
}

/**
 * Initialisation.
 */
module.exports = ctx => {

    syslog.trace('.socialShares', 'Initialising plugin.');

    // Load some configs.
    let defaultSocialSharesSpec = {
        wanted: ['facebook', 'twitter', 'mix', 'email', 'permalink'],
        iconLoc: '/assets/images/shares/',
        iconExt: '.png',
        linkDefs: {
            facebook: "https://www.facebook.com/sharer/sharer.php?u=[URL]&t=[TITLE]",
            twitter: "https://twitter.com/intent/tweet?url=[URL]&text=[TITLE]",
            reddit: "https://www.reddit.com/submit?url=[URL]&title=[TITLE]",
            linkedin: "https://www.linkedin.com/shareArticle?mini=true&url=[URL]&title=[TITLE]&source=[WSTITLE]&summary=[WSURL]",
            mix: "https://mix.com/add?url=[URL]",
            email: "mailto:[EMAIL]?subject=[TITLE]&body=[URL]",	
            permalink: "[URL]",          
        }
    };

    ctx.cfg.mergeSect('socialSharesSpec', defaultSocialSharesSpec, true);

    ctx.addCallable(getSocialShareLinks);

}

