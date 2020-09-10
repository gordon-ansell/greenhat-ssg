/**
 * @file        Schema 'Article'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const CreativeWork = require("./creativeWork");

class Article extends CreativeWork
{

    articleBody(val) {return this.setProp('articleBody', val);}
    articleSection(val) {return this.setProp('articleSection', val);}
    wordCount(val) {return this.setProp('wordCount', val);}

}

module.exports = Article;
