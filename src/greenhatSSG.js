/**
 * @file        GreenHat controller.
 * @module      GreenHatSSG
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { syslog, checkTypes, YamlFile, deleteFolderRecursive, mkdirRecurse, cleanDir,
    FileSystemParser, merge, makeArray, ConsoleApp, copyFile} = require('greenhat-base');
const path = require('path');
const fs = require('fs');
const ArticleParser = require('./article/articleParser');
const NunjucksParser = require('./template/nunjucksParser');
const GreenhatSSGError = require('./greenhatSSGError');
const Context = require('./context');
const os = require('os');
const TaxonomyType = require('./taxonomy/taxonomyType');
/**
 * Main GreenHat SSG class.
 * 
 * @property    {object}    ctx             Context.
 * @property    {object}    args            Command line arguments.
 */
class GreenhatSSG extends ConsoleApp
{
    /**
     * Constructor.
     * 
     * @param   {object}    args    Command line arguments. 
     */
    constructor(args)
    {
        super(args);

        //syslog.setLevel("trace");
        //syslog.setTraceKeys('plugin*');

        syslog.notice("=".repeat(50));
        syslog.notice("Greenhat SSG started.");

        if (!args.input) {
            args.input = '.';
        } 

        this.ctx = new Context();

        if (args.dev) {
            this.ctx.mode = 'dev';
        } else {
            this.ctx.mode = 'prod';
        }

        this.ctx.config = require('./defaultConfig');
        this.ctx.appPath = path.dirname(this.args['_'][1]);
        this.ctx.sitePath = path.resolve(args.input);
        this.ctx.args = this.args;

        this.ctx.filesProcessed = [];

    }

    /**
     * Initialise.
     */
    async init()
    {
        // Flag the start time.
        this.startTime = Date.now();
        
        // Load the user config.
        await this._loadConfig(path.join(this.ctx.sitePath, this.ctx.config.dirs.config), 'user');

        // Load the plugins.
        this._loadPlugins();

        // Check the config.
        this._checkConfig();

        // Counts.
        this.ctx.counts = {
            articles: 0,
            posts: 0,
        }

        // Emit the afterConfig event.
        await this.emit('AfterConfig');
    }

    /**
     * Check the config.
     */
    _checkConfig()
    {
        if (this.ctx.mode == 'prod') {
            if (!this.ctx.config.site.prodUrl) {
                throw new GreenhatSSGError("Site spec needs a 'prodUrl' setting.")
            }
        }

        // Some defaults.
        if (!this.ctx.config.site.dev) {
            this.ctx.config.site.dev = {
                addr: '127.0.0.1',
                port: 8081
            }
        }

        if (!this.ctx.config.site.dev.addr) {
            this.ctx.config.site.dev.addr = '127.0.0.1';
        }

        if (!this.ctx.config.site.dev.port) {
            this.ctx.config.site.dev.port = 8081;
        }

        // Hostname.
        let host = os.hostname();
        this.ctx.config.site.host = host;
        if (this.ctx.config.site.hosts && this.ctx.config.site.hosts[host]) {
            this.ctx.config.site.dev.addr = this.ctx.config.site.hosts[host];
        }

        // Set the URL.
        if (this.ctx.mode == 'dev') {
            this.ctx.config.site.url = 'http://' + this.ctx.config.site.dev.addr + ':' + this.ctx.config.site.dev.port;
        } else {
            this.ctx.config.site.url = this.ctx.config.site.prodUrl;
        }  

        // Assets URL.
        if (!this.ctx.config.site.assetsUrl) {
            this.ctx.config.site.assetsUrl = '/assets';
        }
        if (!this.ctx.config.site.assetsUrl.startsWith(path.sep)) {
            this.ctx.config.site.assetsUrl = path.sep + this.ctx.config.site.assetsUrl;
        }
    }

