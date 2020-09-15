/**
 * @file        Base loader.
 * @module      loaders/BaseLoader
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const fs = require('fs');
const ghfs = require("greenhat-util/fs");
const syslog = require('greenhat-util/syslog');
const arr = require("greenhat-util/array");

/**
 * Base loader class.
 */
class BaseLoader
{
    // Privates.
    #paths = null;
    #absPath = null;
    #fspOpts = {};

    filesLoaded = [];

    /**
     * Constructor.
     * 
     * @param   {string}    paths       Paths the load from.
     * @param   {string}    ctx         Context.
     * @param   {string}    absPath     Absolute path.
     * @param   {object}    fspOpts     File system parser options.
     */
    constructor(paths, ctx, absPath, fspOpts = {})
    {
        this.#paths = arr.makeArray(paths);
        this.#absPath = absPath;
        this.#fspOpts = fspOpts;
        this.ctx = ctx;
    }

    /**
     * Do the load.
     * 
     * @return  {number}        Number loaded.
     */
    async load()
    {
        let cnt = 0;

        for (let path of this.#paths) {

            // Parse the data filesystem.
            let fsp = new ghfs.FsParser(path, this.#absPath, this.#fspOpts);
            let files = await fsp.parse();
            
            if (arr.isEmpty(files)) {
                continue;
            }

            await Promise.all(files.map(async file => {
                this._loadSingle(file, this.#absPath);
                cnt++;
            }));
        }

        return cnt;
    }

    /**
     * Callable.
     * 
     * @param   {string}    file        File to load.
     * @param   {string}    absPath     Absolute path.
     */
    _loadSingle(file, absPath)
    {
        throw new Error("You must overload the _loadSingleData function.");
    }
}

module.exports = BaseLoader;