/**
 * @file        Nunjucks template.
 * @module      loaders/NunjucksTemplate
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const BaseTemplate = require('./baseTemplate');
const nunjucks = require('nunjucks');
const GreenHatSSGError = require("../ssgError");
const beautify = require('js-beautify').html;
const fs = require('fs');
const { syslog } = require("greenhat-util/syslog");

class GreenhatSSGTemplateError extends GreenHatSSGError {}

/**
 * Nunjucks template class.
 */
class NunjucksTemplate extends BaseTemplate
{
    // Throw exceptions?
    #throwex = false;

    /**
     * Constructor.
     * 
     * @param   {string|string[]}   paths   Template paths.
     * @param   {object}            opts    Template options.
     */
    constructor (paths, opts = {autoescape: false, throwOnUndefined: true, lstripBlocks: true, trimBlocks: true})
    {
        super();
        let loader = new nunjucks.FileSystemLoader(paths);
        this.engine = new nunjucks.Environment(loader, opts);
    }

    /**
     * Set the throw exceptions flag.
     * 
     * @param   {boolean}   flag    Flag value. 
     */
    setThrowExceptions(flag)
    {
        this.#throwex = flag;
    }

    /**
     * Local render of an article.
     * 
     * @param   {string}    layoutPath  Path to layout.
     * @param   {object}    data        Data to render.
     * @param   {string}    context     Identifier.
     * @return  {string}                Rendered string.
     */
    _renderArticleHere(layoutPath, data, context)
    {
        let output; 

        try {
            output = this.engine.render(layoutPath, data);
        } catch (err) {
            let details = "Template render failed: \n" + this._getUsefulErrDetails(err.message); 
            let cont = context + ', through ' + layoutPath;
            if (this.#throwex) {
                throw new GreenhatSSGTemplateError(details, cont, err);
            } else {
                syslog.error(details, cont);
            }
        }

        return beautify(output);
    }

    /**
     * Get the useful information from an error.
     * 
     * @param   {string}    errMessage      Error message.
     * @return  {string}                    Useful stuff.
     */
    _getUsefulErrDetails(errMessage)
    {
        let ret = [];
        let lines = errMessage.split('\n');

        for (let line of lines) {
            if (line.includes('(unknown path)')) {
                continue;
            }
            ret.push(line);
        }

        if (ret.length == 0) {
            ret.push("No error information present.");
        }

        if (errMessage.includes("attempted to output null or undefined value")) {
            ret.push("\t==> This will most likely be a logic error in your template.");
            ret.push("\t==> Check everything between the '{' and '}' characters and the odds are you'll find something wrong.");
            ret.push("\t==> A mistyped variable name or spurious '%' are good candidates.");
        }

        return ret.join('\n');

    }

}

module.exports = NunjucksTemplate;