#!/usr/bin/env node
'use strict';

const resolve = require('node:path').resolve;
const CONFIG = require('./common/Config');
const Log = require('./common/Log');
const Util = require('./common/Util');
const Copado = require('./common/Copado');

// credentials
CONFIG.credentialNameSource = process.env.credentialNameSource;
CONFIG.credentialNameTarget = null;
CONFIG.credentials = process.env.credentials;
// generic
CONFIG.configFilePath = null;
CONFIG.repoUrl = process.env.repoUrl;
CONFIG.debug = process.env.debug === 'true' ? true : false;
CONFIG.installMcdevLocally = process.env.installMcdevLocally === 'true' ? true : false;
CONFIG.mainBranch = null;
CONFIG.mcdevVersion = null;
CONFIG.metadataFilePath = null; // do not change - LWC depends on it! // not needed in this case, previous value: 'mcmetadata.json'
CONFIG.source_mid = null;
CONFIG.tmpDirectory = '../tmp';
// retrieve
CONFIG.source_sfid = null;
// commit
CONFIG.commitMessage = null;
CONFIG.featureBranch = null;
CONFIG.fileSelectionSalesforceId = null;
CONFIG.fileSelectionFileName = null;
CONFIG.recreateFeatureBranch = null;
// deploy
CONFIG.envVariables = {
    source: null,
    sourceChildren: null,
    destination: null,
    destinationChildren: null,
};
CONFIG.deltaPackageLog = null;
CONFIG.destinationBranch = null; // The target branch of a PR, like master. This commit will be lastly checked out
CONFIG.fileUpdatedSelectionSfid = null;
CONFIG.git_depth = null; // set a default git depth of 100 commits
CONFIG.merge_strategy = null; // set default merge strategy
CONFIG.promotionBranch = null; // The promotion branch of a PR
CONFIG.promotionName = null; // The promotion name of a PR
CONFIG.target_mid = null;

/**
 * main method that combines runs this function
 *
 * @returns {void}
 */
async function run() {
    Log.info('McdevInit.js started');
    Log.debug('');
    Log.debug('Parameters');
    Log.debug('===================');
    try {
        CONFIG.credentials = JSON.parse(CONFIG.credentials);
    } catch (ex) {
        Log.error('Could not parse credentials');
        throw ex;
    }
    Log.debug(CONFIG);

    // ensure we got SFMC credentials for our source BU
    if (!CONFIG.credentials[CONFIG.credentialNameSource]) {
        Log.error(`No credentials found for source (${CONFIG.credentialNameSource})`);
        throw new Error(`No credentials`);
    }
    Log.debug('Credentials found for source BU');

    Log.debug('Environment');
    Log.debug('===================');
    if (CONFIG.debug) {
        Util.execCommand(null, 'npm --version', null);
        Util.execCommand(null, 'node --version', null);
        Util.execCommand(null, 'git version', null);
    }

    Log.debug(`Change Working directory to: ${CONFIG.tmpDirectory}`);
    // prevent git errors down the road
    try {
        Util.execCommand(null, ['git config --global --add safe.directory /tmp']);
    } catch {
        try {
            Util.execCommand(null, [
                'git config --global --add safe.directory ' + resolve(CONFIG.tmpDirectory),
            ]);
        } catch {
            Log.error('Could not set tmp directoy as safe directory');
        }
    }
    // actually change working directory
    process.chdir(CONFIG.tmpDirectory);
    Log.debug(process.cwd());

    try {
        Log.info('');
        Log.info('Preparing');
        Log.info('===================');
        Log.info('');
        Util.provideMCDevTools();
        Copado.mcdevInit(CONFIG.credentials, CONFIG.credentialNameSource, CONFIG.repoUrl);
    } catch (ex) {
        Log.error('initializing failed: ' + ex.message);
        throw ex;
    }

    Log.info('');
    Log.info('===================');
    Log.info('');
    Log.info('McdevInit.js done');

    Copado.uploadToolLogs();
}

run(); // eslint-disable-line unicorn/prefer-top-level-await
