/**
 * @file        Schema 'Event'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const Thing = require("./thing");

class Event extends Thing
{
    aggregateRating(val) {return this.setProp('aggregateRating', val);}
    duration(val) {return this.setProp('duration', val);}
    endDate(val) {return this.setProp('endDate', val);}
    eventAttendanceMode(val) {return this.setProp('eventAttendanceMode', val);}
    eventStatus(val) {return this.setProp('eventStatus', val);}
    location(val) {return this.setProp('location', val);}
    offers(val) {return this.setProp('offers', val);}
    organizer(val) {return this.setProp('organizer', val);}
    performer(val) {return this.setProp('performer', val);}
    review(val) {return this.setProp('review', val);}
    startDate(val) {return this.setProp('startDate', val);}
}

module.exports = Event;
