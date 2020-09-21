/**
 * @file        product/types/movie.
 * @module      Movie
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const ProductBase = require("./productBase");
const syslog = require("greenhat-util/syslog");
const arr = require("greenhat-util/array");
const TVSeries = require("./tvSeries");
const Duration = require("greenhat-util/duration");

/**
 * Movie.
 */
class Movie extends TVSeries
{

    /**
     * Process.
     */
    process()
    {
        super.process();

        if (this._specs.duration) {
            let dur = new Duration(this._specs.duration);
            this.duration = dur.pt;
            this._durationStr = dur.mins; 
        }
    }

    /**
     * Get the duration string.
     * 
     * @return  {string}        Minutes.
     */
    get durationStr()
    {
        return this._durationStr || null;
    }

}

module.exports = Movie
