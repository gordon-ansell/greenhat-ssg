/**
 * @file        Image parser.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

const { syslog } = require("greenhat-util/syslog");
const path = require('path');
const Image = require('./image');
const md5 = require('md5');
const fs = require('fs');
const { copyFile } = require('greenhat-util/fs');
const sharp = require('sharp');
const deasync = require('deasync');
const GreenHatSSGError = require('../../ssgError');

class GreenHatSSGImageError extends GreenHatSSGError {}

/**
 * Image parser class.
 */
class ImageParser
{
    /**
     * Cache check?
     * 
     * @var {boolean}
     */
    static cacheCheck = false;

    /**
     * Cache MDs.
     * 
     * @var {object}
     */
    static cache = null;

    /**
     * Have we created image storage.
     */
    static stCreated = false;

    /**
     * Constructor.
     * 
     * @param   {object}    ctx     Context.
     */
    constructor(file, ctx)
    {
        this.file = file;
        this.relPath = file.replace(ctx.sitePath, '');
        this.ctx = ctx;
        this.opts = ctx.cfg.imageSpec;

        this.img = new Image(file, ctx.sitePath, this.opts);
    }

    /**
     * Do the parse.
     * 
     * @param   {string}    file    File to parse.
     */
    async parse()
    {
        syslog.trace('ImageParser:parse', `Parsing file: ${this.file}.`);

        // Resizeable?
        if (this.isResizable()) {
            syslog.trace('ImageParser:parse', `Is resizeable image.`);
            await this._processResizable();
        } else {
            syslog.trace('ImageParser:parse', `Is NOT resizeable image.`);
            this._processStandard();
        }

        await this.saveImage();
    }

    /**
     * Save the image.
     */
    async saveImage()
    {
        if (!ImageParser.stCreated) {
            if (this.ctx.images) {
                throw new GreenHatSSGImageError("The 'images' storage already exists in the context.");
            }
            this.ctx.images = new Map();
            ImageParser.stCreated = true;
        }

        if (this.ctx.images.has(this.img.relPath)) {
            //syslog.inspect(this.ctx.images.get(this.img.relPath))
            syslog.warning(`We already have an image stored under ${this.img.relPath}. Overwriting it.`);
        }

        this.ctx.images.set(this.img.relPath, this.img);
    }

    /**
     * Process as a resizeable image.
     */
    async _processResizable()
    {
        // Check the original.
        let refresh = false;
        let imageMd = this._requiresCacheRefresh(this.img.cachePath, this.file, '.orig');
        if (imageMd) {
            syslog.notice("Processing image: " + this.img.relPath + ".");
            copyFile(this.file, this.img.cachePath + '.orig');
            if (ImageParser.cache) {
                ImageParser.cache[this.img.cachePath + '.orig'] = imageMd;
            }
            refresh = true;
        }

        // Get the regex.
        let regex = RegExp(this.opts.resizeableFileNameRegex, 'g');

        // What sizes do we want?
        let sizesWanted = [];
        let sizesToCreate = [];
        let sizesNotCreated = [];

        let sr = this.opts.sizesRequired.filter(s => {
            return (s <= this.img.width || (s > this.img.width && this.opts.upscaling));
        });


        await Promise.all(sr.map(async size => {            
            let subImageUrl = this.img.relPath.replace(regex, "-" + size + "w.");
            let obj = {
                size: size,
                subImageUrl: subImageUrl,
                subImagePath: path.join(this.ctx.sitePath, subImageUrl),
                cachePath: path.join(this.ctx.sitePath, this.opts.cachePath, this.opts.cacheImages, subImageUrl)
            }
            sizesWanted.push(obj);

            if (refresh || !fs.existsSync(obj['cachePath'])) {
                sizesToCreate.push(obj);
            } else {
                sizesNotCreated.push(obj);
            }
        }));
         
        // Create the subs map.
        if (this.img.subs === null) {
            this.img.subs = new Map();
        }

        // Create the necessary images.
        await Promise.all(sizesToCreate.map(async obj => {
            try {
                await this.resize(obj).then(_ => {
                    let sub = new Image(obj['subImagePath'], this.ctx.sitePath, this.opts, true);
                    this.img.subs.set(obj['size'], sub);
                });
            } catch (err) {
                syslog.error("Error in (async) image creation.", err.message);
            }
        }));

        // Now create the subimage classes.
        await Promise.all(sizesNotCreated.map(async obj => {
            try {
                let sub = new Image(obj['subImagePath'], this.ctx.sitePath, this.opts, true);
                this.img.subs.set(obj['size'], sub);
            } catch (err) {
                syslog.error("Error in (async, not created) image processing.", err.message);
            }
        }));
    }

