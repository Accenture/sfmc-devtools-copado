#!/usr/bin/env node

const fs = require('node:fs');
const execSync = require('node:child_process').execSync;
const exec = require('node:child_process').exec;
const resolve = require('node:path').resolve;
const TYPES = require('../types/mcdev-copado.d');

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

/**
 * helper class
 */

/**
 * methods to handle interaction with the copado platform
 */
class Copado {
    /**
     * Finally, attach the resulting metadata JSON to the source environment
     *
     * @param {string} localPath where we stored the temporary json file
     * @param {string} [parentSfid] record to which we attach the json. defaults to result record if not provided
     * @param {boolean} [async] optional flag to indicate if the upload should be asynchronous
     * @param {string} [preMsg] optional message to display before uploading synchronously
     * @returns {void}
     */
    static attachJson(localPath, parentSfid, async = false, preMsg) {
        this._attachFile(localPath, async, parentSfid, preMsg);
    }
    /**
     * Finally, attach the resulting metadata JSON. Always runs asynchronously
     *
     * @param {string} localPath where we stored the temporary json file
     * @returns {Promise.<void>} promise of log upload
     */
    static async attachLog(localPath) {
        this._attachFile(localPath, true);
    }

    /**
     * helper that attaches files to Salesforce records
     *
     * @private
     * @param {string} localPath where we stored the temporary json file
     * @param {boolean} [async] optional flag to indicate if the upload should be asynchronous
     * @param {string} [parentSfid] optionally specify SFID of record to which we want to attach the file. Current Result record if omitted
     * @param {string} [preMsg] optional message to display before uploading synchronously
     * @param {string} [postMsg] optional message to display after uploading synchronously
     */
    static _attachFile(
        localPath,
        async = false,
        parentSfid,
        preMsg,
        postMsg = 'Completed uploading file'
    ) {
        const command =
            `copado --uploadfile "${localPath}"` +
            (parentSfid ? ` --parentid "${parentSfid}"` : '');
        if (async) {
            Log.debug('⚡ ' + command); // also done in Util.execCommand
            try {
                exec(command);
            } catch (ex) {
                // do not use Log.error here to prevent our copado-function from auto-failing right here
                Log.info(ex.status + ': ' + ex.message);
                throw new Error(ex);
            }
        } else {
            if (!preMsg) {
                preMsg = 'Uploading file ' + localPath;
                if (parentSfid) {
                    preMsg += ` to ${parentSfid}`;
                }
            }
            Util.execCommand(preMsg, [command], postMsg);
        }
    }
    /**
     * download file to CWD with the name that was stored in Salesforce
     *
     * @param {string} fileSFID salesforce ID of the file to download
     * @param {string} [preMsg] optional message to display before uploading synchronously
     * @returns {void}
     */
    static _downloadFile(fileSFID, preMsg) {
        if (fileSFID) {
            if (!preMsg) {
                preMsg = `Download ${fileSFID}.`;
            }
            Util.execCommand(preMsg, `copado --downloadfiles "${fileSFID}"`, 'Completed download');
        } else {
            throw new Error('fileSalesforceId is not set');
        }
    }

    /**
     * downloads & parses JSON file from Salesforce
     *
     * @param {string} fileSFID salesforce ID of the file to download
     * @param {string} fileName name of the file the download will be saved as
     * @param {string} [preMsg] optional message to display before uploading synchronously
     * @returns {TYPES.CommitSelection[]} commitSelectionArr
     */
    static getJsonFile(fileSFID, fileName, preMsg) {
        this._downloadFile(fileSFID, preMsg);
        return JSON.parse(fs.readFileSync(fileName, 'utf8'));
    }

    /**
     * Executes git fetch, followed by checking out the given branch
     * newly created branches are based on the previously checked out branch!
     *
     * @param {string} workingBranch main, feature/..., promotion/...
     * @param {boolean} [createBranch=false] creates workingBranch if needed
     * @returns {void}
     */
    static checkoutSrc(workingBranch, createBranch = false) {
        Util.execCommand(
            `Switching to ${workingBranch} branch`,
            [`copado-git-get ${createBranch ? '--create ' : ''}"${workingBranch}"`],
            'Completed creating/checking out branch'
        );
    }

    /**
     * Deletes the remote feature branch
     *
     * @param {string} featureBranch branch that is going to be deleted
     * @returns {void}
     */
    static deleteBranch(featureBranch) {
        // delete feature branch on origin code in here
        Util.execCommand(
            `Deleting branch ${featureBranch} on server`,
            [`git push origin --delete ${featureBranch}`],
            'Completed deleting server branch ' + featureBranch
        );
        Util.execCommand(
            `Deleting branch ${featureBranch} locally`,
            [`git branch --delete --force ${featureBranch}`],
            'Completed deleting local branch ' + featureBranch
        );
    }