    /**
     * Load a single plugin.
     * 
     * @param   {string}    pluginPath  Path to the plugin.
     * @param   {string}    pluginName  Name of plugin.
     * @param   {string[]}  pluginSpec  Plugin specifications.
     */
    _loadSinglePlugin(pluginPath, pluginName, pluginSpec)
    {
        pluginSpec = makeArray(pluginSpec);

        let thisPlugin;

        try {
            thisPlugin = require(pluginPath);
        } catch (err) {
            throw new GreenhatSSGError(`Failed to include plugin at ${pluginPath}.`, err.message);
        }

        for (let evData of pluginSpec) {

            if (!evData.includes('|')) {
                evData += '|50';
            }

            let sp = evData.split('|');
            let evName = sp[0];
            let evPri = sp[1];
            let fname = evName;

            if (typeof thisPlugin[fname] != "function") {
                syslog.warning(`Plugin '${pluginName}' has no '${fname}' function.`);
                continue;
            }

            this.on(evName, thisPlugin[fname], parseInt(evPri));

            syslog.trace('GreenhatSSG:_loadSinglePlugin', `Registered plugin '${pluginName}' for event '${evName}'.`)
        }

        syslog.info("Loaded plugin: " + pluginName + '.');

    }

    /**
     * Load plugins.
     */
    _loadPlugins()
    {
        this._plugins = {};

        this.ctx.pluginsLoaded = [];

        let paths = [
            path.join(this.ctx.appPath, this.ctx.config.dirs.sysPlugins),
            path.join(this.ctx.sitePath, this.ctx.config.dirs.plugins)
        ];

        let spec = this.ctx.config.plugins;

        for (let pluginKey in spec) {
            syslog.trace('GreenhatSSG:_loadPlugins', `Attempting to load plugin '${pluginKey}'.`);

            let found = false;

            for (let p of paths) {
                let tp = path.join(p, pluginKey, pluginKey + '.js');
                if (fs.existsSync(tp)) {
                    syslog.trace('GreenhatSSG:_loadPlugins', `=> found '${pluginKey}' plugin at ${tp}.`);
                    found = true;
                    this._loadSinglePlugin(tp, pluginKey, spec[pluginKey]);

                    if (this.ctx.pluginsLoaded.includes(pluginKey)) {
                        syslog.warning(`Plugin '${pluginKey}' already exists.`);
                    } else {
                        this.ctx.pluginsLoaded.push(pluginKey);
                    }
                }
            }

            if (!found) {
                syslog.warning(`Plugin '${pluginKey}' not found.`);
            }
    
        }
    }

    /**
     * Load the configs.
     * 
     * @param   {string}    configPath  Path to load from.
     * @param   {string}    type        Config type.
     */
    async _loadConfig(configPath, type)
    {
        checkTypes(arguments, ['string', 'string'], 'GreenhatSSG:_loadConfig');

        syslog.notice("Loading configs.");

        let fsp = new FileSystemParser(configPath, this.ctx.sitePath);
        let results = await fsp.parse();

        for (let f of results) {
            let rel = f.replace(this.ctx.sitePath, '');
            let ext = path.extname(f);
            
            let data;

            switch (ext) {
                case ".yaml":
                    syslog.trace('GreenhatSSG:_loadConfig', `Loading ${type} config YAML file ${rel}.`);
                    data = new YamlFile(f).parse();
                    break;
                case ".js":
                    syslog.trace('GreenhatSSG:_loadConfig', `Loading ${type} config JS file ${rel}.`);
                    data = require(f);
                    break;
                case ".json":
                    syslog.trace('GreenhatSSG:_loadConfig', `Loading ${type} config JSON file ${rel}.`);
                    data = JSON.parse(fs.readFileSync(f, 'utf8'));
                    break;
                default:
                    syslog.warning(`Unsupported config file extension '${ext}' for file ${rel}.`);
                    continue;
            }

            //let base = path.basename(f, path.extname(f)).toLowerCase();
            let base = path.basename(f, path.extname(f));

            if (base[0] == '_') {
                this.ctx.config = merge(this.ctx.config, data);
            } else {
                this.ctx.config[base] = merge(this.ctx.config[base], data);
            }

        }
    }

