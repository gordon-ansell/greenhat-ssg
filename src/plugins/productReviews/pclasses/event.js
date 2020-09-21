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

        if (this._specs.attendanceMode) {
            this.attendanceMode = this._specs.attendanceMode;
        } else {
            this.attendanceMode = "Offline";
        }

        if (this._specs.eventStatus) {
            this.eventStatus = this._specs.eventStatus;
        } else {
            this.eventStatus = "Scheduled";
        }

    }

}

module.exports = Event
