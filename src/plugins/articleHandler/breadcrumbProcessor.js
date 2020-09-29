/**
 * @file        Breadcrumb processor.
 * @module      BreadcrumbProcessor
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const syslog = require('greenhat-util/syslog');
const path = require('path');
const GreenHatSSGError = require('../../ssgError');
const str = require("greenhat-util/string");

class GreenHatSSGArticleError extends GreenHatSSGError {}

/**
 * Breadcrumb processor class.
 */
class BreadcrumbProcessor
{
    /**
     * Sanitize a URL (that might have taxonomies in it).
     * 
     * @param   {string}    url     Input URL.
     * @return  {string}            Sanitized. 
     */
    _sanitizeUrl(url)
    {
        let urlsp = url.split(path.sep);
        let urlNew = [];
        for (let p of urlsp) {
            urlNew.push(str.slugify(p));
        }
        return path.join(path.sep, urlNew.join(path.sep), path.sep);
    }
    
    /**
     * Process a breadcrumb element.
     * 
     * @param   {object}    elem        Element to process.
     * @param   {object}    article     Article we're processing.
     * @return  {object}                {name, url, skip}
     */
    static processBreadcrumbElement(elem, article, ctx)
    {
        if (!elem.calc && !(elem.name && elem.url)) {
            throw new GreenHatSSGArticleError(`Breadcrumbs should have either a 'calc' field or both the 'name' and 'url' fields.`,
                article.relPath);
        }
        
        let ts = ctx.cfg.taxonomySpec;
        
        let name;
        let url;
        let skip = false;
        if (elem.name && elem.url) {
            name = String(elem.name).charAt(0).toUpperCase() + String(elem.name).slice(1);
            url = elem.url;
        } else if (elem.calc) {
            if (elem.calc == 'self') {
                name = article.name;
                url = article.url;
            } else if (elem.calc == 'path') {
                if (article.dirname && article.dirname != '' && article.dirname != '/') {
                    name = str.ucfirst(str.trimChar(article.dirname, path.sep));
                    url = path.join(path.sep, article.dirname, path.sep)
                } else {
                    skip = true;
                }
            } else if (elem.calc.includes('#')) {
                let sp = elem.calc.split('#');
                if (!article[sp[0]]) {
                    syslog.warning(`Article has no '${sp[0]}' from which to extract breadcrumbs.`,
                        article.relPath);
                    skip = true;
                } else {
                    let tax = sp[0];
                    let spec = ts[tax];
                    let index = sp[1];
                    if (!article[tax][index]) {
                        syslog.warning(`Article has no '${tax}' index ${index} from which to extract breadcrumbs.`,
                            article.relPath);
                        skip = true;
                    } else {
                        name = str.ucfirst(article[tax][index]);
                        url = path.join(path.sep, spec.path, name, path.sep);
                    }
                }
            }

        }

        return {name: name, url: url, skip: skip};
    }

}

module.exports = BreadcrumbProcessor;