/**
 * @file        Taxonomy pages plugin.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

const { syslog } = require("greenhat-util/syslog");
const path = require('path');
const fs = require('fs');
const { mkdirRecurse } = require("greenhat-util/fs");
require("greenhat-util/string");

/**
 * Create taxonomy pages.
 */
async function afterParseLate()
{
    syslog.notice("Processing taxonomy pages.");

    // Grab the opts.
    let articleSpec = this.cfg.articleSpec;

    // Get the dummy.
    let dummyDirs = [
        path.join(this.sitePath, this.cfg.locations.layouts, 'dummies', 'taxonomy.html'),
        path.join(this.appPath, this.cfg.locations.sysLayouts, 'dummies', 'taxonomy.html')
    ];
    let fn;
    for (let p of dummyDirs) {
        if (fs.existsSync(p)) {
            fn = p;
            break;
        }
    }
    if (!fn) {
        syslog.error(`Could not find dummy taxonomy layout.`);
        return;
    }

    // Read the dummy.
    let dummy = fs.readFileSync(fn, 'utf-8');

    // Process the taxonomies.
    await Promise.all(articleSpec.taxonomyTypes.map(async taxType => {
        let taxonomyNames = Array.from(this.articles.taxonomy[taxType].items.keys());
        taxonomyNames.forEach(async taxonomyName => {
            // Set up the dummy file.
            let fileData = dummy;
            fileData = fileData.replaceAll('-taxonomy-', taxonomyName)
                .replaceAll('-taxonomyType-', taxType);

            // Define a file name and write to it.
            let fileName = path.join(this.sitePath, this.cfg.locations.temp, 
                'taxonomies', taxType, taxonomyName.slugify() + '.html');
            let dir = path.dirname(fileName);
            if (!fs.existsSync(dir)) {
                mkdirRecurse(dir);
            }
            fs.writeFileSync(fileName, fileData, 'utf-8');

            // Parse the article.
            let article = await this.cfg.parsers['md'].call(this, fileName);

            // Render the article.
            await this.cfg.renderers['njk'].call(this, article)

            // Save the article.
            //this.ctx.articles.all.set(article.url, article);
            //this.ctx.articles[article.type].set(article.url, article);
        })
    }));
    
}

/**
 * Initialisation.
 */
module.exports.init = ctx => {

    syslog.trace('.taxonomyPages', 'Initialising plugin.');

    // Set up event responses.
    ctx.on('AFTER_PARSE_LATE', afterParseLate);

}
