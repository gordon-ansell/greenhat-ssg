/**
 * @file        GreenHat SSG controller.
 * @module      SSG
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { syslog } = require("greenhat-util/syslog");
const pkg = require("../package.json");
const Context = require("./context");
const path = require('path');
const fs = require('fs');
const ConfigLoader = require("./loaders/configLoader")
const DataLoader = require("./loaders/dataLoader")
const PluginLoader = require("./loaders/pluginLoader")
const ghfs = require("greenhat-util/fs");
const Config = require("./config");
require('greenhat-util/object');
require('greenhat-util/array');
const GreenHatSSGError = require("./ssgError")
const { deleteFolderRecursive, cleanDir, copyFile } = require('greenhat-util/fs');
const XLator = require("greenhat-util/xlate");
const os = require('os');
const http = require('http');
const Paginate = require("./paginate");

/**
 * Main SSG class.
 * 
 * @property    {Context}   ctx     Context.
 */
class SSG
{
    /**
     * Start time.
     */
    #startTime = 0;

    /**
     * Constructor.
     * 
     * @param   {string}    logLevel        Logging level. 
     * @param   {boolean}   exceptionTraces Exception traces?
     */
    constructor(logLevel, exceptionTraces)
    {
        if (logLevel) {
            syslog.setLevel(logLevel);
        }
        
        if (exceptionTraces) {
            syslog.setExceptionTraces(exceptionTraces);
        }

        //syslog.setTraceKeys('ImageParser*');

        this.#startTime = Date.now();

        syslog.notice("=".repeat(50));
        syslog.notice(`GreenHat SSG version ${pkg.version} started.`);

        this.ctx = new Context();
        this.ctx.args = require('minimist')(process.argv);

        if (!this.ctx.args.input) {
            this.ctx.args.input = '.';
        } 

        if (this.ctx.args.dev) {
            this.ctx.mode = 'dev';
        } else {
            this.ctx.mode = 'prod';
        }

        this.ctx.setValidEvents([
            'BEFORE_PARSE_EARLY',
            'BEFORE_PARSE_LATE',
            'AFTER_PARSE_EARLY',
            'AFTER_PARSE_LATE',
            'AFTER_ARTICLE_PARSER_INIT',
            'AFTER_ARTICLE_PARSER_RUN',
            'ARTICLE_PRERENDER',
        ]);

        this.ctx.counts = {};

        this.ctx.cfg = new Config(require('./defaultConfig'));

        this.ctx.appPath = path.dirname(this.ctx.args['_'][1]);
        this.ctx.sitePath = path.resolve(this.ctx.args.input);
    }

    /**
     * Initialisation.
     */
    async init()
    {
        syslog.notice("*** Initialising. ***");
        await this._loadConfigs();

        if (this.ctx.cfg.site.traceKeys) {
            syslog.setTraceKeys(this.ctx.cfg.site.traceKeys);
        }

        if (this.ctx.cfg.site.msgLevel) {
            syslog.setLevel(this.ctx.cfg.site.msgLevel);
        }

        if ('exceptionTraces' in this.ctx.cfg.site) {
            syslog.setExceptionTraces(this.ctx.cfg.site.exceptionTraces);
        }

        await this._loadSystemPlugins();
        await this._loadUserPlugins();
        await this._loadData();

        if (this.ctx.cfg.cfgChk) {
            this._checkConfig(this.ctx.cfg.cfgChk, this.ctx.cfg, []);
        }

        this._loadTranslations();

    }

