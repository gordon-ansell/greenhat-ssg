/**
 * @file        GreenHat SSG configs.
 * @module      Config
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const YamlFile = require("greenhat-util/yaml");
const syslog = require("greenhat-util/syslog");
const path = require('path');
const fs = require('fs');
const { merge } = require("greenhat-util/merge");

/**
 * Config class.
 */
class Config
{
    /**
     * Constructor.
     * 
     * @param   {object}    data    Initial data.
     */
    constructor(data, ctx)
    {
        this.ctx = ctx;
        if (data) {
            this.merge(data);
        }
    }

    /**
     * Parse any includes we have.
     * 
     * @param   {object}    data    Data to parse.
     * @return  {object}            Update object.
     */
    _parseIncludes(data)
    {
        let ret = {};
        for (let key in data) {
            if (Array.isArray(data[key])) {
                ret[key] = data[key];
            } else if (typeof(data[key]) == "object") {
                ret[key] = this._parseIncludes(data[key]);
            } else if (typeof(data[key]) == "string" && data[key].startsWith("_include ")) {
                let fn = data[key].substring(9);
                let p = path.join(this.ctx.sitePath, '_config', fn);
                if (!fs.existsSync(p)) {
                    syslog.warning(`YAML include file ${p} cannot be found.`);
                } else {
                    let incdata = null;
                    try {
                        incdata = new YamlFile(p).parse();
                    } catch (err) {
                        syslog.warning(`Failed to load config file include ${p}, error: ${err.message}`);
                    }
                    if (!incdata.included) {
                        syslog.warning(`Included YAML files must have the 'included' master key (${p}).`);
                    } else {
                        ret[key] = incdata.included;
                    }
                }
            } else {
                ret[key] = data[key];
            }
        }
        return ret;
    }

    /**
     * Load a config file.
     * 
     * @param   {string}    file    File name.
     * @return  {object}            Data we loaded.
     */
    loadFile(file)
    {
        let ext = path.extname(file);
        let base = path.basename(file, ext);
        let isGeneric = (base[0] == '_') ? true : false;

        let data = null;

        switch (ext) {
            case '.yaml':
                try {
                    data = new YamlFile(file).parse();
                } catch (err) {
                    syslog.warning(`Failed to load config file ${file}, error: ${err.message}`);
                }
                data = this._parseIncludes(data);
                break;
            default:
                syslog.warning(`No processor is defined for config files with extension '${ext}', file ${file}. Get a grip.`);
        }

        if (null !== data) {
            if (isGeneric) {
                this.merge(data);
            } else {
                this.mergeSect(base, data);
            }
        }

        return data;
    }

    /**
     * See if something is a literal.
     * 
     * @param   {any}       tt      Thing to test.
     * @return  {boolean}           True if it is, else false.
     */
    isLiteral(tt)
    {
        if (tt === null || tt === undefined) {
            return true;
        }

        switch (typeof(tt)) {
            case "string":
                return true;
        }

        return false;
    }

    /**
     * Merge in data.
     * 
     * @param   {object}    data        Data to merge. 
     * @param   {boolean}   preserve    Preserve current?
     */
    merge(data, preserve = false)
    {
        let orig = {};
        if (preserve) {
            orig = {...this};
        }

        let props = Object.getOwnPropertyNames(this);
        let tmp = {};
        for (let key of props) {
            tmp[key] = this[key];
        }

        let merged = merge(tmp, data);

        if (preserve) {
            merged = merge(merged, orig);
        }

        for (let key in merged) {
            this[key] = merged[key];
        } 

    }

    /**
     * Merge in section of data.
     * 
     * @param   {string}    sect    Section.
     * @param   {object}    data    Data to merge. 
     * @param   {boolean}   preserve    Preserve current?
     */
    mergeSect(sect, data, preserve = false)
    {
        let orig = {};
        if (preserve && this[sect]) {
            orig = {...this[sect]};
        }

        if (!this[sect]) {
            this[sect] = data;
        } else {
            this[sect] = merge(this[sect], data);
        }

        if (preserve) {
            this[sect] = merge(this[sect], orig);
        }

    }
}

module.exports = Config;
