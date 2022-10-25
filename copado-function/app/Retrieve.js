#!/usr/bin/env node

/**
 * @typedef {object} MetadataItem
 * @property {string} n Name
 * @property {string} k Key (Customer Key / External Key)
 * @property {string} t metadata type
 * @property {string} [cd] created date
 * @property {string} [cb] created by name
 * @property {string} [ld] last modified date
 * @property {string} [lb] last modified by name
 */
/**
 * @typedef {object} EnvVar
 * @property {string} value variable value
 * @property {string} scope ?
 * @property {string} name variable name
 * @typedef {object} EnvChildVar
 * @property {EnvVar[]} environmentVariables list of environment variables
 * @property {string} environmentName name of environment in Copado
 */
/**
 * @typedef {object} CommitSelection
 * @property {string} t type
 * @property {string} n name
 * @property {string} m ???
 * @property {string} j json string with exta info
 * @property {'sfmc'} c system
 * @property {'add'} a action
 */

const fs = require('node:fs');
const execSync = require('node:child_process').execSync;
const resolve = require('node:path').resolve;

const CONFIG = {
    // credentials
    credentialNameSource: process.env.credentialNameSource,
    credentialNameTarget: null,
    credentials: JSON.parse(process.env.credentials),
    // generic
    configFilePath: '.mcdevrc.json',
    debug: process.env.debug === 'true' ? true : false,
    installMcdevLocally: process.env.installMcdevLocally === 'true' ? true : false,
    envId: process.env.envId,
    mainBranch: process.env.main_branch,
    mcdev_exec: 'node ./node_modules/mcdev/lib/cli.js', // !works only after changing the working directory!
    mcdevVersion: process.env.mcdev_version || '/usr/local/lib/node_modules/mcdev',
    metadataFilePath: 'mcmetadata.json', // do not change - LWC depends on it!
    source_mid: process.env.source_mid,
    tmpDirectory: '../tmp',
    envVariables: {
        // retrieve / commit
        source: process.env.envVariablesSource,
        sourceChildren: process.env.envVariablesSourceChildren,
        // deploy
        destination: process.env.envVariablesDestination,
        destinationChildren: process.env.envVariablesDestinationChildren,
    },
    // commit
    commitMessage: null,
    featureBranch: null,
    fileSelectionSalesforceId: null,
    fileSelectionFileName: null,
    recreateFeatureBranch: null,
    // deploy
    deltaPackageLog: null,
    git_depth: null, // set a default git depth of 100 commits
    merge_strategy: null, // set default merge strategy
    sourceBranch: null, // The promotion branch of a PR
    promotionBranch: null, // The promotion branch of a PR
    destinationBranch: null, // The target branch of a PR, like master. This commit will be lastly checked out
};

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
    Util.execCommand(null, 'npm --version', null);
    Util.execCommand(null, 'node --version', null);
    Util.execCommand(null, 'git version', null);

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

        Log.info('');
        Log.info('Initialize project');
        Log.info('===================');
        Log.info('');
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
        Log.info('Retrieve components');
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
        Retrieve.saveMetadataFile(metadataJson, CONFIG.metadataFilePath);
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
        Copado.attachJson(CONFIG.metadataFilePath);
    } catch (ex) {
        Log.error('Attaching JSON file failed:' + ex.message);
        throw ex;
    }
    Log.info('');
    Log.info('Finished');
    Log.info('===================');
    Log.info('');
    Log.info('Retrieve.js done');

    Copado.uploadToolLogs();
}

/**
 * logger class
 */
class Log {
    /**
     * constructor
     */
    constructor() {}
    /**
     * @param {string} msg your log message
     * @returns {void}
     */
    static debug(msg) {
        if (true == CONFIG.debug) {
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
        Log.debug(msg);

        msg = JSON.stringify(msg);
        execSync(`copado --progress ${msg}`);
    }
}

/**
 * helper class
 */
class Util {
    /**
     * Pushes after a successfull deployment
     *
     * @param {string} destinationBranch name of branch to push to
     * @returns {void}
     */
    static push(destinationBranch) {
        Util.execCommand(
            'Push branch ' + destinationBranch,
            ['git push origin "' + destinationBranch + '"'],
            'Completed pushing branch'
        );
    }
    /**
     * Execute command
     *
     * @param {string} [preMsg] the message displayed to the user in copado before execution
     * @param {string|string[]} command the cli command to execute synchronously
     * @param {string} [postMsg] the message displayed to the user in copado after execution
     * @returns {void}
     */
    static execCommand(preMsg, command, postMsg) {
        if (null != preMsg) {
            Log.progress(preMsg);
        }
        if (command && Array.isArray(command)) {
            command = command.join(' && ');
        }
        Log.debug('⚡ ' + command);

        try {
            execSync(command, { stdio: [0, 1, 2], stderr: 'inherit' });
        } catch (ex) {
            // do not use Log.error here to prevent our copado-function from auto-failing right here
            Log.info(ex.status + ': ' + ex.message);
            throw new Error(ex);
        }

        if (null != postMsg) {
            Log.progress('✔️  ' + postMsg);
        }
    }

