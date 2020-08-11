/**
 * @file        Article date.
 * @module      article/ArticleDate
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const dateformat = require('dateformat');

/**
 * Article date 
 */
class ArticleDate
{

    // Date properties.
    type = undefined;
    day = undefined;
    dispDate = undefined;
    dispTime = undefined;
    dispDt = undefined;
    iso = undefined;
    monthName = undefined;
    month = undefined;
    ms = undefined;
    obj = undefined;
    utc = undefined;
    year = undefined;

    /**
     * Constructor.
     * 
     * @param   {string}    raw         Raw input.
     * @param   {string}    type        Type of date.
     * @param   {string}    dispDate    Display date format.
     * @param   {string}    dispTime    Display time format.
     */
    constructor(raw, type, dispDate, dispTime)
    {
        this.type = type;

        let dobj = new Date(raw);

        this.iso = dobj.toISOString();
        this.utc = dobj.toUTCString();
        this.ms = dobj.getTime();
        this.dispDate = dateformat(dobj, dispDate);
        this.dispTime = dateformat(dobj, dispTime);
        this.dispDt = dateformat(dobj, dispDate) + ", " + dateformat(dobj, dispTime);
        this.year = dobj.getFullYear();
        this.monthName = dobj.toLocaleString('default', { month: 'long' });
        this.month = dobj.getMonth();
        this.day = dobj.getDay();
        this.obj = dobj;
    }

}

module.exports = ArticleDate;