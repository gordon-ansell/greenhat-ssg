/**
 * @file        SCSS plugin.
 * @module      plugins/scss
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const path = require('path');
const { syslog, merge } = require("greenhat-base"); 
const ScssParser = require('./scssParser');

/**
 * Called after config processing.
 */
function AfterConfig()
{
    syslog.trace('plugin:scss:afterConfig', "Responding to hook.");

    let defaultScssSpec = {
        scssExt: 'scss',
        outputStyle: "compressed",
        autoPrefix: true,
    };

    if (this.ctx.config.scssSpec) {
        this.ctx.config.scssSpec = merge(defaultScssSpec, this.ctx.config.scssSpec);
    } else {
        this.ctx.config.scssSpec = defaultScssSpec;
    }

    this.ctx.counts.scss = 0;
}

/**
 * Called after the filesystem parse.
 */
async function AfterFileSystemParse()
{
    syslog.trace('plugin:scss:afterFileSystemParse', "Responding to hook.");
    syslog.notice("Processing SCSS file.");

    let scssSpec = this.ctx.config.scssSpec;
    this.inlineCss = {};

    let scssFiles = this.ctx.filesToProcess.filter(f => {
        return (path.extname(f).substring(1) == scssSpec.scssExt) &&
            (path.basename(f)[0] != '_');
    });

    await Promise.all(scssFiles.map(async f => {
        syslog.trace('scss:afterFileSystemParse', `Processing scss file: ${f}`);
        let parser = new ScssParser(f, this.ctx.sitePath, this.ctx.config.dirs.site, this.ctx.config.scssSpec);
        let newCss = await parser.parse();
        this.inlineCss[parser.rel] = newCss;
        this.ctx.filesProcessed.push(f);
        this.ctx.counts.scss++;
    }));
}

exports.AfterConfig = AfterConfig;
exports.AfterFileSystemParse = AfterFileSystemParse;
