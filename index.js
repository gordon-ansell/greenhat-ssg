#!/usr/bin/env node

/**
 * @file        Application bootstrap.
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license
 * 
 * Copyright (c) 2020 Gordon Ansell.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
 
'use strict';

const pkg = require('./package.json');
const { syslog } = require('greenhat-base');

try {
    // Unhandled rejections.
    process.on("unhandledRejection", (error, promise) => {
        syslog.error(`Unhandled rejection in promise: (${error.message}).`);
        syslog.inspect(error, "error", "Error object");
    });

    // Uncaught exception.
    process.on("uncaughtException", error => {
        syslog.fatal("Uncaught exception: " + error.message);
        syslog.inspect(error, "error", "Error object");
        process.exitCode = 1;
    });

    // Rejection handled.
    process.on("rejectionHandled", promise => {
        syslog.warning("A promise rejection was handled asynchronously.");
        syslog.inspect(promise, "warning", "Promise object");
    });    

    // Get the command line arguments.
    const args = require("minimist")(process.argv);

    // Set up the main class.
    const GreenhatSSG = require('./src/greenHatSSG');

    // Get cracking.
    let gh = new GreenhatSSG(args);
    return gh.init().then(function() {
        return gh.run();
    });

} catch (err) {
    syslog.fatal("GreenHatSSG fatal error: " + err.message);
    syslog.inspect(err, "fatal", "Error object");
    process.exitCode = 1;
}