    /**
     * Run the app.
     * 
     * @return  {number}    Exit code.
     */
    async run()
    {
        this._cleanDirectories();
        await this._parseFileSystem();
        await this._processArticles();
        await this._sortArticles();
        await this._processTaxonomies();
        await this._processHomePages();
        await this._renderArticles();
        await this._renderArticles(true);
        await this._processLeftovers();
        await this._cleanup();

        let elapsed = (Date.now() - this.startTime) / 1000;

        syslog.notice(`Greenhat SSG completed in ${elapsed} seconds.`);


        let c = '';
        for (let i in this.ctx.counts) {
            if (c != '') {
                c += ', ';
            }
            c += i + ': ' + this.ctx.counts[i];  
        }
        syslog.info("Counts: " + c);

        syslog.notice("=".repeat(50));

        if (this.args.serve) {
            this.serve(path.join(this.ctx.sitePath, this.ctx.config.dirs.site), 
                this.ctx.config.site.dev.addr, this.ctx.config.site.dev.port);
        }

        return 0;
    }

    /**
     * Clean up.
     */
    async _cleanup()
    {
        if (cleanDir(path.join(this.ctx.sitePath, this.ctx.config.dirs.temp))) {
            syslog.notice("Cleaned out temp directory.");
        }
    }

    /**
     * Process the leftovers.
     */
    async _processLeftovers()
    {
        syslog.notice("Processing (just copying) leftover files.")
        
        let difference = this.ctx.filesToProcess.filter(x => !this.ctx.filesProcessed.includes(x));
        await Promise.all(difference.map(async item => {
            let rel = item.replace(this.ctx.sitePath, '');
            let from = path.join(this.ctx.sitePath, rel);
            if (fs.existsSync(from)) {
                let to = path.join(this.ctx.sitePath, this.ctx.config.dirs.site, rel)
                syslog.trace("GreenhatSSG:_processLeftovers", `Leftover: ${from} >> ${to}`);
                copyFile(from, to);
            }
        }));

    }

    /**
     * Get the renderer.
     * 
     * @return  {object}    Template renderer. 
     */
    getRenderer()
    {
        let layoutPaths = [
            path.join(this.ctx.sitePath, this.ctx.config.dirs.layouts),
            path.join(this.ctx.appPath, this.ctx.config.dirs.sysLayouts),
        ];

        if (!this._templateRenderer) {
            let tstype = this.ctx.config.templateSpec.type;
            let ts = this.ctx.config.templateSpec[tstype];
            switch (tstype) {
                case 'nunjucks':
                    this._templateRenderer = new NunjucksParser(layoutPaths, ts.opts);
                    break;
                default:
                    throw new GreenhatSSGError(`Unsupported template type: ${tstype}`);
            }
        }
        return this._templateRenderer;
    }

    /**
     * Render the articles.
     * 
     * @param   {boolean}   late    Late render?
     */
    async _renderArticles(late = false)
    {
        let l = (late) ? "(late)" : "(early)";
        syslog.notice(`Rendering articles ${l}.`);

        let renderer = this.getRenderer();

        await Promise.all(Array.from(this.ctx.articles.all.values()).map(async article => {
            let isLate = (article.late) ? article.late : false;
            if (late === isLate) {
                syslog.trace("GreenhatSSG:_renderArticles", `Rendering: ${article.url}`);
                await this.emit('PreRenderArticle', article);
                let output = await renderer.renderArticle(article, this.ctx);
                let opPath = path.join(this.ctx.sitePath, this.ctx.config.dirs.site, article.outputRelPath);
                mkdirRecurse(path.dirname(opPath));
                fs.writeFileSync(opPath, output);
            }
        }));

        if (late) {
            await this.emit('AfterRenderLate');
        } else {
            await this.emit('AfterRenderEarly');
        }

    }

