/**
 * @file        Data file loader.
 * @module      loaders/DataLoader
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const syslog = require("greenhat-util/syslog");
const BaseLoader = require("./baseLoader");
const path = require("path");
const { merge } = require('greenhat-util/merge');
const YamlFile = require("greenhat-util/yaml");

/**
 * Data loader class.
 */
class DataLoader extends BaseLoader
{
    /**
     * Callable.
     * 
     * @param   {string}    file        File to load.
     * @param   {string}    absPath     Absolute path.
     */
    async _loadSingle(file, absPath)
    {
        let rel = file.replace(absPath, '');

        syslog.trace('DataLoader:_loadSingle', `Loading data from file ${rel}.`);

        let ext = path.extname(file);
        let base = path.basename(file, ext).slice(1);

        let data = null;

        switch (ext) {
            case '.js':
                try {
                    data = await require(file)(this.ctx);
                } catch (err) {
                    syslog.warning(`Could not load data file '${rel}': ${err.message}`);
                }
                break;
            case '':
                return;
            default:
                syslog.warning(`No processor is defined for data files with extension '${ext}'. Get a grip.`, file);
        }

        if (null !== data) {
            if (!this.ctx.data[base]) {
                this.ctx.data[base] = data;
            } else {
                this.ctx.data[base] = merge(this.ctx.data[base], data);
            }
            this.ctx.dataFilesLoaded.push(rel);
        }
    }
    
}

module.exports = DataLoader;

