'use strict';

const execSync = require('node:child_process').execSync;
const CONFIG = require('./Config');

/**
 * logger class
 */
class Log {
    /**
     * @param {string} msg your log message
     * @returns {void}
     */
    static debug(msg) {
        if (CONFIG.debug) {
            console.log('DEBUG:', msg); // eslint-disable-line no-console
        }
    }
    /**
     * @param {string} msg your log message
     * @returns {void}
     */
    static warn(msg) {
        console.log('⚠', msg); // eslint-disable-line no-console
    }
    /**
     * @param {string} msg your log message
     * @returns {void}
     */
    static info(msg) {
        console.log(msg); // eslint-disable-line no-console
    }
    /**
     * update job execution / result record error fields & show progress
     *
     * @param {string} error your error details
     * @param {string} [msg] optional progress message
     * @returns {void}
     */
    static error(error, msg = 'Error') {
        console.log('❌', error); // eslint-disable-line no-console

        // running JSON.stringify escapes potentially existing double quotes in msg
        error = JSON.stringify(error);
        msg = JSON.stringify(msg);
        // note: --error-message requires --progress to be also given - they can have different values
        execSync(`copado --error-message ${error} --progress ${msg}`);
    }
    /**
     * update job execution / result record result fields & show progress
     *
     * @param {string|object} json results of your execution
     * @param {string} [msg] optional progress message
     * @returns {void}
     */
    static result(json, msg = 'Result attached') {
        if (typeof json !== 'string') {
            json = JSON.stringify(json);
        }
        console.log('✅', json); // eslint-disable-line no-console
        // running JSON.stringify escapes potentially existing double quotes in msg
        json = JSON.stringify(`${msg}: ${json}`);
        msg = JSON.stringify(msg);
        // note: --result-data requires --progress to be also given - they can have different values
        execSync(`copado --result-data ${json} --progress ${msg}`);
    }
    /**
     * @param {string} msg your log message
     * @returns {void}
     */
    static progress(msg) {
        msg = JSON.stringify(msg);
        execSync(`copado --progress ${msg}`);
    }
}

module.exports = Log;