    /**
     * Process the home pages.
     */
    async _processHomePages()
    {
        syslog.notice("Processing home pages.");

        let perPage = (this.ctx.config.site.articlesPerPage) ? this.ctx.config.site.articlesPerPage : 20;
        let homePagePostType = (this.ctx.config.site.homePagePostType) ? 
            this.ctx.config.site.homePagePostType : 'post';

        let articleCount = 0;
        if (homePagePostType == 'all' && this.ctx.articles.all) {
            articleCount = this.ctx.articles.all.size
        } else if (this.ctx.articles[homePagePostType]) {
            articleCount = this.ctx.articles[homePagePostType].size;
        }

        let pages = Math.ceil(articleCount / perPage);

        this.ctx.pager = pages;

        if (pages < 2) {
            return;
        }

        let pagesIter = [];
        for (let i = 2; i <= pages; i++) {
            pagesIter.push(i);
        }

        // Get the dummy.
        let dummyDirs = [
            path.join(this.ctx.sitePath, this.ctx.config.dirs.layouts, 'dummies', 'homePlus.html'),
            path.join(this.ctx.appPath, this.ctx.config.dirs.sysLayouts, 'dummies', 'homePlus.html')
        ];
        let fn;
        for (let p of dummyDirs) {
            if (fs.existsSync(p)) {
                fn = p;
                break;
            }
        }
        if (!fn) {
            syslog.error(`Could not find dummy home+ layout.`);
            return;
        }

        // Read the dummy.
        let dummy = fs.readFileSync(fn, 'utf-8');

        // Loop for necessary pages.
        await Promise.all(pagesIter.map(async page => {

            let start = (page * perPage) - perPage + 1;
            let end = start + perPage - 1;

            let fileData = dummy;
            fileData = fileData.replaceAll('-page-', page)
                .replaceAll('-title-', this.ctx.config.site.title)
                .replaceAll('-description-', this.ctx.config.site.description)
                .replaceAll('-start-', start)
                .replaceAll('-end-', end);

            // Define a file name and write to it.
            let fileName = path.join(this.ctx.sitePath, this.ctx.config.dirs.temp, 
                'homePlus', String(page).slugify() + '.html');
            let dir = path.dirname(fileName);
            if (!fs.existsSync(dir)) {
                mkdirRecurse(dir);
            }
            fs.writeFileSync(fileName, fileData, 'utf-8');

            // Parse the article.
            let article = await this._processSingleArticle(fileName);

            // Save the article.
            this.ctx.articles.all.set(article.url, article);
            this.ctx.articles.page.set(article.url, article);
        }));
        
    }

    /**
     * Process taxonomies.
     */
    async _processTaxonomies()
    {
        syslog.notice("Processing taxonomies.");

        // Grab the opts.
        let articleSpec = this.ctx.config.articleSpec;

        // Get the dummy.
        let dummyDirs = [
            path.join(this.ctx.sitePath, this.ctx.config.dirs.layouts, 'dummies', 'taxonomy.html'),
            path.join(this.ctx.appPath, this.ctx.config.dirs.sysLayouts, 'dummies', 'taxonomy.html')
        ];
        let fn;
        for (let p of dummyDirs) {
            if (fs.existsSync(p)) {
                fn = p;
                break;
            }
        }
        if (!fn) {
            syslog.error(`Could not find dummy taxonomy layout.`);
            return;
        }

        // Read the dummy.
        let dummy = fs.readFileSync(fn, 'utf-8');
        //syslog.inspect(dummy);

        // Process the taxonomies.
        await Promise.all(articleSpec.taxonomies.map(async taxType => {
            let taxonomyNames = Array.from(this.ctx.articles.taxonomy[taxType].items.keys());
            taxonomyNames.forEach(async taxonomyName => {
                // Set up the dummy file.
                let fileData = dummy;
                fileData = fileData.replaceAll('-taxonomy-', taxonomyName)
                    .replaceAll('-taxonomyType-', taxType);

                // Define a file name and write to it.
                let fileName = path.join(this.ctx.sitePath, this.ctx.config.dirs.temp, 
                    'taxonomies', taxType, taxonomyName.slugify() + '.html');
                let dir = path.dirname(fileName);
                if (!fs.existsSync(dir)) {
                    mkdirRecurse(dir);
                }
                fs.writeFileSync(fileName, fileData, 'utf-8');

                // Parse the article.
                let article = await this._processSingleArticle(fileName);

                // Save the article.
                this.ctx.articles.all.set(article.url, article);
                this.ctx.articles[article.type].set(article.url, article);
            })
        }));
        
    }

    /**
     * The compare function for sorting articles.
     * 
     * @param   {object}    a   First article.
     * @param   {object}    b   Second article.
     */
    _sortArticlesCompare(a, b)
    {
        if (a[1].dates.published.ms < b[1].dates.published.ms) {
            return 1;
        }
        if (b[1].dates.published.ms < a[1].dates.published.ms) {
            return -1;
        }
        return 0;
    }

