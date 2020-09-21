/**
 * @file        product/types/tvSeries.
 * @module      TVSeries
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const ProductBase = require("./productBase");
const syslog = require("greenhat-util/syslog");
const arr = require("greenhat-util/array");

/**
 * TVSeries.
 */
class TVSeries extends ProductBase
{
    /**
     * Frig parameters as necessary.
     */
    _frigSpecs()
    {
        if (this._specs.brand && !this._specs.productionCompany) {
            this._specs.productionCompany = this._specs.brand;
        }
    }

    /**
     * Process.
     */
    process()
    {
        super.process();

        if (this._specs.productionCompany) {
            this._productionCompanyLink = this.nameUrl(this._specs.productionCompany);
        }

        if (this._specs.actors) {
            this._actorsStr = '';
            this.actor = [];
            for (let item of this._specs.actors) {
                if (!item.name) {
                    syslog.warning("Actors should have a 'name' specificaton.", this._article.relPath);
                    continue;
                }
                if (item.sameAs) {
                    let n = {name: item.name, sameAs: item.sameAs};
                    this.actor.push(n);
                    if (this._actorsStr != '') this.actorsStr += ', ';
                    this._actorsStr += this._ctx.link(item.name, item.sameAs);
                } else {
                    let n = {name: item.name};
                    this.actor.push(n);
                    if (this._actorsStr != '') this.actorsStr += ', ';
                    this._actorsStr += item.name;
                }
            }
        }

        if (this._specs.directors) {
            this._directorsStr = '';
            this.director = [];
            for (let item of this._specs.directors) {
                if (!item.name) {
                    syslog.warning("Directors should have a 'name' specificaton.", this._article.relPath);
                    continue;
                }
                if (item.sameAs) {
                    let n = {name: item.name, sameAs: item.sameAs};
                    this.director.push(n);
                    if (this._directorsStr != '') this.directorStr += ', ';
                    this._directorsStr += this._ctx.link(item.name, item.sameAs);
                } else {
                    let n = {name: item.name};
                    this.director.push(n);
                    if (this._directorsStr != '') this.directorStr += ', ';
                    this._directorStr += item.name;
                }
            }
        }
    }

    /**
     * Get the productionCompany link.
     * 
     * @return  {string}        Production company link.
     */
    get productionCompanyLink()
    {
        return this._productionCompanyLink || null;
    }

    /**
     * Get the actors string.
     * 
     * @return  {string}        Actors.
     */
    get actorsStr()
    {
        return this._actorsStr || null;
    }

    /**
     * Get the directors string.
     * 
     * @return  {string}        Directors.
     */
    get directorsStr()
    {
        return this._directorsStr || null;
    }
}

module.exports = TVSeries
