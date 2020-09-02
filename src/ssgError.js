/**
 * @file        Base SSG error.
 * @module      SSGError
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const GreenHatError = require("greenhat-util/error");

class SSGError extends GreenHatError {};

module.exports = SSGError;
