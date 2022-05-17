#!/usr/bin/env node

/**
 * @typedef {Object} MetadataItem
 * @property {string} n Name
 * @property {string} k Key (Customer Key / External Key)
 * @property {string} t metadata type
 * @property {string} [cd] created date
 * @property {string} [cb] created by name
 * @property {string} [ld] last modified date
 * @property {string} [lb] last modified by name
 *
 * @typedef {object} EnvVar
 * @property {string} value variable value
 * @property {string} scope ?
 * @property {string} name variable name
 * @typedef {object} EnvChildVar
 * @property {EnvVar[]} environmentVariables list of environment variables
 * @property {string} environmentName name of environment in Copado
 */

const fs = require('fs');
const execSync = require('child_process').execSync;

const CONFIG = {
    // generic
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    configFilePath: '.mcdevrc.json',
    credentialName: process.env.credentialName,
    debug: process.env.debug === 'false' ? false : true,
    envId: process.env.envId,
    enterpriseId: process.env.enterprise_id,
    mainBranch: process.env.main_branch,
    mcdev_exec: ['3.0.0', '3.0.1', '3.0.2', '3.0.3'].includes(process.env.mcdev_version)
        ? 'node ./node_modules/mcdev/lib/index.js' // !works only after changing the working directory!
        : 'node ./node_modules/mcdev/lib/cli.js', // !works only after changing the working directory!
    mcdevVersion: process.env.mcdev_version,
    metadataFilePath: 'mcmetadata.json', // do not change - LWC depends on it!
    tenant: process.env.tenant,
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
    // deploy
    deltaPackageLog: null,
    fromCommit: null, // The source branch of a PR, typically something like 'feature/...'
    git_depth: null, // set a default git depth of 100 commits
    merge_strategy: null, // set default merge strategy
    promotionBranch: null, // The promotion branch of a PR
    toBranch: null, // The target branch of a PR, like master. This commit will be lastly checked out
};

/**
 * main method that combines runs this function
 * @returns {void}
 */
async function run() {
    Log.info('Retrieve.js started');
    Log.debug('');
    Log.debug('Parameters');
    Log.debug('==========');
    Util.convertEnvVariables(CONFIG.envVariables);
    Log.debug(CONFIG);

    Log.debug('Environment');
    Log.debug('==========');
    Util.execCommand(null, 'npm --version', null);
    Util.execCommand(null, 'node --version', null);
    Util.execCommand(null, 'git version', null);

    Log.debug(`Change Working directory to: ${CONFIG.tmpDirectory}`);
    process.chdir(CONFIG.tmpDirectory);
    Log.debug(process.cwd());
    try {
        Log.info('');
        Log.info('Clone repository');
        Log.info('================');
        Log.info('');
        Copado.checkoutSrc(CONFIG.mainBranch);
    } catch (ex) {
        Log.error('Cloning failed:' + ex.message);
        throw ex;
    }

    try {
        Log.info('');
        Log.info('Preparing');
        Log.info('=========');
        Log.info('');
        Util.provideMCDevTools();

        Log.info('');
        Log.info('Initialize project');
        Log.info('==================');
        Log.info('');
        Util.initProject();
    } catch (ex) {
        Log.error('initializing failed:' + ex.message);
        throw ex;
    }
    let sourceBU;
    let metadataJson;
    try {
        Log.info('');
        Log.info('Get source BU');
        Log.info('=============');
        Log.info('');
        sourceBU = Retrieve.getSourceBU(CONFIG.credentialName, CONFIG.envVariables.source.mid);
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
        Log.info('Retrieving failed:' + ex.message);
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
        Log.info('Saving metadata JSON failed:' + ex.message);
        throw ex;
    }
    try {
        Log.info('');
        Log.info('Attach JSON');
        Log.info('===========');
        Log.info('');
        Copado.attachJson(CONFIG.metadataFilePath);
    } catch (ex) {
        Log.info('Attaching JSON file failed:' + ex.message);
        throw ex;
    }
    Log.info('');
    Log.info('Finished');
    Log.info('========');
    Log.info('');
    Log.info('Retrieve.js done');

    Copado.uploadToolLogs();

    // if (CONFIG.debug) {
    //     Log.error('dont finish the job during debugging');
    //     throw new Error();
    // }
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
            console.log(Log._getFormattedDate(), msg);
        }
    }
    /**
     * @param {string} msg your log message
     * @returns {void}
     */
    static warn(msg) {
        console.log(Log._getFormattedDate(), msg);
    }
    /**
     * @param {string} msg your log message
     * @returns {void}
     */
    static info(msg) {
        console.log(Log._getFormattedDate(), msg);
    }
    /**
     * @param {string} msg your log message
     * @returns {void}
     */
    static error(msg) {
        Log.warn(msg);
        execSync(`copado --error-message "${msg}"`);
    }
    /**
     * @param {string} msg your log message
     * @returns {void}
     */
    static progress(msg) {
        Log.debug(msg);
        execSync(`copado --progress "${msg}"`);
    }
    /**
     * used to overcome bad timestmaps created by copado that seem to be created asynchronously
     * @returns {string} readable timestamp
     */
    static _getFormattedDate() {
        const date = new Date();

        // let month = date.getMonth() + 1;
        // let day = date.getDate();
        let hour = date.getHours();
        let min = date.getMinutes();
        let sec = date.getSeconds();

        // month = (month < 10 ? '0' : '') + month;
        // day = (day < 10 ? '0' : '') + day;
        hour = (hour < 10 ? '0' : '') + hour;
        min = (min < 10 ? '0' : '') + min;
        sec = (sec < 10 ? '0' : '') + sec;

        // const str = `(${date.getFullYear()}-${month}-${day} ${hour}:${min}:${sec}) `;
        const str = `(${hour}:${min}:${sec}) `;

        return str;
    }
}