    /**
     * Execute command but return the exit code
     *
     * @param {string} [preMsg] the message displayed to the user in copado before execution
     * @param {string|string[]} command the cli command to execute synchronously
     * @param {string} [postMsg] the message displayed to the user in copado after execution
     * @returns {number} exit code
     */
    static execCommandReturnStatus(preMsg, command, postMsg) {
        if (null != preMsg) {
            Log.progress(preMsg);
        }
        if (command && Array.isArray(command)) {
            command = command.join(' && ');
        }
        Log.debug('⚡ ' + command);

        let exitCode = null;
        try {
            execSync(command, { stdio: [0, 1, 2], stderr: 'inherit' });

            // Seems command finished successfully, so change exit code from null to 0
            exitCode = 0;
        } catch (ex) {
            Log.warn('❌  ' + ex.status + ': ' + ex.message);

            // The command failed, take the exit code from the error
            exitCode = ex.status;
            return exitCode;
        }

        if (null != postMsg) {
            Log.progress('✔️  ' + postMsg);
        }

        return exitCode;
    }

    /**
     * Installs MC Dev Tools and prints the version number
     * TODO: This will later be moved into an according Docker container.
     *
     * @returns {void}
     */
    static provideMCDevTools() {
        if (fs.existsSync('package.json')) {
            Log.debug('package.json found, assuming npm was already initialized');
        } else {
            Util.execCommand('Initializing npm', ['npm init -y'], 'Completed initializing NPM');
        }
        let installer;
        if (!CONFIG.installMcdevLocally) {
            Util.execCommand(
                `Initializing SFMC DevTools (packaged version)`,
                [`npm link mcdev`, 'mcdev --version'],
                'Completed installing SFMC DevTools'
            );
            return; // we're done here
        } else if (CONFIG.mcdevVersion.charAt(0) === '#') {
            // assume branch of mcdev's git repo shall be loaded

            installer = `accenture/sfmc-devtools${CONFIG.mcdevVersion}`;
        } else if (!CONFIG.mcdevVersion) {
            Log.error('Please specify mcdev_version in pipeline & environment settings');
            throw new Error('Please specify mcdev_version in pipeline & environment settings');
        } else {
            // default, install via npm at specified version
            installer = `mcdev@${CONFIG.mcdevVersion}`;
        }
        Util.execCommand(
            `Initializing SFMC DevTools (${installer})`,
            [`npm install ${installer} --foreground-scripts`, CONFIG.mcdev_exec + ' --version'],
            'Completed installing SFMC DevTools'
        );
    }
    /**
     * creates credentials file .mcdev-auth.json based on provided credentials
     *
     * @param {object} credentials contains source and target credentials
     * @returns {void}
     */
    static provideMCDevCredentials(credentials) {
        Log.progress('Provide authentication');
        fs.writeFileSync('.mcdev-auth.json', JSON.stringify(credentials));
        Log.progress('Completed providing authentication');

        // The following command fails for an unknown reason.
        // As workaround, provide directly the authentication file. This is also faster.
        // Util.execCommand("Initializing MC project with credential name " + credentialName + " for tenant " + tenant,
        //            "cd /tmp && " + mcdev + " init --y.credentialsName " + credentialName + " --y.clientId " + clientId + " --y.clientSecret " + clientSecret + " --y.tenant " + tenant + " --y.gitRemoteUrl " + remoteUrl,
        //            "Completed initializing MC project");
    }
    /**
     * helper that takes care of converting all environment variabels found in config to a proper key-based format
     *
     * @param {object} envVariables directly from config
     * @returns {void}
     */
    static convertEnvVariables(envVariables) {
        Object.keys(envVariables).map((key) => {
            if (key.endsWith('Children')) {
                envVariables[key] = Util._convertEnvChildVars(envVariables[key]);
            } else {
                envVariables[key] = Util._convertEnvVars(envVariables[key]);
            }
        });
    }
    /**
     * helper that converts the copado-internal format for "environment variables" into an object
     *
     * @param {EnvVar[]} envVarArr -
     * @returns {Object.<string,string>} proper object
     */
    static _convertEnvVars(envVarArr) {
        console.log('_convertEnvVars', envVarArr);
        if (!envVarArr) {
            return envVarArr;
        }
        if (typeof envVarArr === 'string') {
            envVarArr = JSON.parse(envVarArr);
        }
        const response = {};
        for (const item of envVarArr) {
            response[item.name] = item.value;
        }
        return response;
    }
    /**
     * helper that converts the copado-internal format for "environment variables" into an object
     *
     * @param {EnvChildVar[]} envChildVarArr -
     * @returns {Object.<string,string>} proper object
     */
    static _convertEnvChildVars(envChildVarArr) {
        console.log('_convertEnvChildVars', envChildVarArr);
        if (!envChildVarArr) {
            return envChildVarArr;
        }
        if (typeof envChildVarArr === 'string') {
            envChildVarArr = JSON.parse(envChildVarArr);
        }
        const response = {};
        for (const item of envChildVarArr) {
            response[item.environmentName] = this._convertEnvVars(item.environmentVariables);
        }
        return response;
    }
    /**
     * Determines the retrieve folder from MC Dev configuration (.mcdev.json)
     *
     * @param {string} credName -
     * @param {string} mid -
     * @returns {string} retrieve folder
     */
    static getBuName(credName, mid) {
        if (!credName) {
            throw new Error('System Property "credentialName" not set');
        }
        if (!mid) {
            throw new Error('System Property "mid" not set');
        }
        if (!fs.existsSync(CONFIG.configFilePath)) {
            throw new Error('Could not find config file ' + CONFIG.configFilePath);
        }
        const config = JSON.parse(fs.readFileSync(CONFIG.configFilePath, 'utf8'));

        if (config.credentials[credName] && config.credentials[credName].businessUnits) {
            const myBuNameArr = Object.keys(config.credentials[credName].businessUnits).filter(
                (buName) => config.credentials[credName].businessUnits[buName] == mid
            );
            if (myBuNameArr.length === 1) {
                Log.debug('BU Name is: ' + credName + '/' + myBuNameArr[0]);
                return credName + '/' + myBuNameArr[0];
            } else {
                throw new Error(`MID ${mid} not found for ${credName}`);
            }
        }
    }
}
/**
 * methods to handle interaction with the copado platform
 */
class Copado {
    /**
     * Finally, attach the resulting metadata JSON to the source environment
     *
     * @param {string} metadataFilePath where we stored the temporary json file
     * @returns {void}
     */
    static attachJson(metadataFilePath) {
        this._attachFile(metadataFilePath, CONFIG.envId, 'Attach JSON ' + metadataFilePath);
    }
    /**
     * Finally, attach the resulting metadata JSON.
     *
     * @param {string} metadataFilePath where we stored the temporary json file
     * @returns {void}
     */
    static attachLog(metadataFilePath) {
        this._attachFile(metadataFilePath, null, 'Attach Custom Log ' + metadataFilePath);
    }

