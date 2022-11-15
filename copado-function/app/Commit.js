#!/usr/bin/env node

const resolve = require('node:path').resolve;
const TYPES = require('./types/mcdev-copado.d');

const CONFIG = {
    mcdevCopadoVersion: '[VI]{{inject}}[/VI]',
    // credentials
    credentialNameSource: process.env.credentialNameSource,
    credentialNameTarget: null,
    credentials: process.env.credentials,
    // generic
    configFilePath: '.mcdevrc.json',
    debug: process.env.debug === 'true' ? true : false,
    installMcdevLocally: process.env.installMcdevLocally === 'true' ? true : false,
    mainBranch: process.env.main_branch,
    mcdevVersion: process.env.mcdev_version,
    metadataFilePath: 'mcmetadata.json', // do not change - LWC depends on it!
    source_mid: process.env.source_mid,
    tmpDirectory: '../tmp',
    // retrieve
    source_sfid: null,
    // commit
    commitMessage: process.env.commit_message,
    featureBranch: process.env.feature_branch,
    fileSelectionSalesforceId: process.env.metadata_file,
    fileSelectionFileName: 'Copado Commit changes', // do not change - defined by Copado Managed Package!
    recreateFeatureBranch: process.env.recreateFeatureBranch === 'true' ? true : false,
    // deploy
    envVariables: {
        source: null,
        sourceChildren: null,
        destination: null,
        destinationChildren: null,
    },
    deltaPackageLog: null,
    destinationBranch: null, // The target branch of a PR, like master. This commit will be lastly checked out
    fileUpdatedSelectionSfid: null,
    git_depth: null, // set a default git depth of 100 commits
    merge_strategy: null, // set default merge strategy
    promotionBranch: null, // The promotion branch of a PR
    promotionName: null, // The promotion name of a PR
    target_mid: null,
};

const Log = new (require('./common/Log'))(CONFIG);
const Util = new (require('./common/Util'))(CONFIG);
const Copado = new (require('./common/Copado'))(CONFIG);
const Commit = new (require('./common/Commit'))(CONFIG);

/**
 * main method that combines runs this function
 *
 * @returns {void}
 */
async function run() {
    Log.info('Commit.js started');
    Log.debug('');
    Log.debug('Parameters');
    Log.debug('===================');
    try {
        CONFIG.credentials = JSON.parse(CONFIG.credentials);
    } catch (ex) {
        Log.error('Could not parse credentials');
        throw ex;
    }
    Util.convertEnvVariables(CONFIG.envVariables);
    Log.debug(CONFIG);

    // ensure we got SFMC credentials for our source BU
    if (!CONFIG.credentials[CONFIG.credentialNameSource]) {
        Log.error(`No credentials found for source (${CONFIG.credentialNameSource})`);
        throw new Error(`No source credentials`);
    }

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

    Log.info('');
    Log.info('Clone repository');
    Log.info('===================');
    Log.info('');

    try {
        Copado.checkoutSrc(CONFIG.mainBranch);

        try {
            if (CONFIG.recreateFeatureBranch) {
                Copado.deleteBranch(CONFIG.featureBranch);
            }
        } catch (ex) {
            Log.warn('Delete feature branch failed:' + ex.message);
        }

        Copado.checkoutSrc(CONFIG.featureBranch, true);
    } catch (ex) {
        Log.error('Checkout to feature and/or master branch failed:' + ex.message);
        throw ex;
    }
    /**
     * @type {TYPES.CommitSelection[]}
     */
    let commitSelectionArr;
    try {
        Log.info('');
        Log.info(
            `Add selected components defined in ${CONFIG.fileSelectionSalesforceId} to metadata JSON`
        );
        Log.info('===================');
        Log.info('');
        commitSelectionArr = Copado.getJsonFile(
            CONFIG.fileSelectionSalesforceId,
            CONFIG.fileSelectionFileName,
            'Retrieving list of selected items'
        );
        if (!Array.isArray(commitSelectionArr) || commitSelectionArr.length === 0) {
            throw new Error(
                'Copado has not registered any files selected for commit. Please go back and select at least one item in the Commit page.'
            );
        }
    } catch (ex) {
        Log.error('Getting Commit-selection file failed:' + ex.message);
        throw ex;
    }

    try {
        Log.info('');
        Log.info('Preparing');
        Log.info('===================');
        Log.info('');
        Util.provideMCDevTools();
        Util.provideMCDevCredentials(CONFIG.credentials);
    } catch (ex) {
        Log.error('initializing failed: ' + ex.message);
        throw ex;
    }

    let sourceBU;
    let gitAddArr;
    try {
        Log.info('');
        Log.info('Get source BU');
        Log.info('===================');
        Log.info('');
        sourceBU = Util.getBuName(CONFIG.credentialNameSource, CONFIG.source_mid);
    } catch (ex) {
        Log.error('Getting Source BU failed: ' + ex.message);
        throw ex;
    }

    try {
        Log.info('');
        Log.info('Retrieve components');
        Log.info('===================');
        Log.info('');
        gitAddArr = await Commit.retrieveCommitSelection(sourceBU, commitSelectionArr);
    } catch (ex) {
        Log.error('Retrieving failed: ' + ex.message);
        Copado.uploadToolLogs();
        throw ex;
    }

    try {
        Log.info('');
        Log.info('Add components in metadata JSON to Git history');
        Log.info('===================');
        Log.info('');
        Commit.addSelectedComponents(gitAddArr);
    } catch (ex) {
        Log.error('git add failed:' + ex.message);
        Copado.uploadToolLogs();
        throw ex;
    }
    try {
        Log.info('');
        Log.info('Commit');
        Log.info('===================');
        Log.info('');
        Commit.commit(gitAddArr);
        Log.info('Push');
        Log.info('===================');
        Util.push(CONFIG.featureBranch);
    } catch (ex) {
        Log.error('git commit / push failed:' + ex.message);
        Copado.uploadToolLogs();
        throw ex;
    }
    Log.info('');
    Log.info('===================');
    Log.info('');
    Log.info('Commit.js done');

    Copado.uploadToolLogs();
}

run(); // eslint-disable-line unicorn/prefer-top-level-await
