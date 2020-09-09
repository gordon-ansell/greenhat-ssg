/**
 * @file        Schema 'Person'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const Thing = require("./thing");

class Person extends Thing
{
    address(val) {return this.setProp('address', val);}
    brand(val) {return this.setProp('brand', val);}
    email(val) {return this.setProp('email', val);}
    location(val) {return this.setProp('location', val);}
    telephone(val) {return this.setProp('telephone', val);}
}

module.exports = Person;
