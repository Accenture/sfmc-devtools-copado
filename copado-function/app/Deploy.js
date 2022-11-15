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
 * @property {string} [u] copado__User_Story__c.Name (US-00000101) only available during Deploy
 * @property {string} t type
 * @property {string} n name
 * @property {string} m ???
 * @property {string} j json string with exta info "{\"key\":\"test-joern-filter-de\"}"
 * @property {'sfmc'} c system
 * @property {'add'} a action
 */

/**
 * TYPES DEFINED BY mcdev. copied here for easier reference
 *
 * @typedef {'accountUser'|'asset'|'attributeGroup'|'automation'|'campaign'|'contentArea'|'dataExtension'|'dataExtensionField'|'dataExtensionTemplate'|'dataExtract'|'dataExtractType'|'discovery'|'email'|'emailSendDefinition'|'eventDefinition'|'fileTransfer'|'filter'|'folder'|'ftpLocation'|'importFile'|'interaction'|'list'|'mobileCode'|'mobileKeyword'|'query'|'role'|'script'|'setDefinition'|'triggeredSendDefinition'} SupportedMetadataTypes
 * @typedef {object} DeltaPkgItem
 * //@property {string} file relative path to file
 * //@property {number} changes changed lines
 * //@property {number} insertions added lines
 * //@property {number} deletions deleted lines
 * //@property {boolean} binary is a binary file
 * //@property {boolean} moved git thinks this file was moved
 * //@property {string} [fromPath] git thinks this relative path is where the file was before
 * @property {SupportedMetadataTypes} type metadata type
 * @property {string} externalKey key
 * @property {string} name name
 * @property {'move'|'add/update'|'delete'} gitAction what git recognized as an action
 * @property {string} _credential mcdev credential name
 * @property {string} _businessUnit mcdev business unit name inside of _credential
 */

const fs = require('node:fs');
const execSync = require('node:child_process').execSync;
const exec = require('node:child_process').exec;
const resolve = require('node:path').resolve;

const CONFIG = {
    mcdevCopadoVersion: '[VI]{{inject}}[/VI]',
    // credentials
    credentialNameSource: process.env.credentialNameSource,
    credentialNameTarget: process.env.credentialNameTarget,
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
    commitMessage: null,
    featureBranch: null,
    recreateFeatureBranch: null,

    // deploy
    envVariables: {
        source: process.env.envVariablesSource,
        sourceChildren: process.env.envVariablesSourceChildren,
        destination: process.env.envVariablesDestination,
        destinationChildren: process.env.envVariablesDestinationChildren,
    },
    deltaPackageLog: 'docs/deltaPackage/delta_package.md', // !works only after changing the working directory!
    destinationBranch: process.env.toBranch, // The target branch of a PR, like master. This commit will be lastly checked out
    fileSelectionFileName: 'Copado Deploy changes', // do not change - defined by Copado Managed Package!
    fileSelectionSalesforceId: process.env.metadata_file,
    fileUpdatedSelectionSfid: null,
    git_depth: 100, // set a default git depth of 100 commits
    merge_strategy: process.env.merge_strategy, // set default merge strategy
    promotionBranch: process.env.promotionBranch, // The promotion branch of a PR
    promotionName: process.env.promotionName, // The promotion name of a PR
    target_mid: process.env.target_mid,
    sourceProperties: process.env.sourceProperties,
    deployNTimes: process.env.deployNTimes === 'true' ? true : false,
};

const Log = new (require('./common/Log'))(CONFIG);

/**
 * main method that combines runs this function
 *
 * @returns {void}
 */
