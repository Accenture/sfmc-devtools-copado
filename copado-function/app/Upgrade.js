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
    credentials: {
        source: {
            clientId: process.env.clientId,
            clientSecret: process.env.clientSecret,
            credentialName: process.env.credentialName,
            tenant: process.env.tenant,
        },
        target: {
            clientId: process.env.clientId,
            clientSecret: process.env.clientSecret,
            credentialName: process.env.credentialName,
            tenant: process.env.tenant,
        },
    },
    // generic
    configFilePath: '.mcdevrc.json',
    debug: process.env.debug === 'false' ? false : true,
    localDev: process.env.LOCAL_DEV === 'false' ? false : true,
    envId: null,
    enterpriseId: process.env.enterprise_id,
    mainBranch: process.env.main_branch,
    mcdev_exec: 'node ./node_modules/mcdev/lib/cli.js', // !works only after changing the working directory!
    mcdevVersion: process.env.mcdev_version,
    metadataFilePath: 'mcmetadata.json', // do not change - LWC depends on it!
    source_mid: null,
    tmpDirectory: '../tmp',
    envVariables: {
        // retrieve / commit
        source: null,
        sourceChildren: null,
        // deploy
        destination: null,
        destinationChildren: null,
    },
    // commit
    commitMessage: null,
    featureBranch: null,
    fileSelectionSalesforceId: null,
    fileSelectionFileName: null,
    // deploy
    deltaPackageLog: null,
    git_depth: null, // set a default git depth of 100 commits
    merge_strategy: null, // set default merge strategy
    sourceBranch: null, // The promotion branch of a PR
    mainBranch: null, // The target branch of a PR, like master. This commit will be lastly checked out
};

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
        Util.initProject();
    } catch (ex) {
        Log.error('initializing failed: ' + ex.message);
        throw ex;
    }
    try {
        Log.info('');
        Log.info('Running mcdev upgrade');
        Log.info('===================');
        Log.info('');
        if (!(await Upgrade.runConfigUpgrade())) {
            throw new Error('please check mcdev logs');
        }
    } catch (ex) {
        Log.error('mcdev upgrade failed:' + ex.message);
        Copado.uploadToolLogs();

        throw ex;
    }
    try {
        Log.info('');
        Log.info('Adding updated config files to git');
        Log.info('===================');
        Log.info('');
        Upgrade.gitAddConfig();
    } catch (ex) {
        Log.error('git add failed:' + ex.message);
        Copado.uploadToolLogs();
        throw ex;
    }
    try {
        Log.info('');
        Log.info('Commit and push');
        Log.info('===================');
        Log.info('');
        Upgrade.commitAndPush(CONFIG.mainBranch);
    } catch (ex) {
        Log.error('git commit / push failed:' + ex.message);
        Copado.uploadToolLogs();
        throw ex;
    }
    Log.info('');
    Log.info('Finished');
    Log.info('===================');
    Log.info('');
    Log.info('Commit.js done');

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
            console.log(Log._getFormattedDate(), msg); // eslint-disable-line no-console
        }
    }
    /**
     * @param {string} msg your log message
     * @returns {void}
     */
    static warn(msg) {
        console.log(Log._getFormattedDate(), msg); // eslint-disable-line no-console
    }
    /**
     * @param {string} msg your log message
     * @returns {void}
     */
    static info(msg) {
        console.log(Log._getFormattedDate(), msg); // eslint-disable-line no-console
    }
    /**
     * @param {string} msg your log message
     * @returns {void}
     */
    static error(msg) {
        Log.warn('❌  ' + msg);
        execSync(`copado --error-message "${msg.replace(/"/g, `\"`)}"`); // eslint-disable-line no-useless-escape
    }
    /**
     * @param {string} msg your log message
     * @returns {void}
     */
    static progress(msg) {
        Log.debug(msg);
        execSync(`copado --progress "${msg.replace(/"/g, `\"`)}"`); // eslint-disable-line no-useless-escape
    }
    /**
     * used to overcome bad timestmaps created by copado that seem to be created asynchronously
     *
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
     * Initializes MC project
     *
     * @returns {void}
     */
    static initProject() {
        const authJson = `{
     "${CONFIG.credentials.source.credentialName}": {
         "client_id": "${CONFIG.credentials.source.clientId}",
         "client_secret": "${CONFIG.credentials.source.clientSecret}",
         "auth_url": "${
             CONFIG.credentials.source.tenant.startsWith('https')
                 ? CONFIG.credentials.source.tenant
                 : `https://${CONFIG.credentials.source.tenant}.auth.marketingcloudapis.com/`
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
     * Checks out the source repository.
     * if a feature branch is available creates
     * the feature branch based on the main branch.
     *
     * @param {string} mainBranch ?
     * @param {string} featureBranch can be null/undefined
     * @returns {void}
     */
    static checkoutSrc(mainBranch, featureBranch) {
        Util.execCommand(
            'Cloning and checking out the main branch ' + mainBranch,
            ['copado-git-get "' + mainBranch + '"'],
            'Completed cloning/checking out main branch'
        );
        if (featureBranch) {
            Util.execCommand(
                'Creating resp. checking out the feature branch ' + featureBranch,
                ['copado-git-get --create "' + featureBranch + '"'],
                'Completed creating/checking out feature branch'
            );
        }
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
 * methods to handle interaction with the copado platform
 */
class Upgrade {
    /**
     * ensure project config is using most recent standards
     *
     * @returns {void} changelog JSON
     */
    static async runConfigUpgrade() {
        // * dont use CONFIG.tempDir here to allow proper resolution of required package in VSCode
        const mcdev = require('../tmp/node_modules/mcdev/lib/');
        if (!CONFIG.debug) {
            // disable any non-errors originating in mcdev from being printed into the main copado logfile
            mcdev.setLoggingLevel({ silent: true });
        }
        return mcdev.upgrade(true);
    }
    /**
     * After components have been retrieved,
     * adds selected components to the Git history.
     *
     * @returns {void}
     */
    static gitAddConfig() {
        if (CONFIG.localDev) {
            Log.debug('🔥 Skipping git action in local dev environment');
            return;
        }
        const files = [
            '.vscode/extensions.json',
            '.vscode/settings.json',
            CONFIG.configFilePath,
            '.gitignore',
            '.editorconfig',
            '.eslintignore',
            '.eslintrc',
            '.gitattributes',
            '.prettierrc',
            'README.md',
            'package.json',
        ];
        for (const file of files) {
            if (fs.existsSync(file)) {
                // Add this component to the Git index.
                Util.execCommand(null, ['git add "' + file + '"'], null);
            } else {
                Log.error('could not find ' + file);
                throw new Error('Could not find config file ' + file);
            }
        }
    }
    /**
     * Commits and pushes after adding selected components
     *
     * @param {string} mainBranch name of master branch
     * @returns {void}
     */
    static commitAndPush(mainBranch) {
        // If the following command returns some output,
        // git commit must be executed. Otherwise there
        // are no differences between the components retrieved
        // from the org and selected by the user
        // and what is already in Git, so commit and push
        // can be skipped.
        const stdout = execSync('git diff --staged --name-only');
        Log.debug('Git diff ended with the result: >' + stdout + '<');
        if (stdout && 0 < stdout.length) {
            if (CONFIG.localDev) {
                Log.debug('🔥 Skipping git action in local dev environment');
                return;
            }

            Util.execCommand(
                'Committing config',
                ['git commit -m "Upgrading project config files via `mcdev upgrade`"'],
                'Completed committing'
            );
            const ec = Util.execCommandReturnStatus(
                'Push branch ' + mainBranch,
                ['git push origin "' + mainBranch + '" --atomic'],
                'Completed pushing branch'
            );
            if (0 != ec) {
                throw (
                    'Could not push changes to feature branch ' +
                    mainBranch +
                    '. Exit code is ' +
                    ec +
                    '. Please check logs for further details.'
                );
            }
        } else {
            Log.info(
                '❌  Nothing to commit as all selected components have the same content as already exists in Git.'
            );
            Util.execCommand(
                'Nothing to Commit.',
                'copado -p "Nothing to commit" -r "Nothing to Commit as all selected components have the same content as already exists in Git."',
                'Completed committing'
            );
        }
    }
}

run(); // eslint-disable-line unicorn/prefer-top-level-await