    /**
     * helper that attaches files to Salesforce records
     *
     * @private
     * @param {string} localPath where we stored the temporary json file
     * @param {string} [parentId] optionally specify SFID of record to which we want to attach the file. Current Result record if omitted
     * @param {string} [preMsg] optional message to display before uploading
     * @param {string} [postMsg] optional message to display after uploading
     */
    static _attachFile(
        localPath,
        parentId,
        preMsg = 'Attaching file',
        postMsg = 'Completed attaching file'
    ) {
        if (parentId) {
            preMsg += ` to ${parentId}`;
        }
        Util.execCommand(
            preMsg,
            [`copado --uploadfile "${localPath}"` + (parentId ? ` --parentid "${parentId}"` : '')],
            postMsg
        );
    }
    /**
     * download file to CWD with the name that was stored in Salesforce
     *
     * @param {string} fileSFID salesforce ID of the file to download
     * @returns {void}
     */
    static downloadFile(fileSFID) {
        if (fileSFID) {
            Util.execCommand(
                `Download ${fileSFID}.`,
                `copado --downloadfiles "${fileSFID}"`,
                'Completed download'
            );
        } else {
            throw new Error('fileSalesforceId is not set');
        }
    }

    /**
     * downloads & parses JSON file from Salesforce
     *
     * @param {string} fileSFID salesforce ID of the file to download
     * @param {string} fileName name of the file the download will be saved as
     * @returns {CommitSelection[]} commitSelectionArr
     */
    static getJsonFile(fileSFID, fileName) {
        this.downloadFile(fileSFID);
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
            'Create / checkout branch ' + workingBranch,
            [`copado-git-get ${createBranch ? '--create ' : ''}"${workingBranch}"`],
            'Completed creating/checking out branch'
        );
    }

    /**
     * to be executed at the very end
     *
     * @returns {void}
     */
    static uploadToolLogs() {
        Log.progress('Getting mcdev logs');

        try {
            for (const file of fs.readdirSync('logs')) {
                Log.debug('- ' + file);
                Copado.attachLog('logs/' + file);
            }
            Log.progress('Attached mcdev logs');
        } catch (ex) {
            Log.info('attaching mcdev logs failed:' + ex.message);
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
     * @param {MetadataItem} obj one item
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

    /**
     * After components have been retrieved,
     * find all retrieved components and build a json containing as much
     * metadata as possible.
     *
     * @param {MetadataItem[]} metadataJson path where downloaded files are
     * @param {string} metadataFilePath filename & path to where we store the final json for copado
     * @returns {void}
     */
    static saveMetadataFile(metadataJson, metadataFilePath) {
        const metadataString = JSON.stringify(metadataJson);
        // Log.debug('Metadata JSON is: ' + metadataString);
        fs.writeFileSync(metadataFilePath, metadataString);
    }
}

run(); // eslint-disable-line unicorn/prefer-top-level-await
