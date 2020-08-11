/**
 * @file        Nunjucks template parser.
 * @module      template/NunjucksParser
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const GreenhatSSGError = require('../greenhatSSGError');
const nunjucks = require('nunjucks');
const fs = require('fs');
const { syslog } = require('greenhat-base/src/logger');
const beautify = require('js-beautify').html;

class GreenhatSSGTemplateError extends GreenhatSSGError {}

/**
 * Nunjucks parser class.
 * 
 * @property    {object}    env     Nunjucks environment.
 */
class NunjucksParser
{
    /**
     * Constructor.
     * 
     * @param   {string|string[]}   paths   Template paths.
     * @param   {object}            opts    Template options.
     */
    constructor (paths, opts = {autoescape: false, throwOnUndefined: true, lstripBlocks: true, trimBlocks: true})
    {
        this.env = nunjucks.configure(paths, opts);
    }

    /**
     * Render an article.
     * 
     * @param   {object}    article     Article instance to render.
     * @param   {object}    ctx         Context object.
     * @return  {string}                Rendered string.
     */
    async renderArticle(article, ctx)
    {
        let data = {
            cfg: ctx.config,
            article: article,
            ctx: ctx
        };

        let tpl;
        try {
            tpl = nunjucks.compile(fs.readFileSync(article['layoutPath'], 'utf8'), this.env);
        } catch (err) {
            throw new GreenhatSSGTemplateError("Template compile failed: " + err.message);
        }

        let output; 
                  
        try {
            output = tpl.render(data);
        } catch (err) {
            syslog.error("Template render failed: \n" + 
                this._getUsefulErrDetails(err.message), article.relPath);
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

    /**
     * Render a file.
     * 
     * @param   {string}    layoutFile  Layout file.
     * @param   {object}    data        Data object.
     * @param   {string}    context     Optional context.
     * @return  {string}                Rendered string.
     */
    renderFile(layoutFile, data = {}, context = null)
    {
        let output = null;
        try {
            output = nunjucks.render(layoutFile, data);
        } catch (err) {
            let msg;
            if (err.message && err.message.includes("attempted to output null or undefined value")) {
                msg = "Null output after parsing through template " + layoutFile + ".\n" +
                    "\t==> This will most likely be a logic error in your template.\n" +
                    "\t==> Check everything between the '{' and '}' characters and the odds are you'll find something wrong.\n" +
                    "\t==> A mistyped variable name or spurious '%' are good candidates.";
            } else {
                msg = "Template error in " + layoutFile + ", message: " + err.message;
            }
            throw new GreenhatSSGTemplateError(msg, context)
        }

        return output;
    }

    /**
     * Render a string.
     * 
     * @param   {string}    str         String to render.
     * @param   {object}    data        Data object.
     * @param   {string}    context     Optional context.
     * @return  {string}                Rendered string.
     */
    renderString(str, data = {}, context = '')
    {
        let output = null;
        try {
            output = nunjucks.renderString(str, data);
        } catch (err) {
            let msg;
            if (err.message && err.message.includes("attempted to output null or undefined value")) {
                msg = "Null output after parsing string.\n" +
                    "\t==> This will most likely be a logic error in your string.\n" +
                    "\t==> Check everything between the '{' and '}' characters and the odds are you'll find something wrong.\n" +
                    "\t==> A mistyped variable name or spurious '%' are good candidates.";
            } else {
                msg = "Template error parsing string, message: " + err.message;
            }
            throw new GreenhatSSGTemplateError(msg, context)
        }

        return output;
    }

}

module.exports = NunjucksParser;
