/**
 * @file        product/types/musicRecording.
 * @module      MusicRecording
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const ProductBase = require("./productBase");
const syslog = require("greenhat-util/syslog");
const arr = require("greenhat-util/array");

/**
 * MusicRecording.
 */
class MusicRecording extends ProductBase
{
    /**
     * Process.
     */
    process()
    {
        super.process();
    }

}

module.exports = MusicRecording
