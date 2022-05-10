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
    // commit
    commitMessage: process.env.commit_message,
    featureBranch: process.env.feature_branch,
    fileSelectionSalesforceId: process.env.metadata_file,
    fileSelectionFileName: 'Copado Commit changes.json', // do not change - LWC depends on it!
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
    Log.info('Commit.js started');
    Log.debug('');
    Log.debug('Parameters');
    Log.debug('==========');
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
        Copado.checkoutSrc(CONFIG.mainBranch, CONFIG.featureBranch);
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

    /**
     * @type CommitSelection[]
     */
    let commitSelectionArr;
    try {
        if (CONFIG.fileSelectionSalesforceId) {
            Log.info('');
            Log.info(
                `Add selected components defined in ${CONFIG.fileSelectionSalesforceId} to metadata JSON`
            );
            Log.info('====================================================================');
            Log.info('');

            Util.execCommand(
                `Download ${CONFIG.fileSelectionSalesforceId}.`,
                `copado --downloadfiles "${CONFIG.fileSelectionSalesforceId}"`,
                'Completed download'
            );

            commitSelectionArr = JSON.parse(fs.readFileSync(CONFIG.fileSelectionFileName, 'utf8'));
        }
    } catch (ex) {
        Log.info('Getting Commit-selection file failed:' + ex.message);
        throw ex;
    }

    let retrieveFolder;
    let sourceBU;
    try {
        Log.info('');
        Log.info('Determine retrieve folder');
        Log.info('=========================');
        Log.info('');
        retrieveFolder = Retrieve.getRetrieveFolder();

        Log.info('');
        Log.info('Get source BU');
        Log.info('=============');
        Log.info('');
        sourceBU = Retrieve.getSourceBU();

        Log.info('');
        Log.info('Retrieve components');
        Log.info('===================');
        Log.info('');
        await Retrieve.retrieveCommitSelection(sourceBU, commitSelectionArr);
    } catch (ex) {
        Log.info('Retrieving failed:' + ex.message);
        Copado.uploadToolLogs();
        throw ex;
    }

    try {
        Log.info('');
        Log.info('Add components in metadata JSON to Git history');
        Log.info('==============================================');
        Log.info('');
        Commit.addSelectedComponents(retrieveFolder, sourceBU, commitSelectionArr);
    } catch (ex) {
        Log.info('git add failed:' + ex.message);
        throw ex;
    }
    try {
        Log.info('');
        Log.info('Commit and push');
        Log.info('===============');
        Log.info('');
        Commit.commitAndPush(CONFIG.mainBranch, CONFIG.featureBranch);
    } catch (ex) {
        Log.info('git commit / push failed:' + ex.message);
        throw ex;
    }
    Log.info('');
    Log.info('Finished');
    Log.info('========');
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
        Log.debug(command);

        try {
            execSync(command, { stdio: [0, 1, 2], stderr: 'inherit' });
        } catch (error) {
            Log.error(error.status + ': ' + error.message);
            throw new Error(error);
        }

        if (null != postMsg) {
            Log.progress(postMsg);
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
        Log.debug(command);

        let exitCode = null;
        try {
            execSync(command, { stdio: [0, 1, 2], stderr: 'inherit' });

            // Seems command finished successfully, so change exit code from null to 0
            exitCode = 0;
        } catch (error) {
            Log.warn(error.status + ': ' + error.message);

            // The command failed, take the exit code from the error
            exitCode = error.status;
        }

        if (null != postMsg) {
            Log.progress(postMsg);
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
            'Completed installing MC Dev Tools'
        );
    }

    /**
     * Initializes MC project
     * @returns {void}
     */
    static initProject() {
        const authJson = `{
            "credentials": {
                "${CONFIG.credentialName}": {
                    "clientId": "${CONFIG.clientId}",
                    "clientSecret": "${CONFIG.clientSecret}",
                    "tenant": "${CONFIG.tenant}",
                    "eid": "${CONFIG.enterpriseId}"
                }
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
     * Determines the BU from MC Dev configuration (.mcdev.json)
     * from which to retrieve components.
     * TODO: replace by simply requiring the config file
     * @returns {string} BU
     */
    static getSourceBU() {
        if (!fs.existsSync(CONFIG.configFilePath)) {
            throw new Error('Could not find config file ' + CONFIG.configFilePath);
        }
        const config = JSON.parse(fs.readFileSync(CONFIG.configFilePath, 'utf8'));
        const options = config['options'];
        if (null == options) {
            throw new Error('Could not find options in ' + CONFIG.configFilePath);
        }
        const deployment = options['deployment'];
        if (null == deployment) {
            throw new Error('Could not find options/deployment in ' + CONFIG.configFilePath);
        }
        const sourceTargetMapping = deployment['sourceTargetMapping'];
        if (null == sourceTargetMapping) {
            throw new Error(
                'Could not find options/deployment/sourceTargetMapping in ' + CONFIG.configFilePath
            );
        }
        const sourceTargetMappingKeys = Object.keys(sourceTargetMapping);
        if (null == sourceTargetMappingKeys || 1 != sourceTargetMappingKeys.length) {
            throw new Error(
                'Got unexpected number of keys in options/deployment/sourceTargetMapping in ' +
                    CONFIG.configFilePath +
                    '. Expected is only one entry'
            );
        }

        const marketList = config['marketList'];
        if (null == marketList) {
            throw new Error('Could not find marketList in ' + CONFIG.configFilePath);
        }
        const deploymentSource = marketList[sourceTargetMappingKeys[0]];
        if (null == deploymentSource) {
            throw new Error(
                'Could not find marketList/ ' +
                    deploymentSourceKeys[0] +
                    ' in ' +
                    CONFIG.configFilePath
            );
        }
        const deploymentSourceKeys = Object.keys(deploymentSource);
        if (
            null == deploymentSourceKeys ||
            (1 != deploymentSourceKeys.length && 2 != deploymentSourceKeys.length)
        ) {
            throw new Error(
                'Got unexpected number of keys in marketList/' +
                    deploymentSource +
                    ' in ' +
                    CONFIG.configFilePath +
                    '. Expected is one entry, or two in case there is a description entry.'
            );
        }
        let sourceBU = null;
        if ('description' != deploymentSourceKeys[0]) {
            sourceBU = deploymentSourceKeys[0];
        } else {
            sourceBU = deploymentSourceKeys[1];
        }

        Log.debug('BU to retrieve is: ' + sourceBU);
        return sourceBU;
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

                        const listEntry = {
                            n: Retrieve._getAttrValue(item, def.nameField),
                            k: Retrieve._getAttrValue(item, def.keyField),
                            t: type,
                            cd: Retrieve._getAttrValue(item, def.createdDateField),
                            cb: Retrieve._getUserName(userList, item, def.createdNameField),
                            ld: item[def.lastmodDateField],
                            lb: Retrieve._getUserName(userList, item, def.lastmodNameField),
                        };
                        return listEntry;
                    })
                );
            }
        });
        return allMetadata.filter((item) => undefined !== item);
    }
    /**
     * Retrieve components into a clean retrieve folder.
     * The retrieve folder is deleted before retrieving to make
     * sure we have only components that really exist in the BU.
     * @param {string} sourceBU specific subfolder for downloads
     * @param {CommitSelection[]} commitSelectionArr list of items to be added
     * @returns {void}
     */
    static async retrieveCommitSelection(sourceBU, commitSelectionArr) {
        // * dont use CONFIG.tempDir here to allow proper resolution of required package in VSCode
        const mcdev = require('../tmp/node_modules/mcdev/lib/');

        // get unique list of types that need to be retrieved
        const typeList = [...new Set(commitSelectionArr.map((item) => item.t))].join(',');
        // download all types of which
        await mcdev.retrieve(sourceBU, typeList, false);
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

/**
 * methods to handle interaction with the copado platform
 */
class Commit {
    /**
     * After components have been retrieved,
     * adds selected components to the Git history.
     * @param {string} retrieveFolder path from mcdev config
     * @param {string} sourceBU bu name for source
     * @param {CommitSelection[]} commitSelectionArr list of items to be added
     * @returns {void}
     */
    static addSelectedComponents(retrieveFolder, sourceBU, commitSelectionArr) {
        // Iterate all metadata components selected by user to commit
        const retrieveFolderSeparator = retrieveFolder.endsWith('/') ? '' : '/';

        commitSelectionArr.forEach((component) => {
            const name = component.n;
            const type = component.t;
            const actions = component.a;
            Log.debug(
                'For component with name ' + name + ' and type ' + type + ', run actions ' + actions
            );

            let key;
            // Add all components
            if (component.k) {
                key = component.k;
            }
            // Add selected components
            else if (component.j) {
                const componentJson = JSON.parse(component.j);
                if (componentJson.key) {
                    key = componentJson.key;
                }
            }
            if (!key) {
                throw 'Could not find key for component with name ' + name + ' and type ' + type;
            }
            // Log.debug('For component with name ' + name + ', key is ' + key);

            if (actions.includes('add')) {
                // The file name seems to use always the key.
                // TODO: check if the path is correctly created, also because the type is directly used twice.
                const componentPath = `${retrieveFolder}${retrieveFolderSeparator}${sourceBU}/${type}/${key}.${type}-meta.json`;
                Log.debug(
                    'For component with name ' + name + ', retrieve path is ' + componentPath
                );

                if (fs.existsSync(`${componentPath}`)) {
                    // Add this component to the Git index.
                    // TODO this does not deal with multi-file types (e.g. query, script, asset)
                    Util.execCommand(
                        'Add ' + componentPath,
                        ['git add "' + componentPath + '"'],
                        'Completed adding component'
                    );
                } else {
                    Log.warn(
                        'For component with name ' +
                            name +
                            ', could not find retrieved component file ' +
                            componentPath
                    );
                }
            }
        });
    }
    /**
     * Commits and pushes after adding selected components
     * @param {string} mainBranch name of master branch
     * @param {string} featureBranch can be null/undefined
     * @returns {void}
     */
    static commitAndPush(mainBranch, featureBranch) {
        // If the following command returns some output,
        // git commit must be executed. Otherwise there
        // are no differences between the components retrieved
        // from the org and selected by the user
        // and what is already in Git, so commit and push
        // can be skipped.
        const branch = featureBranch ? featureBranch : mainBranch;
        const stdout = execSync('git diff --staged --name-only');
        Log.debug('Git diff ended with the result: >' + stdout + '<');
        if (stdout && 0 < stdout.length) {
            Util.execCommand(
                'Commit',
                ['git commit -m "' + CONFIG.commitMessage + '"'],
                'Completed committing'
            );
            const ec = Util.execCommandReturnStatus(
                'Push branch ' + branch,
                ['git push origin "' + branch + '" --atomic'],
                'Completed pushing branch'
            );
            if (0 != ec) {
                throw (
                    'Could not push changes to feature branch ' +
                    branch +
                    '. Exit code is ' +
                    ec +
                    '. Please check logs for further details.'
                );
            }
        } else {
            Log.info(
                'Nothing to commit as all selected components have the same content as already exists in Git.'
            );
            Util.execCommand(
                'Nothing to Commit.',
                'copado -p "Nothing to commit" -r "Nothing to Commit as all selected components have the same content as already exists in Git."',
                'Completed committing'
            );
        }
    }
}

run();