/**
 * helper class
 */
class Util {
    /**
     * Execute command
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
        } catch (error) {
            Log.error('❌  ' + error.status + ': ' + error.message);
            throw new Error(error);
        }

        if (null != postMsg) {
            Log.progress('✔️  ' + postMsg);
        }
    }

    /**
     * Execute command but return the exit code
     * @param {string} [preMsg] the message displayed to the user in copado before execution
     * @param {string|string[]} command the cli command to execute synchronously
     * @param {string} [postMsg] the message displayed to the user in copado after execution
     * @return {number} exit code
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
        } catch (error) {
            Log.warn('❌  ' + error.status + ': ' + error.message);

            // The command failed, take the exit code from the error
            exitCode = error.status;
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
     * @returns {void}
     */
    static provideMCDevTools() {
        if (fs.existsSync('package.json')) {
            Log.debug('package.json found, assuming npm was already initialized');
        } else {
            Util.execCommand('Initializing npm', ['npm init -y'], 'Completed initializing NPM');
        }
        let installer;
        if (process.env.LOCAL_DEV) {
            installer = CONFIG.mcdevVersion;
        } else if (CONFIG.mcdevVersion.charAt(0) === '#') {
            // assume branch of mcdev's git repo shall be loaded

            installer = `accenture/sfmc-devtools${CONFIG.mcdevVersion}`;
        } else if (!CONFIG.mcdevVersion) {
            Log.error('Please specify mcdev_version in pipeline & environment settings');
            throw new Error();
        } else {
            // default, install via npm at specified version
            installer = `mcdev@${CONFIG.mcdevVersion}`;
        }
        Util.execCommand(
            `Initializing SFMC DevTools (${installer})`,
            [
                `npm install --save ${installer} --foreground-scripts`,
                CONFIG.mcdev_exec + ' --version',
            ],
            'Completed installing SFMC DevTools'
        );
    }
    /**
     * Initializes MC project
     * @returns {void}
     */
    static initProject() {
        const authJson = ['3.0.0', '3.0.1', '3.0.2', '3.0.3', '3.1.3'].includes(CONFIG.mcdevVersion)
            ? `{
    "credentials": {
        "${CONFIG.credentialName}": {
            "clientId": "${CONFIG.clientId}",
            "clientSecret": "${CONFIG.clientSecret}",
            "tenant": "${CONFIG.tenant}",
            "eid": "${CONFIG.enterpriseId}"
        }
    }
}`
            : `{
    "${CONFIG.credentialName}": {
        "client_id": "${CONFIG.clientId}",
        "client_secret": "${CONFIG.clientSecret}",
        "auth_url": "${
            CONFIG.tenant.startsWith('https')
                ? CONFIG.tenant
                : `https://${CONFIG.tenant}.auth.marketingcloudapis.com/`
        }",
        "account_id": ${CONFIG.enterpriseId}
    }
}`;
        Log.progress('Provide authentication');
        fs.writeFileSync('.mcdev-auth.json', authJson);
        Log.progress('Completed providing authentication');
        // The following command fails for an unknown reason.
        // As workaround, provide directly the authentication file. This is also faster.
        // Util.execCommand("Initializing MC project with credential name " + credentialName + " for tenant " + tenant,
        //            "cd /tmp && " + mcdev + " init --y.credentialsName " + credentialName + " --y.clientId " + clientId + " --y.clientSecret " + clientSecret + " --y.tenant " + tenant + " --y.gitRemoteUrl " + remoteUrl,
        //            "Completed initializing MC project");
    }
    /**
     * helper that takes care of converting all environment variabels found in config to a proper key-based format
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
}

/**
 * handles downloading metadata
 */
class Retrieve {
    /**
     * Determines the retrieve folder from MC Dev configuration (.mcdev.json)
     * TODO: replace by simply requiring the config file
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
     * Determines the retrieve folder from MC Dev configuration (.mcdev.json)
     * @param {string} credName -
     * @param {string} mid -
     * @returns {string} retrieve folder
     */
    static getSourceBU(credName, mid) {
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
                Log.debug('BU Name is: ' + myBuNameArr[0]);
                return credName + '/' + myBuNameArr[0];
            } else {
                throw new Error(`MID ${mid} not found for ${credName}`);
            }
        }
    }

    /**
     * Retrieve components into a clean retrieve folder.
     * The retrieve folder is deleted before retrieving to make
     * sure we have only components that really exist in the BU.
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
        const userList = (await mcdev.retrieve(sourceBU, ['accountUser'], true)).accountUser;
        // reduce userList to simple id-name map
        Object.keys(userList).forEach((key) => {
            userList[userList[key].ID] = userList[key].Name;
            delete userList[key];
        });

        // get changed metadata
        const changelogList = await mcdev.retrieve(sourceBU, null, true);
        const allMetadata = [];
        Object.keys(changelogList).map((type) => {
            if (changelogList[type]) {
                const def = customDefinition[type] || Definition[type];
                allMetadata.push(
                    ...Object.keys(changelogList[type]).map((key) => {
                        const item = changelogList[type][key];
                        if (
                            MetadataType[type].isFiltered(item, true) ||
                            MetadataType[type].isFiltered(item, false)
                        ) {
                            return;
                        }
                        if (
                            this._getAttrValue(item, def.nameField).startsWith(
                                'QueryStudioResults at '
                            )
                        ) {
                            return;
                        }

                        const listEntry = {
                            n: this._getAttrValue(item, def.nameField),
                            k: this._getAttrValue(item, def.keyField),
                            t: type,
                            cd: this._convertTimestamp(
                                this._getAttrValue(item, def.createdDateField)
                            ),
                            cb: this._getUserName(userList, item, def.createdNameField),
                            ld: this._convertTimestamp(
                                this._getAttrValue(item, def.lastmodDateField)
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
        return iso8601dateTime + '-06:00';
        // return iso8601dateTime.replace('T', ' ').split('.')[0];
    }
    /**
     *
     * @private
     * @param {object<string,string>} userList user-id > user-name map
     * @param {object<string,string>} item single metadata item
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
     * @private
     * @param {MetadataItem} obj one item
     * @param {string} key field key
     * @returns {string} value of attribute
     */
    static _getAttrValue(obj, key) {
        if (!key) {
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

/**
 * methods to handle interaction with the copado platform
 */
class Copado {
    /**
     * Finally, attach the resulting metadata JSON to the source environment
     * @param {string} metadataFilePath where we stored the temporary json file
     * @returns {void}
     */
    static attachJson(metadataFilePath) {
        Util.execCommand(
            'Attach JSON ' + metadataFilePath,
            ['copado --uploadfile "' + metadataFilePath + '" --parentid "' + CONFIG.envId + '"'],
            'Completed attaching JSON'
        );
    }
    /**
     * Finally, attach the resulting metadata JSON.
     * @param {string} metadataFilePath where we stored the temporary json file
     * @returns {void}
     */
    static attachLog(metadataFilePath) {
        Util.execCommand(
            'Attach Custom Log ' + metadataFilePath,
            `copado --uploadfile "${metadataFilePath}"`,
            'Completed attaching JSON'
        );
    }

    /**
     * Checks out the source repository.
     * if a feature branch is available creates
     * the feature branch based on the main branch.
     * @param {string} mainBranch ?
     * @param {string} featureBranch can be null/undefined
     * @returns {void}
     */
    static checkoutSrc(mainBranch, featureBranch) {
        Util.execCommand(
            'Cloning and checking out the main branch ' + mainBranch,
            [
                'git config --global --add safe.directory /tmp',
                'copado-git-get "' + mainBranch + '"',
            ],
            'Completed cloning/checking out main branch'
        );
        if (featureBranch) {
            Util.execCommand(
                'Creating resp. checking out the feature branch ' + featureBranch,
                [
                    'git config --global --add safe.directory /tmp',
                    'copado-git-get --create "' + featureBranch + '"',
                ],
                'Completed creating/checking out feature branch'
            );
        }
    }

    /**
     * to be executed at the very end
     * @returns {void}
     */
    static uploadToolLogs() {
        Log.progress('Getting mcdev logs');

        try {
            fs.readdirSync('logs').forEach((file) => {
                Log.debug('- ' + file);
                Copado.attachLog('logs/' + file);
            });
            Log.progress('Attached mcdev logs');
        } catch (error) {
            Log.info('attaching mcdev logs failed:' + error.message);
        }
    }
}

run();
