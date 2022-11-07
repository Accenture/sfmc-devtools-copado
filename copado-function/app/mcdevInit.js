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
const exec = require('node:child_process').exec;
const resolve = require('node:path').resolve;

const CONFIG = {
    // credentials
    credentialNameSource: process.env.credentialNameSource,
    credentialNameTarget: null,
    credentials: process.env.credentials,
    // generic
    configFilePath: null,
    repoUrl: process.env.repoUrl,
    debug: process.env.debug === 'true' ? true : false,
    installMcdevLocally: process.env.installMcdevLocally === 'true' ? true : false,
    mainBranch: null,
    mcdevVersion: null,
    metadataFilePath: null, // do not change - LWC depends on it! // not needed in this case, previous value: 'mcmetadata.json'
    source_mid: null,
    tmpDirectory: '../tmp',
    // retrieve
    source_sfid: null,
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

/**
 * helper class
 */
class Util {
    /**
     * After components have been retrieved,
     * find all retrieved components and build a json containing as much
     * metadata as possible.
     *
     * @param {string} localPath filename & path to where we store the final json for copado
     * @param {object} jsObj path where downloaded files are
     * @param {boolean} [beautify] when false, json is a 1-liner; when true, proper formatting is applied
     * @returns {void}
     */
    static saveJsonFile(localPath, jsObj, beautify) {
        const jsonString = beautify ? JSON.stringify(jsObj, null, 4) : JSON.stringify(jsObj);
        fs.writeFileSync(localPath, jsonString, 'utf8');
    }
    /**
     * Pushes after a successfull deployment
     *
     * @param {string} destinationBranch name of branch to push to
     * @returns {void}
     */
    static push(destinationBranch) {
        Util.execCommand(
            `Pushing updates to ${destinationBranch} branch`,
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
            Log.debug('✔️  ' + postMsg);
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
                `Initializing Accenture SFMC DevTools (packaged version)`,
                [
                    `npm link mcdev --no-audit --no-fund --ignore-scripts --omit=dev --omit=peer --omit=optional`,
                    'mcdev --version',
                ],
                'Completed installing Accenture SFMC DevTools'
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
            `Initializing Accenture SFMC DevTools (${installer})`,
            [`npm install ${installer}`, 'node ./node_modules/mcdev/lib/cli.js --version'],
            'Completed installing Accenture SFMC DevTools'
        );
    }
    /**
     * creates credentials file .mcdev-auth.json based on provided credentials
     *
     * @param {object} credentials contains source and target credentials
     * @returns {void}
     */
    static provideMCDevCredentials(credentials) {
        Log.info('Provide authentication');
        Util.saveJsonFile('.mcdev-auth.json', credentials, true);

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
     *
     * @param {object} credentials the credentials for the salesforce marketing cloud
     * @param {string }credentialName the credential name
     * @param {string} url the git remote URL
     */
    static mcdevInit(credentials, credentialName, url) {
        Util.execCommand(
            `Initializing mcdev: ${credentialName}, ${credentials[credentialName].client_id}", "${credentials[credentialName].client_secret}", "${credentials[credentialName].auth_url}", "${url}", ${credentials[credentialName].account_id}`,
            [
                `mcdev init --y.credentialName "${credentialName}" --y.client_id "${credentials[credentialName].client_id}" --y.client_secret "${credentials[credentialName].client_secret}" --y.auth_url "${credentials[credentialName].auth_url}" --y.gitRemoteUrl "${url}" --y.account_id ${credentials[credentialName].account_id} --y.downloadBUs "false" --y.gitPush "true"`,
            ],
            'Mcdev initialized!'
        );
    }

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
     * @returns {CommitSelection[]} commitSelectionArr
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

run(); // eslint-disable-line unicorn/prefer-top-level-await