    /**
     * Load the configs.
     */
    async _loadConfigs()
    {
        syslog.notice('Loading configs.');

        this.ctx.configsLoaded = [];

        let configPath = path.join(this.ctx.sitePath, this.ctx.cfg.locations.config);
        if (!fs.existsSync(configPath)) {
            syslog.info('No configs to load.');
            return;
        }

        let loader = new ConfigLoader(configPath, this.ctx, this.ctx.sitePath);
        let result = await loader.load();

        if (0 == result) {
            syslog.info('No configs to load.');
        }

        //
        // Now set some stuff based on the config.
        //

        if (this.ctx.mode == 'prod') {
            if (!this.ctx.cfg.site.prodDomain) {
                throw new GreenHatSSGError("Site spec needs a 'prodDomain' setting.")
            }
        }

        // Some defaults.
        if (!this.ctx.cfg.site.dev) {
            this.ctx.cfg.site.dev = {
                addr: '127.0.0.1',
                port: 8081
            }
        }

        if (!this.ctx.cfg.site.dev.addr) {
            this.ctx.cfg.site.dev.addr = '127.0.0.1';
        }

        if (!this.ctx.cfg.site.dev.port) {
            this.ctx.cfg.site.dev.port = 8081;
        }

        // Hostname.
        let host = os.hostname();
        this.ctx.cfg.site.host = host;
        if (this.ctx.cfg.site.hosts && this.ctx.cfg.site.hosts[host]) {
            this.ctx.cfg.site.dev.addr = this.ctx.cfg.site.hosts[host];
        }

        // Set the URL.
        if (this.ctx.mode == 'dev') {
            this.ctx.cfg.site.url = 'http://' + this.ctx.cfg.site.dev.addr + ':' + this.ctx.cfg.site.dev.port;
        } else {
            this.ctx.cfg.site.url = ((this.ctx.cfg.site.ssl) ? 'https://' : 'http://') +
                this.ctx.cfg.site.prodDomain;
        }  

        // Assets URL.
        if (!this.ctx.cfg.site.assetsUrl) {
            this.ctx.cfg.site.assetsUrl = '/assets';
        }
        if (!this.ctx.cfg.site.assetsUrl.startsWith(path.sep)) {
            this.ctx.cfg.site.assetsUrl = path.sep + this.ctx.cfg.site.assetsUrl;
        }
    }

    /**
     * Load any data.
     */
    async _loadData()
    {
        syslog.notice("Loading data files.");

        this.ctx.data = {};
        this.ctx.dataFilesLoaded = [];

        let dataPath = path.join(this.ctx.sitePath, this.ctx.cfg.locations.data);
        if (!fs.existsSync(dataPath)) {
            syslog.info('No data to load.');
            return;
        }

        let loader = new DataLoader(dataPath, this.ctx, this.ctx.sitePath,
            {allowFiles: ['.'], ignoreFilesByDefault: true});
        let result = await loader.load();

        if (0 == result) {
            syslog.info('No data to load.');
        }
    }

    /**
     * Load the system plugins.
     */
    async _loadSystemPlugins()
    {
        syslog.notice('Loading system plugins.');

        this.ctx.pluginsLoaded = [];
        this.ctx.plugins = {};

        let pluginPath = path.join(this.ctx.appPath, this.ctx.cfg.locations.sysPlugins);
        if (!fs.existsSync(pluginPath)) {
            syslog.info('No system plugins to load.');
            return;
        }
        if (!this.ctx.cfg.site.sysPlugins || this.ctx.cfg.site.sysPlugins.length == 0) {
            syslog.info('No system plugins to load.');
            return;
        }

        let loader = new PluginLoader(pluginPath, this.ctx, this.ctx.appPath,
            {allowFiles: ['.'], allowFiles: this.ctx.cfg.site.sysPlugins, ignoreFilesByDefault: true});
        let result = await loader.load();

        if (0 == result) {
            syslog.info('No system plugins to load.');
        }

    }

    /**
     * Load the user plugins.
     */
    async _loadUserPlugins()
    {
        syslog.notice('Loading user plugins.');

        let pluginPath = path.join(this.ctx.sitePath, this.ctx.cfg.locations.plugins);
        if (!fs.existsSync(pluginPath)) {
            syslog.info('No user plugins to load.');
            return;
        }
        if (!this.ctx.cfg.site.plugins || this.ctx.cfg.site.plugins.length == 0) {
            syslog.info('No user plugins to load.');
            return;
        }

        let loader = new PluginLoader(pluginPath, this.ctx, this.ctx.sitePath,
            {allowFiles: ['.'], allowFiles: this.ctx.cfg.site.plugins, ignoreFilesByDefault: true});
        let result = await loader.load();

        if (0 == result) {
            syslog.info('No user plugins to load.');
        }
    }

