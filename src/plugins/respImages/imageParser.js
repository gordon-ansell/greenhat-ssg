/**
 * @file        Srcset image plugin - parser.
 * @module      plugins/respImages
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const path = require('path');
const fs = require('fs');
const deasync = require('deasync');
const Image = require('./image');
const { syslog, copyFile } = require('greenhat-base');
const md5 = require('md5');
const sharp = require('sharp');
const { mkdirRecurse } = require('greenhat-base/src/utils/filesystem');


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
     * Constructor.
     *
     * @constructor 
     * @param   {string}    filePath    Path to the image to process.
     * @param   {string}    absPath     Absolute path.
     * @param   {object}    opts        Options.
     * 
     * @return  {ImageParser}           New instance.
     */
    constructor(filePath, absPath, opts)
    {
        this._filePath = filePath;
        this._absPath = absPath;
        this._opts = opts;
    }

    /**
     * See if the image is resizeable.
     * 
     * @return  {boolean}   True if it is, else false.
     */
    isResizable()
    {
        const regex = new RegExp(this._opts.resizeableFileNameRegex, 'g');
        return regex.test(path.basename(this._filePath)) && 
            this._opts.resizeableExts.includes(path.extname(this._filePath).substring(1));
    }

    /**
     * Parse the image.
     * 
     * @return  {Image}     New image instance.
     */
    async parse()
    {
        // Set up the new image file.
        let img = new Image(this._filePath, this._absPath, this._opts);

        // Resizeable?
        if (this.isResizable()) {
            await this._processResizable(img);
        } else {
            this._processStandard(img);
        }

        return img;
    }

    /**
     * Process as a resizeable image.
     * 
     * @param   {Image}     img     The image object.
     */
    async _processResizable(img)
    {
        // Check the original.
        let refresh = false;
        let imageMd = this._requiresCacheRefresh(img.cachePath, this._filePath, '.orig');
        if (imageMd) {
            syslog.notice("Processing image: " + img.relPath + ".");
            copyFile(this._filePath, img.cachePath + '.orig');
            if (ImageParser.cache) {
                ImageParser.cache[img.cachePath + '.orig'] = imageMd;
            }
            refresh = true;
        }

        // Get the regex.
        let regex = RegExp(this._opts.resizeableFileNameRegex, 'g');

        // What sizes do we want?
        let sizesWanted = [];
        let sizesToCreate = [];
        let sizesNotCreated = [];

        await Promise.all(this._opts.sizesRequired.map(async size => {
            if (size <= img.width || (size > img.width && this._opts.upscaling)) {
                let subImageUrl = img.relPath.replace(regex, "-" + size + "w.");
                let obj = {
                    size: size,
                    subImageUrl: subImageUrl,
                    subImagePath: path.join(this._absPath, subImageUrl),
                    cachePath: path.join(this._absPath, this._opts.cachePath, this._opts.cacheImages, subImageUrl)
                }
                sizesWanted.push(obj);

                if (refresh || !fs.existsSync(obj['cachePath'])) {
                    sizesToCreate.push(obj);
                } else {
                    sizesNotCreated.push(obj);
                }
            }
        }));
         
        // Create the subs map.
        if (img.subs === null) {
            img.subs = new Map();
        }

        // Create the necessary images.
        await Promise.all(sizesToCreate.map(async obj => {
            try {
                await this.resize(obj).then(_ => {
                    let sub = new Image(obj['subImagePath'], this._absPath, this._opts, true);
                    img.subs.set(obj['size'], sub);
                });
            } catch (err) {
                syslog.error("Error in (async) image creation.", err.message);
            }
        }));

        // Now create the subimage classes.
        await Promise.all(sizesNotCreated.map(async obj => {
            try {
                let sub = new Image(obj['subImagePath'], this._absPath, this._opts, true);
                img.subs.set(obj['size'], sub);
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
            await sharp(this._filePath)
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
     * 
     * @param   {Image}     img     The image object.
     */
    _processStandard(img)
    {
        let imageMd = this._requiresCacheRefresh(img.cachePath, this._filePath); 
        if (imageMd) {
            syslog.notice("Processing image: " + img.relPath + ".");
            copyFile(this._filePath, img.cachePath);
            if (ImageParser.cache != null) {
                ImageParser.cache[img.cachePath] = imageMd;
            }
        }

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
            syslog.trace('plugin:respImages:ImageParser', "Cache refresh required (new) for: " + imagePath);
            return imageMd;
        }

        if (!fs.existsSync(imagePath)) {
            throw new GreenHatImageParserError("Oops, image file does not exist: " + imagePath);
        }

        if (ImageParser.cache != null && ImageParser.cache[cachePath]) {
            if (ImageParser.cache[cachePath] != imageMd) {
                syslog.trace('plugin:respImages:ImageParser', "Cache refresh required (md5) for: " + imagePath);
                return imageMd;
            }
        } else {
            if (md5(fs.readFileSync(cachePath)) != imageMd) {
                syslog.trace('plugin:respImages:ImageParser', "Cache refresh required (md5) for: " + imagePath);
                return imageMd;
            }
        }

        syslog.trace('plugin:respImages:ImageParser', "No cache refresh required for: " + imagePath);
        return false;
    }
}

module.exports = ImageParser;

