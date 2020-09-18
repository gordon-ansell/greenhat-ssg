/**
 * @file        product/types/event.
 * @module      Event
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const ProductBase = require("./productBase");
const syslog = require("greenhat-util/syslog");
const arr = require("greenhat-util/array");

/**
 * Event.
 */
class Event extends ProductBase
{
    /**
     * Process.
     */
    process()
    {
        super.process();
    }

}

module.exports = Event
