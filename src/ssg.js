/**
 * @file        GreenHat SSG controller.
 * @module      SSG
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const syslog = require("greenhat-util/syslog");
const pkg = require("../package.json");
const Context = require("./context");
const path = require('path');
const fs = require('fs');
const ConfigLoader = require("./loaders/configLoader")
const DataLoader = require("./loaders/dataLoader")
const PluginLoader = require("./loaders/pluginLoader")
const ghfs = require("greenhat-util/fs");
const Config = require("./config");
const GreenHatSSGError = require("./ssgError")
const { deleteFolderRecursive, cleanDir, copyFile, copyDir } = require('greenhat-util/fs');
const XLator = require("greenhat-util/xlate");
const os = require('os');
const http = require('http');
const Paginate = require("./paginate");
const bftp = require("basic-ftp");
const { Schema } = require("greenhat-schema");
const arr = require("greenhat-util/array");

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
     * FTP files.
     */
    #ftpFiles = [];

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

        this.ctx.cfg = new Config(require('./defaultConfig'), this.ctx);

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

        //syslog.inspect(this.ctx.cfg);

        if (this.ctx.cfg.site.traceKeys) {
            syslog.setTraceKeys(this.ctx.cfg.site.traceKeys);
        }

        if (this.ctx.cfg.site.msgLevel) {
            syslog.setLevel(this.ctx.cfg.site.msgLevel);
        }

        if ('exceptionTraces' in this.ctx.cfg.site) {
            syslog.setExceptionTraces(this.ctx.cfg.site.exceptionTraces);
        }

        if (this.ctx.args.ftpOnly) {
            return 0;
        } else {

            await this._loadSystemPlugins();
            await this._loadUserPlugins();
            await this._loadData();

            //syslog.inspect(this.ctx.cfg.articleSpec);

            if (this.ctx.cfg.cfgChk) {
                this._checkConfig(this.ctx.cfg.cfgChk, this.ctx.cfg, []);
            }

            this._loadTranslations();
        }

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

        let loader = new ConfigLoader(configPath, this.ctx, this.ctx.sitePath, {ignoreFiles: ['.']});
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
            {allowFiles: ['.'], ignoreFilesByDefault: true, ignoreFilesFirst: ['.DS_Store']});
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

        this.ctx.silent = false;

        if (this.ctx.args.ftpOnly) {
            await this._ftp();
            return 0;
        } else {

            await this._mainLoop();

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
                this.server = this.serve(path.join(this.ctx.sitePath, this.ctx.cfg.locations.site), 
                    this.ctx.cfg.site.dev.addr, this.ctx.cfg.site.dev.port);

                if (this.ctx.args.watch) {
                    syslog.notice('Watching for changes ...');
                    fs.watch(this.ctx.sitePath, {recursive: true}, async (eventType, fileName) => {
                        if (fileName) {
                            await this.watchChange(eventType, fileName);
                        }
                    });
                }
            }
        }


        return 0;
    }

    /**
     * The main SSG loop.
     */
    async _mainLoop()
    {
        this._cleanDirectories(this.ctx.watch);

        if (this.ctx.watch) {
            this.ctx.filesProcessed = [];
            this.ctx.filesToProcess = [this.ctx.watch];
        } else {
            await this._parseFileSystem();
        }

        await this._parseFiles();
        await this._processPagination();
        await this._renderFiles();
        await this._processLeftovers();
        await this._justCopy();
        await this._copyLayouts();
        await this._cleanup();
    }

    /**
     * A file has changed.
     * 
     * @param   {string}    eventType   Type of event.
     * @param   {string}    fileName    File name. 
     */
    async watchChange(eventType, fileName)
    {
        //syslog.debug(`File ${fileName} has receieved event '${eventType}'.`);
        let full = path.join(this.ctx.sitePath, fileName);
        let ext = path.extname(full);
        let base = path.basename(full);

        // Ignore temp files.
        let tmpFiles = [
            this.ctx.cfg.locations.temp,
            this.ctx.cfg.locations.site,
            this.ctx.cfg.locations.cache,
        ];

        for (let t of tmpFiles) {
            if (fileName.startsWith(t)) {
                return;
            }
        }

        // Ignore just copies.
        let jc = this.ctx.cfg.justCopy;
        if (jc.dirs && jc.dirs.length > 0) {
            for (let d of jc.dirs) {
                if (fileName.startsWith(d)) {
                    syslog.debug(`Ignoring justCopy file: ${fileName}.`);
                    return;
                }
            }
        }

        // Ignore some files beginning with a dot.
        if (base.startsWith('.DS_Store')) {
            return;
        }

        if (eventType == 'change') {
            syslog.notice(`Reparsing file ${fileName} (event detected: ${eventType}), wait ...`);
            let ssaved = this.ctx.silent;
            this.ctx.silent = true;
            this.ctx.watch = full;
            await this._mainLoop();
            this.ctx.watch = null;
            this.ctx.silent = ssaved;
            syslog.notice(`Reparse complete.`);
        }

        /*
        let ext = path.extname(full);
        let base = path.basename(full);
        if (ext == '.md') {
            this.ctx.renderQueue = [];
            this.ctx.silent = true;
            syslog.notice(`Reparsing file ${fileName} (event detected: ${eventType}).`);
            let article = await this.ctx.cfg.parsers['md'].call(this.ctx, fileName);
            await this.ctx.cfg.renderers['njk'].call(this.ctx, article);
            await this._processPagination();
        } else if (ext == '.scss' && !base.startsWith('_')) {
            syslog.notice(`Reparsing file ${fileName} (event detected: ${eventType}).`);
            await this.ctx.cfg.parsers['scss'].call(this.ctx, fileName);
        } else if (ext == '.njk' && !base.startsWith('_')) {
            syslog.notice(`Change to template file ${fileName} (event detected: ${eventType}).`);
            await this._renderFiles().then( _ => {
                syslog.notice(`Rerender complete.`);
            });
        }
        */
    }

    /**
     * FTP?
     */
    async _ftp()
    {
        if (this.ctx.args.ftpTest) {
            syslog.notice("FTP running in test mode.")
        } else {
            syslog.notice("Will attempt to FTP the necessary files.");
        }

        if (!this.ctx.cfg.site.ftp) {
            syslog.error("FTP has been requested but no definitions are present in the configs.");
            return;
        }

        let ftpSpecs = this.ctx.cfg.site.ftp;

        if (ftpSpecs.sources.length == 0) {
            syslog.error("FTP has been requested but no sources are specified.");
            return;
        }

        if (ftpSpecs.sources.length != ftpSpecs.dests.length) {
            syslog.error("FTP needs the same number of 'dests' as 'sources'. Check your config.");
            return;
        }

        for (let test of ['host', 'user', 'password']) {
            if (!test in ftpSpecs) {
                syslog.error("FTP specification needs the '" + test + "' key.");
                return;
            }
        }

        // Get todays date.
        let now = new Date();

        // Subtract hours.
        if (!ftpSpecs.hours) {
            ftpSpecs.hours = 24;
        }
        now.setHours(now.getHours() - ftpSpecs.hours);
        syslog.notice("Will FTP source files changed in the last " + ftpSpecs.hours + " hours, since: " + now.toISOString());

        // Start the loop.
        let count = 0;
        for (let dir of ftpSpecs.sources) {
            syslog.info("FTP is reading directory: " + dir);
            await this._parseFTPDir(dir, now, count);
            count = count + 1;
        }

        // Count the files.
        count = 0;
        for (let idx in this.#ftpFiles) {
            count = count + this.#ftpFiles[idx].length;
        }
        if (count == 0) {
            syslog.notice("No files to FTP.");
            return;
        } else {
            syslog.notice(count + " files to FTP.");
        }

        // Set up the FTP client.
        const client = new bftp.Client();
        if (ftpSpecs.verbose) {
            client.ftp.verbose = ftpSpecs.verbose;
        }

        // Connect.
        let dets = {
            host: ftpSpecs.host,
            user: ftpSpecs.user,
            password: ftpSpecs.password,
        }
        for (let poss of ['secure', 'port']) {
            if (ftpSpecs[poss]) {
                dets[poss] = ftpSpecs[poss];
            }
        }


        try {
            await client.access(dets)
        } catch (err) {
            syslog.error("FTP connection error: " + err);
            return 0;
        }

        for (let count in this.#ftpFiles) {
            let files = this.#ftpFiles[count];
            let destDir = ftpSpecs.dests[count];
            for (let file of files) {
                let destFile = path.join(destDir, path.basename(file));
                if (this.ctx.args.ftpTest) {
                    syslog.notice(file + " ==> " + destFile);
                } else {
                    try {
                        syslog.info("Uploading " + file + " to " + destFile);
                        await client.uploadFrom(file, destFile);
                    } catch (err) {
                        syslog.error("FTP transfer error: " + err);
                    }
                }
            }
        }

        client.close();

    }

    /**
     * Parse and FTP directory.
     * 
     * @param   string  dir         Directory. 
     * @param   Date    dt          Date time.
     */
    async _parseFTPDir(dir, dt, count)
    {
        let entries = fs.readdirSync(dir);
        this.#ftpFiles[count] = [];

        await Promise.all(entries.map(async entry => {

            let filePath = path.join(dir, entry);
            let stats = fs.statSync(filePath);

            if (stats.isFile()) {
                if (!entry.startsWith('.')) {
                    if (stats.mtimeMs > dt.getTime()) {
                        this.#ftpFiles[count].push(filePath);
                    }
                }
            } else if (stats.isDirectory()) {
                await this._parseFTPDir(filePath);
            }

        }));
    }

    /**
     * Clean the website.
     */
    _cleanDirectories()
    {
        let watch = this.ctx.watch;

        if (!watch) {
            if (deleteFolderRecursive(path.join(this.ctx.sitePath, this.ctx.cfg.locations.site))) {
                if (!watch) {
                    syslog.notice("Cleaned out site directory.");
                }
            }
        }
        if (cleanDir(path.join(this.ctx.sitePath, this.ctx.cfg.locations.temp))) {
            if (!watch) {
                syslog.notice("Cleaned out temp directory.");
            }
        }
        if (this.ctx.args.clearCache && 
            cleanDir(path.join(this.ctx.sitePath, this.ctx.cfg.locations.cache))) {
            if (!watch) {
                syslog.notice("Cleaned out cache directory.");
            }
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
     * 
     * @param   {string[]}  filesToProcess  The files to process.
     */
    async _parseFiles(filesToProcess = null)
    {
        let watch = this.ctx.watch;
        let selective = false;
        if (filesToProcess) {
            filesToProcess = arr.makeArray(filesToProcess);
            selective = true;
        } else {
            filesToProcess = this.ctx.filesToProcess;
        }

        let saved;

        let earlyParsers = [];
        let lateParsers = [];

        if (this.ctx.cfg.earlyParse && this.ctx.cfg.earlyParse.length > 0) {
            earlyParsers = filesToProcess.filter(f => {
                return this.ctx.cfg.earlyParse.includes(path.extname(f).slice(1));
            });
            lateParsers = filesToProcess.filter(f => {
                return !this.ctx.cfg.earlyParse.includes(path.extname(f).slice(1));
            });
        } else {
            lateParsers = filesToProcess;
        }

        let count = 0;
        for (let arr of [earlyParsers, lateParsers]) {
        
            if (count == 0) {
                if (!selective) {
                    if (!watch) {
                        syslog.notice(`Parsing files (early).`);
                    }
                }
                await this.ctx.emit('BEFORE_PARSE_EARLY');
            } else {
                if (!selective) {
                    if (!watch) {
                        syslog.notice(`Parsing files (late).`);
                    }
                }
                await this.ctx.emit('BEFORE_PARSE_LATE');
            }

            let errs = [];

            await Promise.all(arr.map(async file => {
                let ext = path.extname(file).slice(1);
                syslog.trace('SSG:_parseFiles', `File parser ext: ${ext}, for file ${file}.`);
                if (this.ctx.cfg.parsers[ext]) {
                    try {
                        saved = await this.ctx.cfg.parsers[ext].call(this.ctx, file);
                    } catch (err) {
                        if (this.ctx.cfg.site.errorControl.exitOnFirst) {
                            syslog.fatal(`Error parsing ${file}. Error message: ${err.message}`);
                            if (this.ctx.cfg.site.errorControl.printStack) {
                                console.log(' ');
                                syslog.error(`STACK TRACE: ${err.stack}`)
                            }     
                            process.exit(1);                  
                        } else {
                            errs.push([err, file]);
                        }
                    }
                    this.ctx.filesProcessed.push(file);
                }
            }));

            if (errs.length > 0) {
                if (this.ctx.cfg.site.errorControl.showAllErrors) {
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

        return saved;
    }

    /**
     * Process pagination.
     */
    async _processPagination()
    {
        let watch = this.ctx.watch;

        if (!this.ctx.paginate) {
            return;
        }

        if (!watch) {
            syslog.notice("Processing pagination.");
        }

        await Promise.all(Object.keys(this.ctx.paginate).map(async articleKey => {
            if (!this.ctx.silent) {
                syslog.info(`Creating paging for ${articleKey}`);
            }
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
            let pc = new Paginate(data, this.ctx, pobj.alias, 'homePlus.html', 
                (pobj.perPage) ? pobj.perPage : null);
            let art = this.ctx.articles.all.get(articleKey);
            art[pobj.alias] = pc;
            this.ctx.articles.all.set(articleKey, art);
        }));
    }

    /**
     * Render a single item.
     * 
     * @param   {object}    item    Item to render. 
     */
    async _renderSingleItem(item)
    {
        let errs = [];
        let ext = item.renderExt;
        syslog.trace('SSG:_renderFiles', `File render ext: ${ext}, for item ${item.obj}.`);
        if (this.ctx.cfg.renderers[ext]) {
            try {
                await this.ctx.cfg.renderers[ext].call(this.ctx, item.obj);
            } catch (err) {
                if (this.ctx.cfg.site.errorControl.exitOnFirst) {
                    syslog.fatal(`Error rendering ${item.relPath}. Error message: ${err.message}`);
                    if (this.ctx.cfg.site.errorControl.printStack) {
                        console.log(' ');
                        syslog.error(`STACK TRACE: ${err.stack}`)
                    }     
                    process.exit(1);                  
                } else {
                    errs.push([err, item.relPath]);
                }
            }
        } else {
            syslog.warning(`No renderer found for extenstion '${ext}'.`);
        }

        return errs;
    }

    /**
     * Render files.
     */
    async _renderFiles()
    {
        let watch = this.ctx.watch;

        if (!watch) {
            syslog.notice(`Rendering files.`);
        }

        let errs = [];

        await Promise.all(this.ctx.renderQueue.map(async item => {
            let e = await this._renderSingleItem(item);
            if (e && e.length > 0) {
                for (let eadd of e) {
                    errs.push(eadd);
                }
            }
        }));

        if (errs.length > 0) {
            if (this.ctx.cfg.site.errorControl.showAllErrors) {
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
        let watch = this.ctx.watch;
        if (!watch) {
            syslog.notice("Processing (just copying) leftover files.")
        }
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
     * The stuff we just copy.
     */
    async _justCopy()
    {
        let watch = this.ctx.watch;
        if (!watch) {
            syslog.notice("Dealing with stuff we've just been instructed to copy as-is.");
        }
        let jc = this.ctx.cfg.justCopy;
        if (jc.dirs && jc.dirs.length > 0) {
            await Promise.all(Object.values(jc.dirs).map(async jcd => {
                let from = path.join(this.ctx.sitePath, jcd);
                if (fs.existsSync(from)) {
                    if (!this.ctx.watch) {
                        syslog.info(`Copying directory ${from}.`);
                    }
                    let to = path.join(this.ctx.sitePath, this.ctx.cfg.locations.site, jcd)
                    copyDir(from, to);
                }
            }));                
        }
        if (jc.files && jc.files.length > 0) {
            await Promise.all(Object.values(jc.files).map(async jcf => {
                let from = path.join(this.ctx.sitePath, jcf);
                if (fs.existsSync(from)) {
                    if (!this.ctx.watch) {
                        syslog.info(`Copying file ${from}.`);
                    }
                    let to = path.join(this.ctx.sitePath, this.ctx.cfg.locations.site, jcf)
                    copyFile(from, to);
                }
            }));    
        }
    }

    /**
     * Copy the latest templates.     
     */
    async _copyLayouts()
    {
        let watch = this.ctx.watch;
        if (!watch) {
            syslog.notice("Copying layouts.");
        }

        let from = path.join(this.ctx.appPath, this.ctx.cfg.locations.sysLayouts);
        let to = path.join(this.ctx.sitePath, '_layouts.system');

        cleanDir(to);
        copyDir(from, to);
    }

    /**
     * Clean up.
     */
    async _cleanup()
    {
        let watch = this.ctx.watch;
        if (cleanDir(path.join(this.ctx.sitePath, this.ctx.cfg.locations.temp))) {
            if (!watch) {
                syslog.notice("Cleaned out temp directory.");
            }
        }
    }

    /**
     * Serve the site.
     * 
     * @param   {string}    sitePath    Path to site to serve.
     * @param   {string}    addr        Address.
     * @param   {number}    port        Port.
     * @return  {object}                Server object.
     */
    serve (sitePath, addr, port)
    {
        syslog.notice("Attempting to start serving from: " + sitePath);

        let server = http.createServer(function (request, response) {
        
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
                '.jpeg': 'inline',
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
        
        return server;
    }
}

module.exports = SSG;