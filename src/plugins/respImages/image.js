/**
 * @file        Srcset image plugin - image file.
 * @module      plugins/respImages
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const path = require('path');
const sizeOf = require('image-size');
const fs = require('fs');
const { syslog } = require('greenhat-base/src/logger');

/**
 * Image class.
 */
class Image 
{
    /**
     * Full path to the image.
     * @var {string}
     */
    fullPath = null;

    /**
     * Relative path.
     * @var {string}
     */
    relPath = null;

    /**
     * Cache path.
     * @var {string}
     */
    cachePath = null;

    /**
     * Width.
     * @var {number}
     */
    width = 0;

    /**
     * Height.
     * @var {number}
     */
    height = 0;

    /**
     * Is this a subimage?
     * @var {boolean}
     */
    isSubimage = false;

    /**
     * Subimages.
     * @var {object[]}
     */
    subs = null;

    /**
     * Constructor.
     * 
     * @constructor
     * @param   {string}    fullPath    Full path to the image.
     * @param   {string}    sitePath    Absolute path to site.
     * @param   {object}    opts        Options.
     * @param   {boolean}   subImage    Subimage?
     * 
     * @return  {Image}                 New instance.
     */
    constructor(fullPath, sitePath, opts, subImage = false)
    {
        this.fullPath = fullPath;
        this.isSubimage = subImage;

        // Set the relative path.
        this.relPath = fullPath.replace(sitePath, '');

        // Cache path.
        this.cachePath = path.join(sitePath, opts.cachePath, opts.cacheImages, this.relPath);

        // Dimensions?
        this.determineDimensions();
    }

    /**
     * Determine the dimensions.
     */
    determineDimensions()
    {
        let toTest = (this.isSubimage) ? this.cachePath : this.fullPath;
        if (!fs.existsSync(toTest)) {
            throw new Error("Cannot find file to get dimensions of: " + toTest);
        }
        let dims = sizeOf(toTest);
        this.width = dims.width;
        this.height = dims.height;
    }

    /**
     * Do we have subimages?
     * 
     * @return  {boolean}       True if we do.
     */
    hasSubimages()
    {
        return this.subs;
    }

    /**
     * Get the subimage map in ascending order.
     * 
     * @return {object} Sorted subimages.
     */
    get subsAsc()
    {
        return new Map([...this.subs.entries()].sort((a, b) => {return a[0] - b[0]}));
    }

    /**
     * Get the subimage map in descending order.
     * 
     * @return {object} Sorted subimages.
     */
    get subsDesc()
    {
        return new Map([...this.subs.entries()].sort((a, b) => {return b[0] - a[0]}));
    }

    /**
     * Get the smallest subimage.
     * 
     * @return {object}     Subimage.
     */
    get smallest()
    {
        return this.subsAsc.values().next().value;
    }

    /**
     * Get the biggest subimage.
     * 
     * @return {object}     SubImage
     */
    get biggest()
    {
        return this.subsDesc.values().next().value;
    }

    /**
     * Get all the URLs.
     * 
     * @return  {string[]}      Array of all URLs. 
     */
    allUrls()
    {
        let ret = [];

        if (this.subs) {
            for (let sub of this.subs.values()) {
                ret.push(sub.relPath);
            }
        } else {
            ret.push(this.relPath);
        }

        return ret;
    }

}

module.exports = Image;
