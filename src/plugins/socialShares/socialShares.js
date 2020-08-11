/**
 * @file        Social shares plugin.
 * @module      plugins/socialShares
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const path = require('path');
const { syslog, merge, Html, replaceAll } = require("greenhat-base"); 

/**
 * Called after config processing.
 */
function AfterConfig()
{
    syslog.trace('plugin:scss:socialShares', "Responding to hook.");

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

    if (this.ctx.config.socialSharesSpec) {
        this.ctx.config.socialSharesSpec = merge(defaultSocialSharesSpec, this.ctx.config.socialSharesSpec);
    } else {
        this.ctx.config.socialSharesSpec = defaultSocialSharesSpec;
    }
}


exports.AfterConfig = AfterConfig;