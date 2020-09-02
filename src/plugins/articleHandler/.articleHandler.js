/**
 * @file        Article handler plugin.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

const { syslog } = require('greenhat-util/syslog');
const ArticleParser = require('./articleParser');
const ArticleRenderer = require('./articleRenderer');

let articleParserClass = null;
let articleRenderClass = null;

/**
 * Parse.
 *
 * @param   {string}  file  File to parse.
 * @return  {object}        Article object.
 */
async function parse(file)
{
    if (articleParserClass == null) {
        articleParserClass = new ArticleParser(this);
    }
    return await articleParserClass.parse(file);
}

/**
 * Render.
 *
 * @param   {object}  article  Article to render.
 */
async function render(article)
{
    if (articleRenderClass == null) {
        articleRenderClass = new ArticleRenderer(this);
        this.on('ARTICLE_PRERENDER', articleRenderClass.prerender, 100);
    }
    await articleRenderClass.render(article);
}

/**
 * Initialisation.
 */
module.exports = ctx => {

    syslog.trace('.articleHandler', 'Initialising plugin.');

    // Load some configs.
    let acfg = {
        types: {
            post: {
                fnStart: "^\\d{4}-\\d{2}-\\d{2}-",
                fnGrabLen: 10,    
                dirs: ['/_posts'],
                combineTest: 'or',
                defaultConfig: {
                    sitemap: true,
                    feed: true,
                    robots: 'index, follow, NOODP',
                    permalink: ':fn',
                    breadcrumbs: [':home', ':tags-0', ':tags-1', ':fn'],
                    arq: true,
                }
            },
            page: {
                defaultConfig: {
                    sitemap: true,
                    feed: false,
                    robots: 'index, follow, NOODP',
                    permalink: ':path/:fn',
                    arq: true,
                }
            },
        },
        defaultType: 'page',
        defaultPermalink: ':fn',
        defaultBreadcrumbs: [':home', ':path', ':fn'],
        dispDate: "dS mmmm yyyy",
        dispTime: "HH:MM",     
        indexFn: 'index',  
        outputExt: '.html',  
        outputMode: 'directory',
        excerptExtractLen: 300,
        descriptionExtractLen: 160,
        taxonomyTypes: ['tags'],
        multiFormat: ['content', 'contentRss', 'excerpt', 'summary'],
        terminateUrl: '/',
        homePageType: 'post',
    }
    ctx.cfg.mergeSect('articleSpec', acfg, true);

    // Set the article parser.
    ctx.setExtensionParser('md', parse);

    // Set the article renderer.
    ctx.setExtensionRenderer('njk', render);
}
