/**
 * @file        Article handler plugin.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

const syslog = require('greenhat-util/syslog');
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
    let ret = await articleParserClass.parse(file);
    this.counts.articles++;
    if (ret.type == 'post') {
        this.counts.posts++;
    } else {
        this.counts.pages++;
    }
    this.counts.words += ret.words;
    return ret;
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
module.exports.init = ctx => {

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
                    breadcrumbs: {
                        1: {
                            name: 'Home',
                            url: '/'
                        },
                        2: {
                            calc: 'tags#0'
                        },
                        3: {
                            calc: 'tags#1'
                        },
                        4: {
                            calc: 'self'
                        },
                    },
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
                    breadcrumbs: {
                        1: {
                            name: 'Home',
                            url: '/'
                        },
                        2: {
                            calc: 'self'
                        },
                    },
                }
            },
        },
        defaultType: 'page',
        defaultPermalink: ':fn',
        defaultBreadcrumbs: {
            1: {
                name: 'Home',
                url: '/'
            },
            2: {
                calc: 'path'
            },
            3: {
                calc: 'self'
            },
        },
        dispDate: "dS mmmm yyyy",
        dispTime: "HH:MM",     
        indexFn: 'index',  
        outputExt: '.html',  
        outputMode: 'directory',
        abstractExtractLen: 200,
        descriptionExtractLen: 160,
        taxonomyTypes: ['tags'],
        multiFormat: ['content', 'contentRss', 'abstract', '_summary'],
        terminateUrl: '/',
        homePageType: 'post',
    }
    ctx.cfg.mergeSect('articleSpec', acfg, true);

    // Set the article parser.
    ctx.setExtensionParser('md', parse);

    // Set the article renderer.
    ctx.setExtensionRenderer('njk', render);

    ctx.counts.articles = 0;
    ctx.counts.posts = 0;
    ctx.counts.pages = 0;
    ctx.counts.words = 0;
}