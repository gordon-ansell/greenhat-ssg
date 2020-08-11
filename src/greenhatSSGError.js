/**
 * @file        Base GreenHat SSG error.
 * @module      GreenhatSSGError
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const { GreenhatError } = require('greenhat-base');

class GreenhatSSGError extends GreenhatError {}

module.exports = GreenhatSSGError;