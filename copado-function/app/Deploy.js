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
    deltaPackageLog: 'docs/deltaPackage/delta_package.md', // !works only after changing the working directory!
    fromCommit: 'promotion/' + process.env.promotion, // The source branch of a PR, typically something like 'feature/...'
    git_depth: 100, // set a default git depth of 100 commits
    merge_strategy: process.env.merge_strategy, // set default merge strategy
    promotionBranch: process.env.promotionBranch, // The promotion branch of a PR
    toBranch: process.env.toBranch, // The target branch of a PR, like master. This commit will be lastly checked out
};

/**
 * main method that combines runs this function
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
    process.chdir(CONFIG.tmpDirectory);
    Log.debug(process.cwd());
    try {
        Log.info('');
        Log.info('Clone repository');
        Log.info('===================');
        Log.info('');
        Deploy.checkoutSrcDeploy(CONFIG.fromCommit, CONFIG.toBranch);
    } catch (ex) {
        Log.error('Cloning failed:' + ex.message);
        throw ex;
    }

    try {
        Log.info('');
        Log.info('Merge branch');
        Log.info('===================');
        Log.info('');
        Deploy.merge(CONFIG.fromCommit);
    } catch (ex) {
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
        Util.initProject();
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

    try {
        Log.info('');
        Log.info('Create delta package');
        Log.info('===================');
        Log.info('');
        if (true == Deploy.createDeltaPackage(deployFolder)) {
            const bus = Deploy.getDeployTargetBUs();

            Log.info('Deploy BUs');
            Log.info('===================');
            let exitCode = 0;
            bus.forEach((bu) => {
                const ec = Deploy.deployBU(bu);
                if (0 != ec) {
                    if (0 == exitCode) {
                        exitCode = ec;
                    }
                }
            });
            if (0 != exitCode) {
                throw new Error(
                    'Deployment of at least one BU failed. See previous output for details'
                );
            }
        }
    } catch (ex) {
        Copado.uploadToolLogs();
        Log.error('Deploy failed: ' + ex.message);
        throw ex;
    }

    try {
        Log.info('git-push changes');
        Log.info('===================');
        Deploy.push(CONFIG.toBranch);
    } catch (ex) {
        Log.info('git push failed: ' + ex.message);
        throw ex;
    }

    try {
        Log.info('Merge into promotion branch');
        Log.info('===================');
        Log.info('');
        Deploy.promote(CONFIG.toBranch, CONFIG.promotionBranch);
    } catch (ex) {
        Log.info('promote failed: ' + ex.message);
        throw ex;
    }

    Log.info('');
    Log.info('Finished');
    Log.info('===================');
    Log.info('');
    Log.info('Deploy.js done');

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
        Log.warn('❌  ' + msg);
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
            Log.error(error.status + ': ' + error.message);
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
class Deploy {
    /**
     * Determines the deploy folder from MC Dev configuration (.mcdev.json)
     * @returns {string} deploy folder
     */
    static getDeployFolder() {
        if (!fs.existsSync(CONFIG.configFilePath)) {
            throw new Error('Could not find config file ' + CONFIG.configFilePath);
        }
        const config = JSON.parse(fs.readFileSync(CONFIG.configFilePath, 'utf8'));
        const directories = config['directories'];
        if (null == directories) {
            throw new Error('Could not find directories in ' + CONFIG.configFilePath);
        }
        const folder = directories['deploy'];
        if (null == folder) {
            throw new Error('Could not find directories/deploy in ' + CONFIG.configFilePath);
        }

        Log.debug('Deploy folder is: ' + folder);
        return folder;
    }

    /**
     * Create the delta package containing the changed components
     * return whether the delta package is empty or not
     * @param {string} deployFolder path
     * @returns {boolean} true: files found, false: not
     */
    static createDeltaPackage(deployFolder) {
        const versionRange = 'HEAD^..HEAD';
        Util.execCommand(
            'Create delta package using version range ' + versionRange,
            [CONFIG.mcdev_exec + ' createDeltaPkg ' + versionRange + ' --skipInteraction'],
            'Completed creating delta package'
        );
        if (fs.existsSync(CONFIG.deltaPackageLog)) {
            Util.execCommand(
                'Upload delta package results file',
                'copado --uploadfile ' + CONFIG.deltaPackageLog,
                'Completed uploading delta package results file'
            );
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
     * @param {string} branch value from copado config
     * @returns {string} toBranch value to look for in config
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
     * Determines the list of BUs from MC Dev configuration (.mcdev.json)
     * to which changes should be deployed.
     * @returns {string[]} List of BUs
     */
    static getDeployTargetBUs() {
        if (!fs.existsSync(CONFIG.configFilePath)) {
            throw new Error('Could not find config file ' + CONFIG.configFilePath);
        }
        const config = JSON.parse(fs.readFileSync(CONFIG.configFilePath, 'utf8'));
        const configToBranch = Deploy._getConfigForToBranch(CONFIG.toBranch);
        const options = config['options'];
        if (null == options) {
            throw new Error('Could not find options in ' + CONFIG.configFilePath);
        }
        const deployment = options['deployment'];
        if (null == deployment) {
            throw new Error('Could not find options/deployment in ' + CONFIG.configFilePath);
        }
        const targetBranchBuMapping = deployment['targetBranchBuMapping'];
        if (null == targetBranchBuMapping) {
            throw new Error(
                'Could not find options/deployment/targetBranchBuMapping in ' +
                    CONFIG.configFilePath
            );
        }
        let bus = targetBranchBuMapping[configToBranch];
        if (null == bus) {
            throw new Error(
                'Could not find config branch ' +
                    configToBranch +
                    ' in options/deployment/targetBranchBuMapping in ' +
                    CONFIG.configFilePath
            );
        }
        if (bus instanceof String) {
            bus = [bus];
        }
        Log.debug('BUs to deploy for config branch ' + configToBranch + ' are: ' + bus.join());
        return bus;
    }

    /**
     * Deploys one specific BU.
     * In case of errors, the deployment is not stopped.
     * @param {string} bu name of BU
     * @returns {number} exit code of the deployment
     */
    static deployBU(bu) {
        const ec = Util.execCommandReturnStatus(
            'Deploy BU ' + bu,
            [CONFIG.mcdev_exec + ' deploy ' + bu],
            'Completed deploying BU'
        );
        if (0 != ec) {
            Log.warn(
                'Deployment of BU ' +
                    bu +
                    ' failed with exit code ' +
                    ec +
                    '. Other BUs will be deployed, but overall deployment will fail at the end.'
            );
            // logError("Deployment of BU " + bu + " failed with exit code " + ec + ". Other BUs will be deployed, but overall deployment will fail at the end.");
            // Log.info("Deployment of BU " + bu + " failed with exit code " + ec + ". Other BUs will be deployed, but overall deployment will fail at the end.");
            // console.log("Deployment of BU " + bu + " failed with exit code " + ec + ". Other BUs will be deployed, but overall deployment will fail at the end.");
        }

        return ec;
    }
    /**
     * Merge from branch into target branch
     * @param {string} fromCommit commit id to merge
     * @returns {void}
     */
    static merge(fromCommit) {
        // Merge and commit changes.
        Util.execCommand(
            'Merge commit ' + fromCommit,
            ['git merge "' + fromCommit + '"'],
            'Completed merging commit'
        );
    }
    /**
     * Pushes after a successfull deployment
     * @param {string} toBranch name of branch to push to
     * @returns {void}
     */
    static push(toBranch) {
        Util.execCommand(
            'Push branch ' + toBranch,
            ['git push origin "' + toBranch + '"'],
            'Completed pushing branch'
        );
    }

    /**
     * Promote changes by merging into the promotion branch
     * @param {string} toBranch branch to merge into
     * @param {string} promotionBranch target branch to merge into
     * @returns {void}
     */
    static promote(toBranch) {
        // Util.execCommand("Checking out the branch " + toBranch,
        //            "cd /tmp && copado-git-get --depth " + git_depth + ' ' + toBranch,
        //            "Completed cloning branch");
        Util.execCommand(
            'Checking out the branch ' + CONFIG.promotionBranch,
            ['copado-git-get --depth ' + CONFIG.git_depth + ' ' + CONFIG.promotionBranch],
            'Completed cloning branch'
        );
        const mergeOption = CONFIG.merge_strategy ? '-X ' + CONFIG.merge_strategy + ' ' : '';
        Util.execCommand(
            'Merge commit ' + toBranch,
            ['git merge ' + mergeOption + '-m "Auto merge ' + toBranch + '" "' + toBranch + '"'],
            'Completed merging'
        );

        Util.execCommand(
            'Push branch ' + CONFIG.promotionBranch,
            ['git push origin "' + CONFIG.promotionBranch + '"'],
            'Completed pushing branch'
        );
    }
    /**
     * Checks out the source repository and branch
     * @param {string} fromCommit commit id to merge
     * @param {string} toBranch branch name to merge into
     * @returns {void}
     */
    static checkoutSrcDeploy(fromCommit, toBranch) {
        // First make sure that the from branch is available
        Util.execCommand(
            'Cloning resp. checking out the repository commit/branch ' + fromCommit,
            ['copado-git-get -d . ' + fromCommit],
            'Completed cloning commit/branch'
        );

        // Now checkout the target branch.
        // That branch/commit that contains changed files should be checked out.
        // When working with PRs, this is the target branch, after the source branch
        // has been merged into this branch. So basically the version range to deploy
        // is HEAD^..HEAD.
        Util.execCommand(
            'Cloning resp. checking out the repository branch ' + toBranch,
            ['copado-git-get -d . ' + toBranch],
            'Completed cloning branch'
        );
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
