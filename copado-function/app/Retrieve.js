#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
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
    source_sfid: process.env.source_sfid,
    // commit
    commitMessage: null,
    featureBranch: null,
    fileSelectionSalesforceId: null,
    fileSelectionFileName: null,
    recreateFeatureBranch: null,
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
    Log.info('Retrieve.js started');
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
        Log.info('Clone repository');
        Log.info('===================');
        Log.info('');
        Copado.checkoutSrc(CONFIG.mainBranch);
    } catch (ex) {
        Log.error('Cloning failed:' + ex.message);
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
    let metadataJson;
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
        Log.progress('Retrieving components');
        Log.info('===================');
        Log.info('');
        metadataJson = await Retrieve.retrieveChangelog(sourceBU);
    } catch (ex) {
        Log.error('Retrieving failed: ' + ex.message);
        Copado.uploadToolLogs();
        throw ex;
    }

    try {
        Log.info('');
        Log.info('Saving metadata JSON to disk');
        Log.info('===================');
        Log.info('');
        Util.saveJsonFile(CONFIG.metadataFilePath, metadataJson);
    } catch (ex) {
        Log.error('Saving metadata JSON failed:' + ex.message);
        throw ex;
    }
    Log.result(`Found ${metadataJson.length} items on server`, 'Refresh done');
    try {
        Log.info('');
        Log.info('Attach JSON');
        Log.info('===================');
        Log.info('');
        Copado.attachJson(
            CONFIG.metadataFilePath,
            CONFIG.source_sfid,
            false,
            'Loading items into Copado'
        );
    } catch (ex) {
        Log.error('Attaching JSON file failed:' + ex.message);
        throw ex;
    }
    Log.info('');
    Log.info('===================');
    Log.info('');
    Log.info('Retrieve.js done');

    Copado.uploadToolLogs();
}

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
 * handles downloading metadata
 */
class Retrieve {
    /**
     * Determines the retrieve folder from MC Dev configuration (.mcdev.json)
     * TODO: replace by simply requiring the config file
     *
     * @returns {string} retrieve folder
     */
    static getRetrieveFolder() {
        if (!fs.existsSync(CONFIG.configFilePath)) {
            throw new Error('Could not find config file ' + CONFIG.configFilePath);
        }
        const config = JSON.parse(fs.readFileSync(CONFIG.configFilePath, 'utf8'));
        const directories = config['directories'];
        if (null == directories) {
            throw new Error('Could not find directories in ' + CONFIG.configFilePath);
        }
        const folder = directories['retrieve'];
        if (null == folder) {
            throw new Error('Could not find directories/retrieve in ' + CONFIG.configFilePath);
        }

        Log.debug('Retrieve folder is: ' + folder);
        return folder;
    }

