/**
 * @file        Config file loader.
 * @module      loaders/ConfigLoader
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { syslog } = require("greenhat-util/syslog");
const BaseLoader = require("./baseLoader");
const path = require("path");
require('greenhat-util/object');
require('greenhat-util/array');

/**
 * Config loader class.
 */
class ConfigLoader extends BaseLoader
{
    /**
     * Callable.
     * 
     * @param   {string}    file        File to load.
     * @param   {string}    absPath     Absolute path.
     */
    _loadSingle(file, absPath)
    {
        let rel = file.replace(absPath, '');

        syslog.trace('ConfigLoader:_loadSingle', `Loading configs for ${rel}.`);

        let data = this.ctx.cfg.loadFile(file);

        if (null !== data) {
            this.ctx.configsLoaded.push(rel);
        }
    }
    
}

module.exports = ConfigLoader;

