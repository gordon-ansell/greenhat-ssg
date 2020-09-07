/**
 * @file        Schema processor.
 * @module      SchemaProcessor
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { syslog } = require('greenhat-util/syslog');
const path = require('path');
require("greenhat-util/string")

class SchemaProcessor
{
    // The actual schema defs.
    schema = [];

    // Image fields.
    imageFields = ['logo', 'image'];

    /**
     * Constructor.
     * 
     * @param   {object}    ctx         Context.
     * @param   {object}    article     Article. 
     */
    constructor(ctx, article)
    {
        this.ctx = ctx;
        this.article = article;
        this.spec = ctx.cfg.schemaSpec;
    }

    /**
     * Process the schema.
     */
    async process()
    {
        for (let key in this.spec) {
            let specData = this.spec[key];

            if (!specData.specLoc) {
                specData.specLoc = 'article';
            }

            let data = null;
            if (specData.specLoc == 'cfg') {
                data = this.ctx.cfg;
                let sp = specData.spec.split('.');
                for (let sect of sp) {
                    data = data[sect];
                }
            } else {
                data = this.article;
            }

            let ret;
            if (specData.each && specData.each == true) {
                ret = await this._processDataEach(specData, data, key)
            } else {
                ret = await this._processData(specData, data, key);
            }

            if (Array.isArray(ret)) {
                for (let item of ret) {
                    this.schema.push(item);
                }
            } else {
                this.schema.push(ret);
            }
        }
    }

    /**
     * Process 'each'
     * @param   {object}    specData    Spec data.
     * @param   {object}    srcData     Source data.
     * @param   {string}    key         Key we're processing.
     */
    _processDataEach(specData, srcData, key)
    {
        let ret = [];

        for (let name in srcData) {
            let id = key + '-' + name;
            let result = this._processData(specData, srcData[name], id);
            ret.push(result);
        }

        return ret;
    }

    /**
     * Process data.
     * 
     * @param   {object}    specData    Spec data.
     * @param   {object}    srcData     Source data.
     * @param   {string}    key         Key we're processing.
     */
    async _processData(specData, srcData, key)
    {
        let ret = {};

        // ID.
        if (key) {
            if (!specData.id) {
                specData.id = key; 
            }
            ret['@id'] = this._id(specData.id);
        }

        // Type.
        if (!specData.type) {
            specData.type = key.ucfirst();
        }
        ret['@type'] = specData.type;

        // Wanted.
        if (!specData.wanted) {
            specData.wanted = {};
            for (let k in srcData) {
                specData.wanted[k] = srcData[k];
            }
        }

        // Keys.
        for (let name in specData.wanted) {

            let details = specData.wanted[name];
            
            if (details == null) {
                ret[name] = srcData[name];
            } else if (typeof(details) == "string") {
                ret[name] = details;
            } else if (typeof(details) == "object") {
                let sfld = name;
                if (details.from) {
                    sfld = details.from;
                }
                ret[name] = srcData[sfld];
            }

            if (this.imageFields.includes(name)) {
                ret[name] = await this.getImageUrls(ret[name]);
            }
        }

        return ret;
    }

    /**
     * Get all the image URLS for a URL.
     * 
     * @param   {string}    url     URL key.
     * @return  {string|string[]}   Full list of URLs
     */
    async getImageUrls(url)
    {
        if (!this.ctx.hasCallable('getImageUrls')) {
            return url;
        }
        return await this.ctx.callable('getImageUrls', url);
    }

    /**
     * Create an ID.
     * 
     * @param   {string}    name    Name.
     * @return  {string}            ID string.
     */
    _id(name)
    {
        return path.sep + '#' + name.slugify();
    }

    /**
     * Get an ID reference.
     * 
     * @param   {string}    name    Name.
     * @return  {string}            ID refernce string.
     */
    _idref(name)
    {
        return {
            '@id': path.sep + '#' + name.slugify()
        };
    }
}

module.exports = SchemaProcessor;