    /**
     * to be executed at the very end
     *
     * @returns {Promise.<void>} promise of uploads
     */
    static async uploadToolLogs() {
        Log.debug('Getting mcdev logs');

        try {
            const logsAttached = [];
            for (const file of fs.readdirSync('logs')) {
                Log.debug('- ' + file);
                logsAttached.push(Copado.attachLog('logs/' + file));
            }
            const response = await Promise.all(logsAttached);
            Log.debug('Attached mcdev logs');
            return response;
        } catch (ex) {
            Log.debug('attaching mcdev logs failed:' + ex.message);
        }
    }
}

/**
 * methods to handle interaction with the copado platform
 */
class Commit {
    /**
     * Retrieve components into a clean retrieve folder.
     * The retrieve folder is deleted before retrieving to make
     * sure we have only components that really exist in the BU.
     *
     * @param {string} sourceBU specific subfolder for downloads
     * @param {TYPES.CommitSelection[]} commitSelectionArr list of items to be added
     * @returns {Promise.<string[]>} list of files to git add & commit
     */
    static async retrieveCommitSelection(sourceBU, commitSelectionArr) {
        // * dont use CONFIG.tempDir here to allow proper resolution of required package in VSCode
        const mcdev = require('../tmp/node_modules/mcdev/lib/');
        // ensure wizard is not started
        mcdev.setSkipInteraction(true);

        // limit to files that git believes need to be added
        commitSelectionArr = commitSelectionArr.filter((item) => item.a === 'add');
        // get list of types with their respective keys
        const typeKeyMap = {};
        for (const item of commitSelectionArr) {
            if (!typeKeyMap[item.t]) {
                typeKeyMap[item.t] = [];
            }
            typeKeyMap[item.t].push(JSON.parse(item.j).key);
        }
        // get unique list of types that need to be retrieved
        const typeArr = [...new Set(commitSelectionArr.map((item) => item.t))];
        // download all types of which
        await mcdev.retrieve(sourceBU, typeKeyMap, null, false);
        const fileArr = (
            await Promise.all(
                typeArr.map((type) => {
                    const keyArr = [
                        ...new Set(
                            commitSelectionArr
                                .filter((item) => item.t === type)
                                .map((item) => JSON.parse(item.j).key)
                        ),
                    ];
                    return mcdev.getFilesToCommit(sourceBU, type.split('-')[0], keyArr);
                })
            )
        ).flat();
        return fileArr;
    }
    /**
     * After components have been retrieved,
     * adds selected components to the Git history.
     *
     * @param {string[]} gitAddArr list of items to be added
     * @returns {void}
     */
    static addSelectedComponents(gitAddArr) {
        // Iterate all metadata components selected by user to commit

        for (const filePath of gitAddArr) {
            if (fs.existsSync(filePath)) {
                // Add this component to the Git index.
                Util.execCommand(null, ['git add "' + filePath + '"'], 'staged ' + filePath);
            } else {
                Log.warn('❌  could not find ' + filePath);
            }
        }
    }

    /**
     * Commits after adding selected components
     *
     * @param {string[]} originalSelection list of paths that the user wanted to commit
     * @returns {void}
     */
    static commit(originalSelection) {
        // If the following command returns some output,
        // git commit must be executed. Otherwise there
        // are no differences between the components retrieved
        // from the org and selected by the user
        // and what is already in Git, so commit and push
        // can be skipped.
        const gitDiffArr = execSync('git diff --staged --name-only')
            .toString()
            .split('\n')
            .map((item) => item.trim())
            .filter((item) => !!item);
        Log.debug('Git diff ended with the result:');
        Log.debug(gitDiffArr);
        if (Array.isArray(gitDiffArr) && gitDiffArr.length) {
            Util.execCommand(
                'Committing changes to branch',
                ['git commit -n -m "' + CONFIG.commitMessage + '"'],
                'Completed committing'
            );
            const result = {
                committed: gitDiffArr,
                noChangesFound: originalSelection
                    .map((item) => item.replace(new RegExp('\\\\', 'g'), '/'))
                    .filter(
                        // ensure that "\\" in windows-paths get rewritten to forward slashes again for comparison
                        (item) => !gitDiffArr.includes(item)
                    ),
            };
            Log.result(
                result,
                `Committed ${
                    result.committed.filter((item) => item.endsWith('.json')).length
                } items with ${result.committed.length} files`
            );
        } else {
            Log.error(
                'Nothing to commit as all selected components have the same content as already exists in Git. ' +
                    JSON.stringify(originalSelection),
                'Nothing to commit'
            );
            throw new Error('Nothing to commit');
        }
    }
}

run(); // eslint-disable-line unicorn/prefer-top-level-await