    /**
     * Retrieve components into a clean retrieve folder.
     * The retrieve folder is deleted before retrieving to make
     * sure we have only components that really exist in the BU.
     *
     * @param {string} sourceBU specific subfolder for downloads
     * @returns {object} changelog JSON
     */
    static async retrieveChangelog(sourceBU) {
        // * dont use CONFIG.tempDir here to allow proper resolution of required package in VSCode
        const mcdev = require('../tmp/node_modules/mcdev/lib/');
        const Definition = require('../tmp/node_modules/mcdev/lib/MetadataTypeDefinitions');
        const MetadataType = require('../tmp/node_modules/mcdev/lib/MetadataTypeInfo');
        if (!CONFIG.debug) {
            // disable any non-errors originating in mcdev from being printed into the main copado logfile
            mcdev.setLoggingLevel({ silent: true });
        }
        // ensure wizard is not started
        mcdev.setSkipInteraction(true);

        const customDefinition = {
            automation: {
                keyField: 'CustomerKey',
                nameField: 'Name',
                createdDateField: 'CreatedDate',
                createdNameField: 'CreatedBy',
                lastmodDateField: 'LastSaveDate',
                lastmodNameField: 'LastSavedBy',
            },
        };
        // get userid>name mapping
        const retrieve = await mcdev.retrieve(sourceBU, ['accountUser'], null, true);
        if (!retrieve) {
            throw new Error('Could not retrieve User List');
        }
        const userList = retrieve.accountUser;
        // reduce userList to simple id-name map
        for (const key of Object.keys(userList)) {
            userList[userList[key].ID] = userList[key].Name;
            delete userList[key];
        }

        // get changed metadata
        const changelogList = await mcdev.retrieve(sourceBU, null, null, true);
        const allMetadata = [];
        Object.keys(changelogList).map((type) => {
            if (changelogList[type]) {
                const def = customDefinition[type] || Definition[type];
                allMetadata.push(
                    ...Object.keys(changelogList[type]).map((key) => {
                        const item = changelogList[type][key];
                        const salesforceRegex = new RegExp(/(_Salesforce)(_[0-9])?$/gm);
                        if (
                            MetadataType[type].isFiltered(item, true) ||
                            MetadataType[type].isFiltered(item, false)
                        ) {
                            return;
                        }
                        if (
                            type === 'dataExtension' &&
                            (this._getAttrValue(item, def.nameField).startsWith(
                                'QueryStudioResults at '
                            ) ||
                                salesforceRegex.test(this._getAttrValue(item, def.nameField)))
                        ) {
                            return;
                        }

                        const listEntry = {
                            n: this._getAttrValue(item, def.nameField),
                            k: this._getAttrValue(item, def.keyField),
                            p: this._getAttrValue(item, 'r__folder_Path'),
                            t: this._getAttrValue(item, '_subType')
                                ? type + '-' + this._getAttrValue(item, '_subType')
                                : type,
                            cd: this._convertTimestamp(
                                this._getAttrValue(item, def.createdDateField)
                            ),
                            cb: this._getUserName(userList, item, def.createdNameField),
                            ld: this._convertTimestamp(
                                // if no lastmodified date is provided, try showing the created date instead (problem on newly created automations)
                                this._getAttrValue(item, def.lastmodDateField) !==
                                    '0001-01-01T00:00:00'
                                    ? this._getAttrValue(item, def.lastmodDateField)
                                    : this._getAttrValue(item, def.createdDateField)
                            ),
                            lb: this._getUserName(userList, item, def.lastmodNameField),
                        };
                        return listEntry;
                    })
                );
            }
        });
        return allMetadata.filter((item) => undefined !== item);
    }
    /**
     * converts timestamps provided by SFMCs API into a format that SF core understands
     *
     * @private
     * @param {string} iso8601dateTime 2021-10-16T15:20:41.990
     * @returns {string} 2021-10-16T15:20:41.990-06:00
     * //@returns {string} apexDateTime 2021-10-1615:20:41
     */
    static _convertTimestamp(iso8601dateTime) {
        if (!iso8601dateTime || iso8601dateTime === '0001-01-01T00:00:00') {
            return '-';
        }
        // attach timezone unless already returned by API (asset api does return it!)
        if (iso8601dateTime.split('-').length === 3) {
            iso8601dateTime += '-06:00';
        }
        return iso8601dateTime;
    }
    /**
     *
     * @private
     * @param {Object.<string, string>} userList user-id > user-name map
     * @param {Object.<string, string>} item single metadata item
     * @param {string} fieldname name of field containing the info
     * @returns {string} username or user id or 'n/a'
     */
    static _getUserName(userList, item, fieldname) {
        return (
            userList[this._getAttrValue(item, fieldname)] ||
            this._getAttrValue(item, fieldname) ||
            'n/a'
        );
    }
    /**
     * helps get the value of complex and simple field references alike
     *
     * @private
     * @param {TYPES.MetadataItem} obj one item
     * @param {string} key field key
     * @returns {string} value of attribute
     */
    static _getAttrValue(obj, key) {
        if (!key || !obj) {
            return null;
        }
        if (key.includes('.')) {
            const keys = key.split('.');
            const first = keys.shift();
            return this._getAttrValue(obj[first], keys.join('.'));
        } else {
            return obj[key];
        }
    }
}

run(); // eslint-disable-line unicorn/prefer-top-level-await
