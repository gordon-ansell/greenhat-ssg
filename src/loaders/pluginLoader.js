/**
 * @file        Plugin file loader.
 * @module      loaders/DataLoader
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const syslog = require("greenhat-util/syslog");
const BaseLoader = require("./baseLoader");
const path = require("path");
const SSGError = require('../ssgError');

class SSGPluginError extends SSGError {} 

/**
 * Plugin loader class.
 */
class PluginLoader extends BaseLoader
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
        let pn = path.basename(rel, path.extname(rel)).slice(1);

        if (this.ctx.pluginsLoaded.includes(pn)) {
            syslog.warning(`A plugin with name '${pn}' already exists. It will be overwritten.`);
        }

        syslog.trace('PluginLoader:_loadSingle', `Loading plugin from file ${rel}.`);

        let ext = path.extname(file);

        let plugin = null;

        switch (ext) {
            case '.js':
                try {
                    //plugin = await require(file).call(this.ctx);
                    plugin = await require(file);
                    await plugin.init(this.ctx);
                    this.ctx.plugins[pn] = plugin;
                } catch (err) {
                    throw new SSGPluginError(`Could not load plugin file '${rel}': ${err.message}`);
                }
                break;
            default:
                syslog.warning(`No processor is defined for plugin files with extension '${ext}'. Get a grip.`);
        }

        if (plugin) {
            syslog.info(`Loaded plugin ${rel}, with name: ${pn}.`);
            this.ctx.pluginsLoaded.push(pn);
        } else {
            syslog.error(`Unable to load plugin ${rel}. Have you forgotten to return module.exports?`);
        }
    }
    
}

module.exports = PluginLoader;