    /**
     * Sort the articles.
     */
    async _sortArticles()
    {
        syslog.notice("Sorting articles.");

        let basics = ['all', 'post', 'page'];

        // Sort basics.
        await Promise.all(basics.map(async key => {
            this.ctx.articles[key] = new Map([...this.ctx.articles[key].entries()].sort(this._sortArticlesCompare));
        }));

        // Grab the opts.
        let articleSpec = this.ctx.config.articleSpec;

        // Sort the taxonomies.
        await Promise.all(articleSpec.taxonomies.map(async taxType => {
            this.ctx.articles.taxonomy[taxType].sortByCount();
            await this.ctx.articles.taxonomy[taxType].sortTaxonomies();
        }));

       await this.emit('AfterArticleSort');
    }

    /**
     * Process a single article.
     * 
     * @param   {string}    f       Filename.
     * @return  {object}            Article object.
     */
    async _processSingleArticle(f)
    {
        syslog.trace('GreenhatSSG:_processSingleArticle', 
            `Processing article file ${f.replace(this.ctx.sitePath, "")}.`);

        // Set up the parser.
        let parser = new ArticleParser(f, this.ctx.sitePath, this.ctx.appPath, this.ctx);

        // Initialise.
        let article = await parser.init();
        await this.emit('AfterArticleInit', article);

        // Parse.
        article = await parser.parse();
        await this.emit('AfterArticleParse', article);

        // Schema.
        await parser.processSchema();

        this.ctx.counts.articles++;

        return article;
    }

    /**
     * Process articles.
     */
    async _processArticles()
    {
        syslog.notice("Processing articles.")

        // Set up some storage.
        this.ctx.articles = {
            all: new Map(),
            post: new Map(),
            page: new Map(),
            taxonomy: {}
        };

        // Grab the opts.
        let articleSpec = this.ctx.config.articleSpec;

        // Filter the articles.
        let articleFiles = this.ctx.filesToProcess.filter(f => {
            return articleSpec.articleExts.includes(path.extname(f).substring(1));
        });

        // Process the articles.
        await Promise.all(articleFiles.map(async f => {

            // Process it.
            let article = await this._processSingleArticle(f);

            // Save 'all' and by type.
            this.ctx.articles.all.set(article.url, article);
            this.ctx.articles[article.type].set(article.url, article);

            if (article.type == 'post') {
                this.ctx.counts.posts++;
            }

            // Save by taxonomy.
            for (let taxType of articleSpec.taxonomies) {
                if (!this.ctx.articles.taxonomy[taxType]) {
                    this.ctx.articles.taxonomy[taxType] = new TaxonomyType(taxType);
                }
                if (article[taxType]) {
                    let t = makeArray(article[taxType]);
                    for (let item of t) {
                        if (!this.ctx.articles.taxonomy[taxType].hasTaxonomy(item)) {
                            this.ctx.articles.taxonomy[taxType].addTaxonomy(item);
                        }
                        //syslog.warning("Adding " + article.url + " to " + taxType + " with name " + item);
                        this.ctx.articles.taxonomy[taxType].getTaxonomy(item).addArticle(article);
                    }
                }
            }

            // Flag as processed.
            this.ctx.filesProcessed.push(f);

        }));


        //syslog.inspect(this.articles, "warning");

        //syslog.inspect(this.config);

        await this.emit('AfterAllArticlesProcessed');
    }

    /**
     * Parse the filesystem.
     */
    async _parseFileSystem()
    {
        syslog.notice('Parsing the filesystem.');

        this.ctx.filesToProcess = await new FileSystemParser(this.ctx.sitePath, this.ctx.sitePath, 
            this.ctx.config.fileSystemParser)
            .parse();

        await this.emit('AfterFileSystemParse');
    }

    /**
     * Clean the website.
     */
    _cleanDirectories()
    {
        if (deleteFolderRecursive(path.join(this.ctx.sitePath, this.ctx.config.dirs.site))) {
            syslog.notice("Cleaned out site directory.");
        }
        if (cleanDir(path.join(this.ctx.sitePath, this.ctx.config.dirs.temp))) {
            syslog.notice("Cleaned out temp directory.");
        }
        if (this.args.clearCache && 
            cleanDir(path.join(this.ctx.sitePath, this.ctx.config.dirs.cache))) {
            syslog.notice("Cleaned out cache directory.");
        }
    }

}

module.exports = GreenhatSSG;

