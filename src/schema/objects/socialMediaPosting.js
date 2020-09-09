/**
 * @file        Schema 'SocialMediaPosting'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const Article = require("./article");

class SocialMediaPosting extends Article
{

    sharedContent(val) {return this.setProp('sheredContent', val);}

}

module.exports = SocialMediaPosting;