async function run() {
    Log.info('Deploy.js started');
    Log.debug('');
    Log.debug('Parameters');
    Log.debug('===================');
    try {
        CONFIG.credentials = JSON.parse(CONFIG.credentials);
    } catch (ex) {
        Log.error('Could not parse credentials');
        throw ex;
    }
    try {
        CONFIG.sourceProperties = JSON.parse(CONFIG.sourceProperties);
    } catch (ex) {
        Log.error('Could not parse sourceProperties');
        throw ex;
    }
    Util.convertEnvVariables(CONFIG.envVariables);
    CONFIG.sourceProperties = Util.convertSourceProperties(CONFIG.sourceProperties);
    CONFIG.source_mid = CONFIG.sourceProperties.mid;
    CONFIG.credentialNameSource = CONFIG.sourceProperties.credential_name;
    Log.debug(CONFIG);

    // ensure we got SFMC credentials for our source BU
    if (!CONFIG.credentials[CONFIG.credentialNameSource]) {
        Log.error(`No credentials found for source (${CONFIG.credentialNameSource})`);
        throw new Error(`No source credentials`);
    }

    // ensure we got SFMC credentials for our target BU
    if (!CONFIG.credentials[CONFIG.credentialNameTarget]) {
        Log.error(`No credentials found for target (${CONFIG.credentialNameTarget})`);
        throw new Error(`No target credentials`);
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
    try {
        Log.info('');
        Log.info('Clone repository');
        Log.info('===================');
        Log.info('');
        // test if source branch (promotion branch) exists (otherwise this would cause an error)
        Copado.checkoutSrc(CONFIG.promotionBranch);
        // checkout destination branch
        Copado.checkoutSrc(CONFIG.mainBranch);
    } catch (ex) {
        Log.error('Cloning failed:' + ex.message);
        throw ex;
    }

    try {
        Log.info('');
        Log.info('Merge branch');
        Log.info('===================');
        Log.info('');
        Deploy.merge(CONFIG.promotionBranch, CONFIG.mainBranch);
    } catch (ex) {
        // if confict with other deployment this would have failed
        Log.error('Merge failed: ' + ex.message);
        throw ex;
    }

    /**
     * @type {CommitSelection[]}
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
                'Copado has not registered any files ready for deployment. Please check if you committed all files.'
            );
        }
    } catch (ex) {
        Log.error('Getting Deploy-selection file failed:' + ex.message);
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

    let deployFolder;
    try {
        Log.info('');
        Log.info('Determine deploy folder');
        Log.info('===================');
        Log.info('');
        deployFolder = Deploy.getDeployFolder();
    } catch (ex) {
        Log.error('getDeployFolder failed: ' + ex.message);
        throw ex;
    }
    let sourceBU;
    let targetBU;

    try {
        Log.info('');
        Log.info('Create delta package');
        Log.info('===================');
        Log.info('');
        sourceBU = Util.getBuName(CONFIG.credentialNameSource, CONFIG.source_mid);
        targetBU = Util.getBuName(CONFIG.credentialNameTarget, CONFIG.target_mid);
    } catch (ex) {
        Log.error('Getting Source / Target BU failed: ' + ex.message);
        throw ex;
    }
    try {
        Deploy.updateMarketLists(sourceBU, targetBU, CONFIG.envVariables);
    } catch (ex) {
        Log.error('Updateing Market List failed: ' + ex.message);
        throw ex;
    }

    try {
        if (
            await Deploy.createDeltaPackage(
                deployFolder,
                commitSelectionArr,
                sourceBU.split('/')[1]
            )
        ) {
            Log.info('Deploy BUs');
            Log.info('===================');
            const deployResult = await Deploy.deployBU(targetBU);

            // do what Deploy.createDeltaPackage did: apply templating to deploy definitions
            commitSelectionArr = Deploy.replaceMarketValues(commitSelectionArr);
            // do what Deploy.deployBU did: auto-replace asset keys if needed
            Deploy.replaceAssetKeys(targetBU, commitSelectionArr, deployResult);
        } else {
            throw new Error('No changes found. Nothing to deploy');
        }
    } catch (ex) {
        Log.error('Deploy failed: ' + ex.message);
        Copado.uploadToolLogs();
        throw ex;
    }

    // Retrieve what was deployed to target
    // and commit it to the repo as a backup
    let gitDiffArr;
    let verificationText;
    try {
        gitDiffArr = await Deploy.retrieveAndCommit(targetBU, commitSelectionArr);
    } catch (ex) {
        verificationText =
            'Failed deploy verification, check BU on SFMC to verify manually. Git not updated with the changes on target BU';
        Log.warn(verificationText + ': ' + ex.message);
        gitDiffArr = [];
    }

    // trying to push
    let success = false;
    let i = 0;
    do {
        i++;
        try {
            Log.info('git-push changes');
            Log.info('===================');
            Util.push(CONFIG.mainBranch);
            success = true;
        } catch (ex) {
            if (ex.message === `Error: Command failed: git push origin "${CONFIG.mainBranch}"`) {
                Log.progress('Merging changes from parallel deployments');
                Util.execCommand(null, ['git fetch origin "' + CONFIG.mainBranch + '"'], null);
                Util.execCommand(null, ['git reset --hard origin/' + CONFIG.mainBranch], null);
                Util.execCommand(null, ['git merge "' + CONFIG.promotionBranch + '"'], null);
            }
        }
    } while (!success && i <= 50);
    Log.info('');
    Log.info('===================');
    Log.info('');
    Log.info('Deploy.js done');
    Log.result(
        gitDiffArr,
        `Deployed ${gitDiffArr.filter((item) => item.endsWith('.json')).length} items with ${
            gitDiffArr.length
        } files` + (verificationText ? ` (${verificationText})` : '')
    );

    Copado.uploadToolLogs();
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
     * @param {object[]} properties directly from config
     * @returns {Object.<string, string>} properties converted into normal json
     */
    static convertSourceProperties(properties) {
        const response = {};
        for (const item of properties) {
            response[item.copado__API_Name__c] = item.copado__Value__c;
        }
        return response;
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
            response[item.id] = this._convertEnvVars(item.environmentVariables);
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
        let credBuName;
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
                credBuName = credName + '/' + myBuNameArr[0];
            } else {
                throw new Error(`MID ${mid} not found for ${credName}`);
            }
        }
        return credBuName;
    }
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
     * @param {CommitSelection[]} commitSelectionArr list of items to be added
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
            const jObj = JSON.parse(item.j);
            typeKeyMap[item.t].push(jObj.newKey || jObj.key);
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
                                .map((item) => {
                                    const jObj = JSON.parse(item.j);
                                    return jObj.newKey || jObj.key;
                                })
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
            Log.result(result, `Committed ${result.committed.length} items`);
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
/**
 * handles downloading metadata
 */
