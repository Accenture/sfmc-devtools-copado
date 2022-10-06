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

const fs = require('node:fs');
const execSync = require('node:child_process').execSync;
const resolve = require('node:path').resolve;

const CONFIG = {
    // credentials
    credentials: {
        source: {
            clientId: process.env.clientId,
            clientSecret: process.env.clientSecret,
            credentialName: process.env.credentialName,
            tenant: process.env.tenant,
            enterpriseId: process.env.enterprise_id,
        },
        target: {
            clientId: process.env.clientId,
            clientSecret: process.env.clientSecret,
            credentialName: process.env.credentialName,
            tenant: process.env.tenant,
            enterpriseId: process.env.enterprise_id,
        },
    },
    // generic
    configFilePath: '.mcdevrc.json',
    debug: process.env.debug === 'false' ? false : true,
    localDev: process.env.LOCAL_DEV === 'false' ? false : true,
    envId: process.env.envId,
    mainBranch: null,
    mcdev_exec: 'node ./node_modules/mcdev/lib/cli.js', // !works only after changing the working directory!
    mcdevVersion: process.env.mcdev_version,
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
    // deploy
    target_mid: process.env.target_mid,
    deltaPackageLog: 'docs/deltaPackage/delta_package.md', // !works only after changing the working directory!
    git_depth: 100, // set a default git depth of 100 commits
    merge_strategy: process.env.merge_strategy, // set default merge strategy
    promotionBranch: process.env.promotionBranch, // The promotion branch of a PR
    destinationBranch: process.env.toBranch, // The target branch of a PR, like master. This commit will be lastly checked out
};

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
    Util.convertEnvVariables(CONFIG.envVariables);
    Log.debug(CONFIG);

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
        // test if source branch (promotion branch) exists (otherwise this would cause an error)
        Copado.checkoutSrc(CONFIG.promotionBranch);
        // checkout destination branch
        Copado.checkoutSrc(CONFIG.destinationBranch);
    } catch (ex) {
        Log.error('Cloning failed:' + ex.message);
        throw ex;
    }

    try {
        Log.info('');
        Log.info('Merge branch');
        Log.info('===================');
        Log.info('');
        Deploy.merge(CONFIG.promotionBranch);
    } catch (ex) {
        // if confict with other deployment this would have failed
        Log.error('Merge failed: ' + ex.message);
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
        sourceBU = Util.getBuName(CONFIG.credentials.source.credentialName, CONFIG.source_mid);
        targetBU = Util.getBuName(CONFIG.credentials.target.credentialName, CONFIG.target_mid);
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
        if (true == (await Deploy.createDeltaPackage(deployFolder))) {
            Log.info('Deploy BUs');
            Log.info('===================');
            await Deploy.deployBU(targetBU);
        } else {
            throw new Error('No changes found. Nothing to deploy');
        }
    } catch (ex) {
        Log.error('Deploy failed: ' + ex.message);
        Copado.uploadToolLogs();
        throw ex;
    }

    try {
        Log.info('git-push changes');
        Log.info('===================');
        Deploy.push(CONFIG.destinationBranch);
    } catch (ex) {
        Log.info('git push failed: ' + ex.message);
        throw ex;
    }
    Log.info('');
    Log.info('Finished');
    Log.info('===================');
    Log.info('');
    Log.info('Deploy.js done');
    Log.result('Deployment completed');

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
        json = JSON.stringify(json);
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
            Log.error(ex.status + ': ' + ex.message);
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
        if (CONFIG.localDev) {
            installer = CONFIG.mcdevVersion;
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
        const authObj = {};
        for (const type of Object.keys(credentials)) {
            authObj[credentials[type].credentialName] = {
                client_id: credentials[type].clientId,
                client_secret: credentials[type].clientSecret,
                auth_url: credentials[type].tenant.startsWith('https')
                    ? credentials[type].tenant
                    : `https://${credentials[type].tenant}.auth.marketingcloudapis.com/`,
                account_id: credentials[type].enterpriseId,
            };
        }
        Log.progress('Provide authentication');
        fs.writeFileSync('.mcdev-auth.json', JSON.stringify(authObj));
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
        Util.execCommand(
            'Attach JSON ' + metadataFilePath,
            ['copado --uploadfile "' + metadataFilePath + '" --parentid "' + CONFIG.envId + '"'],
            'Completed attaching JSON'
        );
    }
    /**
     * Finally, attach the resulting metadata JSON.
     *
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
class Deploy {
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
        // remove potentially existing entries and ensure these 2 lists exist
        config.marketList = {};
        for (const listName of [deploySourceList, deployTargetList]) {
            config.marketList[listName] = {};
        }
        // add marketList entries for the 2 bu-market combos
        config.marketList[deploySourceList][sourceBU] = 'source';
        config.marketList[deployTargetList][targetBU] = 'target';
        // set up corresponding markets and remove other entries
        config.markets = {};
        config.markets['source'] = marketVariables.source;
        config.markets['target'] = marketVariables.destination;
        // TODO: deal with parent BU deployments (sourceChildren / destinationChildren)
        // TODO: deal with enterprise BU deployments (shared DEs)

        console.log(
            'config.options.deployment.sourceTargetMapping',
            config.options.deployment.sourceTargetMapping
        );
        console.log('config.markets', config.markets);
        console.log('config.marketList', JSON.stringify(config.marketList));
        // * override config in git repo
        try {
            fs.renameSync(CONFIG.configFilePath, CONFIG.configFilePath + '.BAK');
            fs.writeFileSync(CONFIG.configFilePath, JSON.stringify(config), 'utf8');
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
     * @returns {Promise.<boolean>} true: files found, false: not
     */
    static async createDeltaPackage(deployFolder) {
        const versionRange = 'HEAD^..HEAD';
        const mcdev = require('../tmp/node_modules/mcdev/lib/');
        // ensure wizard is not started
        mcdev.setSkipInteraction(true);

        Log.debug('Create delta package using version range ' + versionRange);
        const deltaPackageLog = await mcdev.createDeltaPkg({
            range: versionRange,
            skipInteraction: true,
        });
        Log.debug('deltaPackageLog: ' + JSON.stringify(deltaPackageLog));
        if (!deltaPackageLog?.length) {
            Log.error('No changes found for deployment');
            return false;
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
     * @returns {void}
     */
    static async deployBU(bu) {
        // * dont use CONFIG.tempDir here to allow proper resolution of required package in VSCode
        const mcdev = require('../tmp/node_modules/mcdev/lib/');
        // ensure wizard is not started
        mcdev.setSkipInteraction(true);
        await mcdev.deploy(bu);
        if (process.exitCode === 1) {
            throw new Error(
                'Deployment of BU ' +
                    bu +
                    ' failed. Other BUs will be deployed, but overall deployment will fail at the end.'
            );
        }
    }
    /**
     * Merge from branch into target branch
     *
     * @param {string} promotionBranch commit id to merge
     * @returns {void}
     */
    static merge(promotionBranch) {
        if (CONFIG.localDev) {
            Log.debug('🔥 Skipping git action in local dev environment');
            return;
        }
        // Merge and commit changes.
        Util.execCommand(
            'Merge commit ' + promotionBranch,
            ['git merge "' + promotionBranch + '"'],
            'Completed merging commit'
        );
    }
    /**
     * Pushes after a successfull deployment
     *
     * @param {string} destinationBranch name of branch to push to
     * @returns {void}
     */
    static push(destinationBranch) {
        if (CONFIG.localDev) {
            Log.debug('🔥 Skipping git action in local dev environment');
            return;
        }
        Util.execCommand(
            'Push branch ' + destinationBranch,
            ['git push origin "' + destinationBranch + '"'],
            'Completed pushing branch'
        );
    }
}

run(); // eslint-disable-line unicorn/prefer-top-level-await
