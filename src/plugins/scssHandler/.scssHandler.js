/**
 * @file        SCSS handler plugin.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

const { syslog } = require('greenhat-util/syslog');
const GreenHatError = require("greenhat-util/error");
const sass = require('node-sass');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const { mkdirRecurse } = require('greenhat-util/fs');
const path = require('path');
const fs = require('fs');

class GreenHatScssParserError extends GreenHatError {}

/**
 * Parse an SCSS file.
 *
 * @param   {string}  file  File to parse.
 */
function parse(file)
{
    syslog.trace('.scssHandler:parse',`Handling SCSS file ${file}.`);

    let opts = this.cfg.scssSpec;
    let absPath = this.sitePath;
    let siteDir = this.cfg.locations.site;
    let rel = file.replace(absPath, '');
    let opFile = path.join(absPath, siteDir, rel).replace('.scss', '.css');

    const options = {
        file: file,
        outFile: opFile,
        outputStyle: opts.outputStyle
    };
    
    let compiled = false;
    
    try {
        compiled = sass.renderSync(options);
    } catch (err) {
        syslog.error(`Could not compile SCSS for: ${rel}`, err.message);
        return null;
    }

    if (opts.autoPrefix == true) {
        let postcssOptions = {
            from: undefined
        };

        let data;
        postcss([ autoprefixer ]).process(compiled['css'], postcssOptions).then((result) => {
            result.warnings().forEach((warn) => {
                syslog.warning(warn.toString())
            })
            syslog.trace('.scssHanfler:parse', `Autoprefixing CSS for: ${rel}.`);
            data = result.css;
            return data;
        }).then((data) => {
            compiled['css'] = data;
        })
    
    }

    mkdirRecurse(path.dirname(opFile));
    fs.writeFileSync(opFile, compiled['css'].toString());

    if (!fs.existsSync(opFile)) {
        throw new GreenHatScssParserError("For some reason the generated CSS file does not exist: " + opFile);
    }

    let css = compiled['css'].toString();

    if (!this.inlineCss) {
        this.inlineCss = [];
    }

    this.inlineCss[rel] = css;

    this.counts['scss compiles']++;

}

/**
 * Load.
 */
module.exports.init = ctx => {
    syslog.trace('.scssHandler', 'Initialising plugin.');

    let scfg = {
        scssExt: 'scss',
        outputStyle: "compressed",
        autoPrefix: true,
    };

    ctx.cfg.mergeSect('scssSpec', scfg, true);

    // Set the scss parser.
    ctx.setExtensionParser('scss', parse);

    ctx.counts['scss compiles'] = 0;
}