    /**
     * Sharpe resize.
     * 
     * @param {object}  obj   Info object.
     */
    async resize(obj)
    {
        if (!fs.existsSync(path.dirname(obj['cachePath']))) {
            mkdirRecurse(path.dirname(obj['cachePath']))
        }

        let done = false;
        try {
            await sharp(this.file)
                .resize(obj['size'])
                .toFile(obj['cachePath'], (err, info) => {
                    if (err) {
                        syslog.error(err.message);
                        return;
                    }
                    syslog.info("Created resized image: " + obj['subImageUrl']);
                    done = true;
                });
        } catch(err) {
            syslog.error("Error in image resize.", err.message);
        }

        // Have to add hacky deasync here because sharp will just NOT wait
        // for the file to be written out before returning. When I put 'await' on
        // something I expect it to wait.
        deasync.loopWhile(() => {
            return !done;
        });
    }

    /**
     * Process as a standard image.
     */
    _processStandard()
    {
        let imageMd = this._requiresCacheRefresh(this.img.cachePath, this.file); 
        if (imageMd) {
            syslog.notice("Processing image: " + this.img.relPath + ".");
            copyFile(this.file, this.img.cachePath);
            if (ImageParser.cache != null) {
                ImageParser.cache[this.img.cachePath] = imageMd;
            }
        }

    }

    /**
     * See if the image is resizeable.
     * 
     * @return  {boolean}   True if it is, else false.
     */
    isResizable()
    {
        const regex = new RegExp(this.opts.resizeableFileNameRegex, 'g');
        return regex.test(path.basename(this.file)) && 
            this.opts.resizeableExts.includes(path.extname(this.file).substring(1));
    }

    /**
     * See if a cache refresh is required.
     * 
     * @param   {string}    cachePath   Path to cache file.
     * @param   {string}    imagePath   Path to image file.
     * @param   {string}    append      String to append to cache path.
     * @return  {string|false}          MD5 if it is, else false.
     */
    _requiresCacheRefresh(cachePath, imagePath, append = '')
    {
        if (!ImageParser.cacheCheck) {
            return false;
        }
        
        cachePath += append;

        let imageMd = md5(fs.readFileSync(imagePath));

        if (!fs.existsSync(cachePath)) {
            syslog.trace('ImageParser:_requiresCacheRefresh', "Cache refresh required (new) for: " + imagePath);
            return imageMd;
        }

        if (!fs.existsSync(imagePath)) {
            throw new GreenHatSSGImageError("Oops, image file does not exist: " + imagePath);
        }

        if (ImageParser.cache != null && ImageParser.cache[cachePath]) {
            if (ImageParser.cache[cachePath] != imageMd) {
                syslog.trace('ImageParser:_requiresCacheRefresh', "Cache refresh required (md5) for: " + imagePath);
                return imageMd;
            }
        } else {
            if (md5(fs.readFileSync(cachePath)) != imageMd) {
                syslog.trace('ImageParser:_requiresCacheRefresh', "Cache refresh required (md5) for: " + imagePath);
                return imageMd;
            }
        }

        syslog.trace('ImageParser:_requiresCacheRefresh', "No cache refresh required for: " + imagePath);
        return false;
    }
}

module.exports = ImageParser;