    /**
     * Check the config.
     * 
     * @param   {object}    chks    Checks object.
     * @param   {object}    data    Data object.
     * @param   {string[]}  name    Name.
     */
    _checkConfig(chks, data, name)
    {
        let nameStr = name.join('.');

        for (let key in chks) {
            if (key == '_compulsory') {
                for (let item of chks[key]) {
                    if (!data[item]) {
                        syslog.error(`The '${nameStr}.${item} config item must be specified.`);
                    }
                }    
            } else if (key == '_advisory') {
                for (let item of chks[key]) {
                    if (!data[item]) {
                        syslog.error(`The '${nameStr}.${item} config item is recommended.`);
                    }
                }    
            } else if (key == '_each') {
                for (let subKey in data) {
                    name.push(subKey);
                    this._checkConfig(chks[key], data[subKey], name);
                }
            } else if (typeof chks[key] == 'object') {
                name.push(key);
                if (data[key]) {
                    this._checkConfig(chks[key], data[key], name);
                }
            }
        }

        name.pop();
    }

    /**
     * Load translations.
     */
    _loadTranslations()
    {
        if (this.ctx.cfg.langStrs) {
            syslog.notice("Loading language strings.");
            let lang = (this.ctx.cfg.site.lang) ? this.ctx.cfg.site.lang : 'en_GB';
            this.ctx.xlator = new XLator(lang, this.ctx.cfg.langStrs);
        }
    }

    /**
     * Run the app.
     * 
     * @return  {number}                0 for success, 1+ for failure.
     */
    async run()
    {
        syslog.notice("*** Running. ***");
        
        //syslog.inspect(this.ctx.pluginsLoaded);

        this._cleanDirectories();
        await this._parseFileSystem();
        await this._parseFiles();
        await this._processPagination();
        await this._renderFiles();
        await this._processLeftovers();
        await this._cleanup();


        //this.ctx.articles.all.dump();

        let countsMsg = '';
        if (this.ctx.counts) {
            for (let key in this.ctx.counts) {
                if (countsMsg != '') countsMsg += ', ';
                countsMsg += key + ': ' + this.ctx.counts[key]; 
            } 
        }

        syslog.notice(`GreenHat SSG completed in ${(Date.now() - this.#startTime) / 1000} seconds.`);
        if (countsMsg != '') {
            syslog.info('Counts - ' + countsMsg);
        }
        syslog.notice("=".repeat(50));


        if (this.ctx.args.serve) {
            this.serve(path.join(this.ctx.sitePath, this.ctx.cfg.locations.site), 
                this.ctx.cfg.site.dev.addr, this.ctx.cfg.site.dev.port);
        }


        return 0;
    }

    /**
     * Clean the website.
     */
    _cleanDirectories()
    {
        if (deleteFolderRecursive(path.join(this.ctx.sitePath, this.ctx.cfg.locations.site))) {
            syslog.notice("Cleaned out site directory.");
        }
        if (cleanDir(path.join(this.ctx.sitePath, this.ctx.cfg.locations.temp))) {
            syslog.notice("Cleaned out temp directory.");
        }
        if (this.ctx.args.clearCache && 
            cleanDir(path.join(this.ctx.sitePath, this.ctx.cfg.locations.cache))) {
            syslog.notice("Cleaned out cache directory.");
        }
    }

    /**
     * Parse the file system.
     */
    async _parseFileSystem()
    {
        syslog.notice('Parsing the filesystem.');

        this.ctx.filesProcessed = [];

        // Parse the data filesystem.
        let fsp = new ghfs.FsParser(this.ctx.sitePath, this.ctx.sitePath, this.ctx.cfg.fileSystemParser);
        this.ctx.filesToProcess = await fsp.parse();
    }

