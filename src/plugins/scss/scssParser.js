/**
 * @file        SCSS plugin - parser.
 * @module      plugins/scss
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { mkdirRecurse, syslog } = require("greenhat-base");
const path = require('path');
const fs = require('fs');
const sass = require('node-sass');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');

/**
 * Scss parser class.
 */
class ScssParser
{
    /**
     * File path.
     *
     * @protected 
     * @var {string}
     */
    _filePath = null;

    /**
     * Absolute path.
     *
     * @protected 
     * @var {string}
     */
    _absPath = null;

    /**
     * Site directory.
     *
     * @protected 
     * @var {string}
     */
    _siteDir = null;

    /**
     * Options.
     *  
     * @protected
     * @var {object}
     */
    _opts = null;

    /**
     * Relative path.
     * 
     * @var {string}
     */
    rel = null;

    /**
     * Constructor.
     *
     * @constructor 
     * @param   {string}    filePath    Path to the SCSS file.
     * @param   {string}    sitePath    Absolute path to site.
     * @param   {string}    siteDir     Site directory.
     * @param   {object}    opts        Options.
     * 
     * @return  {ScssParser}            New instance.
     */
    constructor(filePath, absPath, siteDir, opts)
    {
        this._filePath = filePath;
        this._absPath = absPath;
        this._siteDir = siteDir;
        this._opts = opts;
    }

    /**
     * Parse it.
     * 
     * @return  {string|null}                Inline CSS.
     */
    parse()
    {
        this.rel = this._filePath.replace(this._absPath, '');
        let opFile = path.join(this._absPath, this._siteDir, this.rel).replace('.scss', '.css');

        const options = {
            file: this._filePath,
            outFile: opFile,
            outputStyle: this._opts.outputStyle
        };

        
        let compiled = false;
        
        try {
            compiled = sass.renderSync(options);
        } catch (err) {
            syslog.error(`Could not compile SCSS for: ${this.rel}`, err.message);
            return null;
        }


        if (this._opts.autoPrefix == true) {
            let postcssOptions = {
                from: undefined
            };

            let data;
            postcss([ autoprefixer ]).process(compiled['css'], postcssOptions).then((result) => {
                result.warnings().forEach((warn) => {
                    syslog.warning(warn.toString())
                })
                syslog.info(`Autoprefixing CSS for: ${this.rel}.`);
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

        return compiled['css'].toString();
    }

}

module.exports = ScssParser;