class Deploy {
    /**
     * retrieve the new values into the targets folder so it can be commited later.
     *
     * @param {string} targetBU buname of source BU
     * @param {CommitSelection[]} commitSelectionArr list of committed components based on user selection
     * @returns {string[]} gitDiffArr
     */
    static async retrieveAndCommit(targetBU, commitSelectionArr) {
        let gitAddArr;
        let gitDiffArr = [];
        try {
            Log.info('Switch to source branch to add updates for target');
            Copado.checkoutSrc(CONFIG.promotionBranch);
        } catch (ex) {
            Log.error('Switching failed:' + ex.message);
            throw ex;
        }

        try {
            Log.info('');
            Log.info('Retrieve components');
            Log.info('===================');
            Log.info('');
            gitAddArr = await Commit.retrieveCommitSelection(targetBU, commitSelectionArr);
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
            throw ex;
        }
        try {
            Log.info('');
            Log.info('Commit');
            Log.info('===================');
            Log.info('');

            const commitMsgLines = Deploy.getCommitMessage(targetBU, commitSelectionArr);
            // execute commit
            gitDiffArr = Deploy.commit(commitMsgLines);
        } catch (ex) {
            Log.error('git commit failed:' + ex.message);
            throw ex;
        }
        try {
            Log.info('Switch back to main branch to allow merging promotion branch into it');
            Copado.checkoutSrc(CONFIG.mainBranch);
        } catch (ex) {
            Log.error('Switching failed:' + ex.message);
            throw ex;
        }
        try {
            Log.info('Merge promotion into main branch');
            Deploy.merge(CONFIG.promotionBranch, CONFIG.mainBranch);
        } catch (ex) {
            // would fail if conflicting with other deployments
            Log.error('Merge failed: ' + ex.message);
            throw ex;
        }
        return gitDiffArr;
    }
    /**
     * Commits after adding selected components
     *
     * @param {string[]} [commitMsgLines] paragraphs of commit message
     * @returns {string[]} gitDiffArr
     */
    static commit(commitMsgLines) {
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
            if (!Array.isArray(commitMsgLines)) {
                commitMsgLines = [CONFIG.commitMessage];
            }
            const commitMsgParam = commitMsgLines.map((line) => '-m "' + line + '"').join(' ');
            Util.execCommand(
                'Committing changes',
                ['git commit -n ' + commitMsgParam],
                'Completed committing'
            );
            Log.progress('Commit of target BU files completed');
        } else {
            Log.error(
                'Nothing to commit as all selected components have the same content as already exists in Git.',
                'Nothing to commit'
            );
            throw new Error('Nothing to commit');
        }
        return gitDiffArr;
    }

    /**
     * helper for Deploy.retrieveAndCommit that creates a multi-line commit msg
     *
     * @param {string} targetBU name of BU we deployed to incl. credential name
     * @param {CommitSelection[]} commitSelectionArr list of committed components based on user selection
     * @returns {string[]} commitMsgLines
     */
    static getCommitMessage(targetBU, commitSelectionArr) {
        const userStoryNames = [
            ...new Set(commitSelectionArr.map((item) => item.u).filter(Boolean)),
        ].sort();
        const commitMsgLines = [
            CONFIG.promotionName + ': ' + userStoryNames.join(', '),
            `Updated BU "${targetBU}" (${CONFIG.target_mid})`,
        ];
        return commitMsgLines;
    }

    /**
     * convert CommitSelection[] to DeltaPkgItem[]
     *
     * @param {CommitSelection[]} commitSelectionArr list of committed components based on user selection
     * @param {string} sourceBU buname of source BU
     * @returns {DeltaPkgItem[]} format required by mcdev.createDeltaPkg
     */
    static _convertCommitToDeltaPkgItems(commitSelectionArr, sourceBU) {
        return commitSelectionArr.map(
            (item) =>
                /** @type {DeltaPkgItem} */ ({
                    type: item.t.split('-')[0],
                    name: item.n,
                    externalKey: JSON.parse(item.j).newKey || JSON.parse(item.j).key,
                    gitAction: 'add/update',
                    _credential: CONFIG.credentialNameSource,
                    _businessUnit: sourceBU,
                })
        );
    }
    /**
     * Determines the deploy folder from MC Dev configuration (.mcdev.json)
     *
     * @returns {string} deploy folder
     */
    static getDeployFolder() {
        if (!fs.existsSync(CONFIG.configFilePath)) {
            throw new Error('Could not find config file ' + CONFIG.configFilePath);
        }
        const config = JSON.parse(fs.readFileSync(CONFIG.configFilePath, 'utf8'));
        const folder = config?.directories?.deploy;
        if (!folder) {
            throw new Error('Could not find config.directories.deploy in ' + CONFIG.configFilePath);
        }

        Log.debug('Deploy folder is: ' + folder);
        return folder;
    }
    /**
     *
     * @param {string} sourceBU cred/buname of source BU
     * @param {string} targetBU cred/buname of target BU
     * @param {object} marketVariables straight from the (converted) environment variables
     * @returns {void}
     */
    static updateMarketLists(sourceBU, targetBU, marketVariables) {
        const deploySourceList = 'deployment-source';
        const deployTargetList = 'deployment-target';
        const config = JSON.parse(fs.readFileSync(CONFIG.configFilePath, 'utf8'));
        // ensure the system knows what we name our market lists for deployment
        config.options.deployment.sourceTargetMapping = {};
        config.options.deployment.sourceTargetMapping[deploySourceList] = deployTargetList;

        // set up corresponding markets and remove other entries
        config.markets = {};

        if (CONFIG.deployNTimes) {
            // add market for source child BU
            if (Object.keys(CONFIG.envVariables.sourceChildren).length !== 1) {
                throw new Error(
                    'Expected exactly one source child BU when "deployNTimes" is active in pipeline but found ' +
                        Object.keys(CONFIG.envVariables.sourceChildren).length
                );
            }
            for (const childSfid in CONFIG.envVariables.sourceChildren) {
                config.markets[childSfid] = CONFIG.envVariables.sourceChildren[childSfid];
            }
            // add markets for target child BUs
            for (const childSfid in CONFIG.envVariables.destinationChildren) {
                config.markets[childSfid] = CONFIG.envVariables.destinationChildren[childSfid];
            }
        } else {
            config.markets['source'] = marketVariables.source;
            config.markets['target'] = marketVariables.destination;
        }

        // remove potentially existing entries and ensure these 2 lists exist
        config.marketList = {};
        for (const listName of [deploySourceList, deployTargetList]) {
            config.marketList[listName] = {};
        }
        // add marketList entries for the 2 bu-market combos
        if (CONFIG.deployNTimes) {
            // add list of markets variables for the child BUs to the target BU to deploy components more than once to the same BU
            // needs to be a string, not array of string for the source BU
            config.marketList[deploySourceList][sourceBU] = Object.keys(
                CONFIG.envVariables.sourceChildren
            )[0];
            // can be array of strings or string for the target BU
            config.marketList[deployTargetList][targetBU] = Object.keys(
                CONFIG.envVariables.destinationChildren
            );
        } else {
            // standard 1:1 deployment
            config.marketList[deploySourceList][sourceBU] = 'source';
            config.marketList[deployTargetList][targetBU] = 'target';
        }

        console.log(
            'config.options.deployment.sourceTargetMapping',
            config.options.deployment.sourceTargetMapping
        );
        console.log('config.markets', config.markets);
        console.log('config.marketList', JSON.stringify(config.marketList));
        // * override config in git repo
        try {
            fs.renameSync(CONFIG.configFilePath, CONFIG.configFilePath + '.BAK');
            Util.saveJsonFile(CONFIG.configFilePath, config, 'utf8');
        } catch (ex) {
            Log.error('Updating updateMarketLists failed: ' + ex.message);
            throw ex;
        }
    }
    /**
     * Create the delta package containing the changed components
     * return whether the delta package is empty or not
     *
     * @param {string} deployFolder path
     * @param {CommitSelection[]} commitSelectionArr list of committed components based on user selection
     * @param {string} sourceBU buname of source BU
     * @returns {Promise.<boolean>} true: files found, false: not
     */
    static async createDeltaPackage(deployFolder, commitSelectionArr, sourceBU) {
        const mcdev = require('../tmp/node_modules/mcdev/lib/');
        // ensure wizard is not started
        mcdev.setSkipInteraction(true);

        const versionRange = null;
        let deltaPkgItems = null;
        if (Array.isArray(commitSelectionArr) && commitSelectionArr.length) {
            deltaPkgItems = this._convertCommitToDeltaPkgItems(commitSelectionArr, sourceBU);
            Log.info(`Found ${deltaPkgItems.length} changed components in commits`);
            Log.debug('DeltaPkgItems: ');
            Log.debug(deltaPkgItems);
        } else {
            Log.info('No changed components found in commits');
            // versionRange = 'HEAD^..HEAD';
            // Log.debug('Create delta package using version range ' + versionRange);
        }
        const deltaPackageLog = await mcdev.createDeltaPkg({
            range: versionRange,
            diffArr: deltaPkgItems,
        });
        Log.debug('deltaPackageLog: ' + JSON.stringify(deltaPackageLog));
        if (!deltaPackageLog?.length) {
            Log.error('No changes found for deployment');
            return false;
        } else {
            Log.debug('deltaPackageLog:');
            Log.debug(deltaPackageLog);
        }

        Log.debug('Completed creating delta package');
        if (fs.existsSync(CONFIG.deltaPackageLog)) {
            Copado.attachLog(CONFIG.deltaPackageLog);
        }

        if (fs.existsSync(deployFolder)) {
            const deltaPackageFiles = fs.readdirSync(deployFolder);
            if (null != deltaPackageFiles) {
                Log.debug('Found ' + deltaPackageFiles.length + ' files to deploy');
                if (0 < deltaPackageFiles.length) {
                    return true;
                }
            } else {
                Log.debug('Could not find any files to deploy in folder ' + deployFolder);
            }
        } else {
            Log.debug('Could not find deploy folder ' + deployFolder);
        }
        return false;
    }

    /**
     * Returns the to branch to use when accessing MC Dev configuration
     * The branch is the normal PR to branch, except if the PR is for a release or hotfix.
     * Release- and hotfix branches have a detailed release or hotfix number in the branch name,
     * and rather than using these detailed names the configuration used only 'release' resp. 'hotfix'.
     *
     * @param {string} branch value from copado config
     * @returns {string} configBranch value to look for in config
     */
    static _getConfigForToBranch(branch) {
        let configBranch = branch;
        if (branch.startsWith('release/')) {
            // TODO discuss with Copado!
            configBranch = 'release/*';
        } else if (branch.startsWith('hotfix/')) {
            configBranch = 'hotfix/*';
        }
        Log.debug('Config branch for branch ' + branch + ' is ' + configBranch);
        return configBranch;
    }
    /**
     * Deploys one specific BU.
     * In case of errors, the deployment is not stopped.
     *
     * @param {string} bu name of BU
     * @returns {object} deployResult
     */
    static async deployBU(bu) {
        // * dont use CONFIG.tempDir here to allow proper resolution of required package in VSCode
        const mcdev = require('../tmp/node_modules/mcdev/lib/');
        // ensure wizard is not started
        mcdev.setSkipInteraction(true);
        const deployResult = await mcdev.deploy(bu);

        if (process.exitCode === 1) {
            throw new Error(
                'Deployment of BU ' +
                    bu +
                    ' failed. Please check the SFMC DevTools logs for more details.'
            );
        }
        return deployResult;
    }
    /**
     *
     * @param {string} bu name of BU
     * @param {CommitSelection[]} commitSelectionArr list of committed components based on user selection
     * @param {object} deployResult result of deployment
     * @returns {void}
     */
    static replaceAssetKeys(bu, commitSelectionArr, deployResult) {
        const commitSelectionArrMap = [];
        for (const i in commitSelectionArr) {
            if (commitSelectionArr[i].t.split('-')[0] === 'asset') {
                const suffix = '-' + CONFIG.target_mid;
                const jObj = JSON.parse(commitSelectionArr[i].j);
                // decide what the new key is; depends on potentially applied templating
                const oldKey = jObj.newKey || jObj.key;
                const newKey =
                    CONFIG.source_mid === CONFIG.target_mid || oldKey.endsWith(suffix)
                        ? oldKey
                        : oldKey.slice(0, Math.max(0, 36 - suffix.length)) + suffix;
                if (deployResult[bu].asset[newKey]) {
                    jObj.newKey = newKey;
                    commitSelectionArr[i].j = JSON.stringify(jObj);
                    commitSelectionArrMap.push(jObj);
                } else {
                    // it didn't create the correct new Key
                    throw new Error(
                        `New key for ${commitSelectionArr[i].n} does not match any valid keys.`
                    );
                }
            }
        }

        // save files to tmp/ folder, allowing us to attach it to SF records
        Util.saveJsonFile(`Copado Deploy changes-${CONFIG.target_mid}.json`, commitSelectionArr);
        // attach to result record
        Copado.attachJson(`Copado Deploy changes-${CONFIG.target_mid}.json`, null, true);
    }
    /**
     * Merge from branch into target branch
     *
     * @param {string} promotionBranch commit id to merge
     * @param {string} currentBranch should be master in most cases
     * @returns {void}
     */
    static merge(promotionBranch, currentBranch) {
        // Merge and commit changes.
        Util.execCommand(
            `Merge ${promotionBranch} into ${currentBranch}`,
            ['git merge "' + promotionBranch + '"'],
            'Completed merging commit'
        );
    }

    /**
     * applies market values of target onto name and key of commitSelectionArr
     *
     * @param {CommitSelection[]} commitSelectionArr list of items to be added
     * @returns {void}
     */
    static replaceMarketValues(commitSelectionArr) {
        Log.debug('replacing market values');
        const commitSelectionArrNew = [];
        // prepare market values
        const replaceMapList = [];
        if (CONFIG.deployNTimes) {
            for (const sfid in CONFIG.envVariables.destinationChildren) {
                const replaceMap = {};
                const sourceSfid = Object.keys(CONFIG.envVariables.sourceChildren)[0];
                for (const item in CONFIG.envVariables.sourceChildren[sourceSfid]) {
                    if (
                        typeof CONFIG.envVariables.destinationChildren[sfid][item] !== 'undefined'
                    ) {
                        replaceMap[CONFIG.envVariables.sourceChildren[sourceSfid][item]] =
                            CONFIG.envVariables.destinationChildren[sfid][item];
                    }
                }
                replaceMapList.push(replaceMap);
            }
        } else {
            const replaceMap = {};
            for (const item in CONFIG.envVariables.source) {
                if (typeof CONFIG.envVariables.destination[item] !== 'undefined') {
                    replaceMap[CONFIG.envVariables.source[item]] =
                        CONFIG.envVariables.destination[item];
                }
            }
            replaceMapList.push(replaceMap);
        }
        for (const replaceMap of replaceMapList) {
            const commitSelectionArrClone = JSON.parse(JSON.stringify(commitSelectionArr));
            // replace market values
            for (const item of commitSelectionArrClone) {
                for (const oldValue in replaceMap) {
                    // name
                    item.n = item.n.replace(new RegExp(oldValue, 'g'), replaceMap[oldValue]);
                    // key
                    const jObj = JSON.parse(item.j);
                    jObj.newKey = (jObj.newKey || jObj.key).replace(
                        new RegExp(oldValue, 'g'),
                        replaceMap[oldValue]
                    );
                    item.j = JSON.stringify(jObj);
                }
            }
            commitSelectionArrNew.push(...commitSelectionArrClone);
        }
        return commitSelectionArrNew;
    }
}

run(); // eslint-disable-line unicorn/prefer-top-level-await
