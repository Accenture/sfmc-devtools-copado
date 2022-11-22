#!/usr/bin/env node

const resolve = require('node:path').resolve;
const CONFIG = require('./common/Config');
const Log = require('./common/Log');
const Util = require('./common/Util');
const Copado = require('./common/Copado');

// credentials
CONFIG.credentialNameSource = process.env.credentialName;
CONFIG.credentialNameTarget = null;
CONFIG.client_id = process.env.client_id;
CONFIG.client_secret = process.env.client_secret;
CONFIG.auth_url = process.env.auth_url;
CONFIG.account_id = process.env.enterprise_id;
CONFIG.credentials = `{"${CONFIG.credentialNameSource}":{"client_id":"${CONFIG.client_id}","client_secret":"${CONFIG.client_secret}","auth_url":"${CONFIG.auth_url}","account_id":"${CONFIG.account_id}"}}`;

// generic
CONFIG.configFilePath = null;
CONFIG.repoUrl = process.env.repoUrl;
CONFIG.downloadBUs = process.env.downloadBUs === 'true' ? true : false;
CONFIG.gitPush = process.env.gitPush === 'true' ? true : false;
CONFIG.debug = process.env.debug === 'true' ? true : false;
CONFIG.installMcdevLocally = process.env.installMcdevLocally === 'true' ? true : false;
CONFIG.mainBranch = null;
CONFIG.mcdevVersion = process.env.mcdev_version; // this will only be needed if installMcdevLocally=true
CONFIG.metadataFilePath = null; // do not change - LWC depends on it! // not needed in this case, previous value: 'mcmetadata.json'
CONFIG.source_mid = null;
CONFIG.tmpDirectory = '../tmp';
CONFIG.userEmail = process.env.git_email;
CONFIG.userName = process.env.git_name;

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
    // if one of the elements present in the array are undefined, this error will be triggered
    if ([CONFIG.client_id, CONFIG.client_secret, CONFIG.auth_url, CONFIG.account_id].includes()) {
        Log.error(
            `Could not find credentials: ${CONFIG.client_id}, ${CONFIG.client_secret}, ${CONFIG.auth_url}, ${CONFIG.account_id}`
        );
        throw new Error(
            `Could not find credentials: ${CONFIG.client_id}, ${CONFIG.client_secret}, ${CONFIG.auth_url}, ${CONFIG.account_id}`
        );
    }
    try {
        CONFIG.credentials = JSON.parse(CONFIG.credentials);
    } catch (ex) {
        Log.error(`Could not parse credentials: ${CONFIG.credentials}`);
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
        Util.execCommand(null, [
            'git config --global --add safe.directory ' + resolve(CONFIG.tmpDirectory),
        ]);
    } catch {
        Log.error('Could not set tmp directoy as safe directory');
    }

    // actually change working directory
    process.chdir(CONFIG.tmpDirectory);
    Log.debug(process.cwd());

    try {
        Log.info('');
        Log.info('Adding git email and name');
        Log.info('===================');
        Log.info('');
        Util.execCommand(null, [
            `git config --global user.email "${CONFIG.userEmail}"`,
            `git config --global user.name "${CONFIG.userName}"`,
        ]);
    } catch (ex) {
        Log.error('adding git email and name failed: ' + ex.message);
        throw ex;
    }
    try {
        Log.info('');
        Log.info('Preparing');
        Log.info('===================');
        Log.info('');
        Util.provideMCDevTools();
    } catch (ex) {
        Log.error('Preparing failed: ' + ex.message);
        throw ex;
    }
    try {
        Log.info('');
        Log.info('Initializing mcdev tools');
        Log.info('===================');
        Log.info('');
        Copado.mcdevInit(CONFIG.credentials, CONFIG.credentialNameSource, {
            url: CONFIG.repoUrl,
            downloadBUs: CONFIG.downloadBUs,
            gitPush: CONFIG.gitPush,
        });
    } catch (ex) {
        Log.error('Initializing failed: ' + ex.message);
        throw ex;
    }

    Log.info('');
    Log.info('===================');
    Log.info('');
    Log.info('McdevInit.js done');

    Copado.uploadToolLogs();
}

run(); // eslint-disable-line unicorn/prefer-top-level-await