    /**
     * Parse files.
     */
    async _parseFiles()
    {
        let earlyParsers = [];
        let lateParsers = [];

        if (this.ctx.cfg.earlyParse && this.ctx.cfg.earlyParse.length > 0) {
            earlyParsers = this.ctx.filesToProcess.filter(f => {
                return this.ctx.cfg.earlyParse.includes(path.extname(f).slice(1));
            });
            lateParsers = this.ctx.filesToProcess.filter(f => {
                return !this.ctx.cfg.earlyParse.includes(path.extname(f).slice(1));
            });
        } else {
            lateParsers = this.ctx.filesToProcess;
        }

        let count = 0;
        for (let arr of [earlyParsers, lateParsers]) {
        
            if (count == 0) {
                syslog.notice(`Parsing files (early).`);
                await this.ctx.emit('BEFORE_PARSE_EARLY');
            } else {
                syslog.notice(`Parsing files (late).`);
                await this.ctx.emit('BEFORE_PARSE_LATE');
            }

            let errs = [];

            await Promise.all(arr.map(async file => {
                let ext = path.extname(file).slice(1);
                syslog.trace('SSG:_parseFiles', `File parser ext: ${ext}, for file ${file}.`);
                if (this.ctx.cfg.parsers[ext]) {
                    try {
                        await this.ctx.cfg.parsers[ext].call(this.ctx, file);
                    } catch (err) {
                        errs.push([err, file]);
                    }
                    this.ctx.filesProcessed.push(file);
                }
            }));

            if (errs.length > 0) {
                if (this.ctx.cfg.site.showAllErrors && this.ctx.cfg.site.showAllErrors == true) {
                    syslog.error(`${errs.length} errors encountered in parse. Here they are:`);
                    for (let err of errs) {
                        syslog.inspect(err[0], "error", err[0].message + ', processing file: ' + err[1]);
                    }
                } else {
                    syslog.error(`${errs.length} errors encountered in parse. Here's the first:`);
                    syslog.inspect(errs[0][0], "error", errs[0][0].message + ', processing file: ' + errs[0][1]);
                }
            }
    
            if (count == 0) {
                await this.ctx.emit('AFTER_PARSE_EARLY');
            } else {
                await this.ctx.emit('AFTER_PARSE_LATE');
            }

            count++;
        }
    }

    /**
     * Process pagination.
     */
    async _processPagination()
    {
        if (!this.ctx.paginate) {
            return;
        }

        syslog.notice("Processing pagination.");

        await Promise.all(Object.keys(this.ctx.paginate).map(async articleKey => {
            syslog.info(`Creating paging for ${articleKey}`);
            let pobj = this.ctx.paginate[articleKey];
            if (!pobj.data) {
                throw new GreenHatSSGError("pagination objects need a 'data' field.");
            }
            if (!pobj.alias) {
                throw new GreenHatSSGError("pagination objects need an 'alias' field.");
            }
            if (!pobj.dummy) {
                throw new GreenHatSSGError("pagination objects need a 'dummy' field.");
            }
            let data = eval(`this.ctx.${pobj.data}.getData()`);
            let pc = new Paginate(data, this.ctx, pobj.alias, 'homePlus.html', (pobj.perPage) ? pobj.perPage : null);
            let art = this.ctx.articles.all.get(articleKey);
            art[pobj.alias] = pc;
            this.ctx.articles.all.set(articleKey, art);
        }));
    }

    /**
     * Render files.
     */
    async _renderFiles()
    {
        syslog.notice(`Rendering files.`);

        let errs = [];

        await Promise.all(this.ctx.renderQueue.map(async item => {
            let ext = item.renderExt;
            syslog.trace('SSG:_renderFiles', `File render ext: ${ext}, for item ${item.obj}.`);
            if (this.ctx.cfg.renderers[ext]) {
                try {
                    await this.ctx.cfg.renderers[ext].call(this.ctx, item.obj);
                } catch (err) {
                    errs.push([err, item.relPath]);
                }
            } else {
                syslog.warning(`No renderer found for extenstion '${ext}'.`);
            }
        }));

        if (errs.length > 0) {
            if (this.ctx.cfg.site.showAllErrors && this.ctx.cfg.site.showAllErrors == true) {
                syslog.error(`${errs.length} errors encountered in render. Here they are:`);
                for (let err of errs) {
                    syslog.inspect(err[0], "error", err[0].message + ', processing: ' + err[1]);
                }
            } else {
                syslog.error(`${errs.length} errors encountered in render. Here's the first:`);
                syslog.inspect(errs[0][0], "error", errs[0][0].message + ', processing: ' + errs[0][1]);
            }
        }

    }

