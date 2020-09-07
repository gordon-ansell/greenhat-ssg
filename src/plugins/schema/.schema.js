/**
 * @file        Schema plugin.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

const { syslog } = require('greenhat-util/syslog');
const SchemaProcessor = require("./schemaProcessor");

/**
 * Called after article parser run.
 */
async function afterArticleParserRun(article)
{
    syslog.trace('.schema:afterArticleParserRun', 'Initialising plugin.');

    if (article.url != '/bem-notation-and-scss/') {
        return;
    }
    let sp = new SchemaProcessor(this, article);
    await sp.process();
    //syslog.inspect(sp.schema);
}

/**
 * Load.
 */
module.exports.init = ctx => {
    syslog.trace('.schema', 'Initialising plugin.');

    let schemaCfg = {
        publisher: {
            specLoc: 'cfg',
            spec: 'site.publisher',
            type: 'Organization',
        },
        author: {
            type: 'Person',
            specLoc: 'cfg',
            spec: 'site.authors',
            each: true,
        },
        website: {
            type: 'WebSite',
            specLoc: 'cfg',
            spec: 'site',
            wanted: {
                name: {from: 'title'},
                description: null,
                keywords: null,
                image: ctx.cfg.site.publisher.logo,
            }
        }
    };

    ctx.cfg.mergeSect('schemaSpec', schemaCfg, true);

    // Events.
    ctx.on('AFTER_ARTICLE_PARSER_RUN', afterArticleParserRun, 200);
}