    /**
     * Process the leftovers.
     */
    async _processLeftovers()
    {
        syslog.notice("Processing (just copying) leftover files.")
        this.ctx.counts['simple copies'] = 0;
        
        let difference = this.ctx.filesToProcess.filter(x => !this.ctx.filesProcessed.includes(x));
        await Promise.all(difference.map(async item => {
            let rel = item.replace(this.ctx.sitePath, '');
            let from = path.join(this.ctx.sitePath, rel);
            if (fs.existsSync(from)) {
                let to = path.join(this.ctx.sitePath, this.ctx.cfg.locations.site, rel)
                syslog.trace("GreenhatSSG:_processLeftovers", `Leftover: ${from} >> ${to}`);
                copyFile(from, to);
                this.ctx.counts['simple copies']++;
            }
        }));
    }

    /**
     * Clean up.
     */
    async _cleanup()
    {
        if (cleanDir(path.join(this.ctx.sitePath, this.ctx.cfg.locations.temp))) {
            syslog.notice("Cleaned out temp directory.");
        }
    }

    /**
     * Serve the site.
     * 
     * @param   {string}    sitePath    Path to site to serve.
     * @param   {string}    addr        Address.
     * @param   {number}    port        Port.
     */
    serve (sitePath, addr, port)
    {
        syslog.notice("Attempting to start serving from: " + sitePath);

        http.createServer(function (request, response) {
        
            let filePath = sitePath + request.url;

            if (filePath == (sitePath + '/')) {
                filePath = sitePath + '/index.html';
            }

            let extname = String(path.extname(filePath)).toLowerCase();

            if ('' == extname) {
                try {
                    if (fs.lstatSync(filePath).isDirectory()) {
                        filePath = path.join(filePath, 'index.html');
                    }
                } catch (err) {
                    filePath += '.html';
                }
            }
        
            extname = String(path.extname(filePath)).toLowerCase();
            
            let mimeTypes = {
                '.html': 'text/html',
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.json': 'application/json',
                '.png': 'image/png',
                '.jpg': 'image/jpg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.wav': 'audio/wav',
                '.mp4': 'video/mp4',
                '.woff': 'application/font-woff',
                '.ttf': 'application/font-ttf',
                '.eot': 'application/vnd.ms-fontobject',
                '.otf': 'application/font-otf',
                '.wasm': 'application/wasm'
            };
        
            let contentType = mimeTypes[extname] || 'application/octet-stream';
        
            let dispTypes = {
                '.png': 'inline',
                '.jpg': 'inline',
                '.gif': 'inline',
                '.svg': 'inline'
            };

            let dispType = dispTypes[extname] || '';

            syslog.trace("ConsoleApp:serve", 
                "Serving up: " + request.url + "\n => " + filePath + "\n => as " + contentType);

            fs.readFile(filePath, function(error, content) {
                if (error) {
                    if(error.code == 'ENOENT') {
                        fs.readFile(sitePath + '/404.html', function(error, content) {
                            response.writeHead(404, { 'Content-Type': contentType });
                            response.end(content, 'utf-8');
                        });
                    }
                    else {
                        response.writeHead(500);
                        response.end('Sorry, check with the site admin for error: ' + error.code + '.\n');
                    }
                }
                else {
                    if ('' != dispType) {
                        response.writeHead(200, { 'Content-Type': contentType });
                        response.writeHead(200, { 'Content-Disposition': dispType });
                    } else {
                        response.writeHead(200, { 'Content-Type': contentType });
                    }
                    response.end(content, 'utf-8');
                }
            });
        
        }).listen(port);

        syslog.notice("Server running at: " + "http://" + addr + ":" + port);        
    }
}

module.exports = SSG;
