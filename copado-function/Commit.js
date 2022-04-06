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

const fs = require('fs');
const path = require('path');
const execSync = require('child_process').execSync;

const CONFIG = {
    // generic
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    configFilePath: '/tmp/.mcdevrc.json',
    credentialName: process.env.credentialName,
    debug: process.env.debug === 'false' ? false : true,
    envId: process.env.envId,
    enterpriseId: process.env.enterprise_id,
    mainBranch: process.env.main_branch,
    mcdev_exec: ['3.0.0', '3.0.1', '3.0.2', '3.0.3'].includes(process.env.mcdev_version)
        ? 'node ./node_modules/mcdev/lib/index.js'
        : 'node ./node_modules/mcdev/lib/cli.js',
    mcdevVersion: process.env.mcdev_version,
    metadataFilePath: '/tmp/mcmetadata.json',
    tenant: process.env.tenant,
    // commit
    commitMessage: process.env.commit_message,
    featureBranch: process.env.feature_branch,
    metadataFile: process.env.metadata_file, // TODO: check if this duplicates CONFIG.metadataFilePath
    metadataFileName: 'Copado Commit changes.json',
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
function run() {
    Log.info('Commit.js started');
    Log.debug('');
    Log.debug('Parameters');
    Log.debug('==========');
    Log.debug('');
    Log.debug(`mainBranch               = ${CONFIG.mainBranch}`);
    Log.debug(`featurebranch            = ${CONFIG.featureBranch}`);
    Log.debug(`metadataFile             = ${CONFIG.metadataFile}`);
    Log.debug(`commitMessage            = ${CONFIG.commitMessage}`);
    Log.debug('');
    Log.debug(`mcdevVersion             = ${CONFIG.mcdevVersion}`);
    Log.debug(`credentialName           = ${CONFIG.credentialName}`);
    // Log.debug(`clientId                 = ${clientId}`);
    // Log.debug(`clientSecret             = ${clientSecret}`);
    // Log.debug(`tenant                   = ${tenant}`);

    Log.info('');
    Log.info('Clone repository');
    Log.info('================');
    Log.info('');
    Copado.checkoutSrc(CONFIG.mainBranch, CONFIG.featureBranch);

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

    Log.info('');
    Log.info('Determine retrieve folder');
    Log.info('=========================');
    Log.info('');
    const retrieveFolder = Retrieve.getRetrieveFolder();

    Log.info('');
    Log.info('Get source BU');
    Log.info('=============');
    Log.info('');
    const sourceBU = Retrieve.getSourceBU();

    Log.info('');
    Log.info('Retrieve components');
    Log.info('===================');
    Log.info('');
    Retrieve.retrieveComponents(sourceBU);

    let metadataJson;
    if (!CONFIG.metadataFile) {
        Log.info('');
        Log.info('Add all components to the metadata JSON');
        Log.info('=======================================');
        Log.info('');
        const retrievePath = path.join('/tmp', retrieveFolder, sourceBU);
        let retrievePathFixed = retrievePath;
        if (retrievePath.endsWith('/') || retrievePath.endsWith('\\')) {
            retrievePathFixed = retrievePath.substring(0, retrievePath.length - 1);
        }
        metadataJson = [];
        Metadata._buildMetadataJson(retrievePathFixed, sourceBU, metadataJson);
    } else {
        Log.info('');
        Log.info(`Add selected components defined in ${CONFIG.metadataFile} to metadata JSON`);
        Log.info('====================================================================');
        Log.info('');

        Util.execCommand(
            `Download ${CONFIG.metadataFile}.`,
            `copado --downloadfiles "${CONFIG.metadataFile}"`,
            'Completed download'
        );

        const metadata = fs.readFileSync(CONFIG.metadataFileName, 'utf8');
        metadataJson = JSON.parse(metadata);
    }

    Log.info('');
    Log.info('Add components in metadata JSON to Git history');
    Log.info('==============================================');
    Log.info('');
    Commit.addSelectedComponents(retrieveFolder, sourceBU, metadataJson);

    Log.info('');
    Log.info('Commit and push');
    Log.info('===============');
    Log.info('');
    Commit.commitAndPush(CONFIG.mainBranch, CONFIG.featureBranch);
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
        execSync("copado --error-message '" + msg + "'");
    }
    /**
     * @param {string} msg your log message
     * @returns {void}
     */
    static progress(msg) {
        Log.debug(msg);
        execSync("copado --progress '" + msg + "'");
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
        Util.execCommand(
            'Initializing npm',
            ['cd /tmp', 'npm init -y'],
            'Completed initializing NPM'
        );
        let installer;
        if (CONFIG.mcdevVersion.charAt(0) === '#') {
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
                'cd /tmp',
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
        fs.writeFileSync('/tmp/.mcdev-auth.json', authJson);
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
     * TODO: replace execCommand with call to required mcdev
     * @param {string} sourceBU specific subfolder for downloads
     * @param {string} [retrieveFolder] place where mcdev will download to
     * @returns {void}
     */
    static retrieveComponents(sourceBU, retrieveFolder) {
        if (retrieveFolder) {
            const retrievePath = path.join('/tmp', retrieveFolder, sourceBU);
            let retrievePathFixed = retrievePath;
            if (retrievePath.endsWith('/') || retrievePath.endsWith('\\')) {
                retrievePathFixed = retrievePath.substring(0, retrievePath.length - 1);
            }
            Log.info('Delete retrieve folder ' + retrievePathFixed);
            fs.rmSync(retrievePathFixed, { recursive: true, force: true });
        }
        // TODO: should use the retrieve logic from mcdev's retrieveChangelog.js instead
        Util.execCommand(
            'Retrieve components from ' + sourceBU,
            ['cd /tmp', CONFIG.mcdev_exec + ' retrieve ' + sourceBU + ' --skipInteraction'],
            'Completed retrieving components'
        );
    }
}

/**
 * handles creating the metadata json that we store for copado after retrieving it
 */
class Metadata {
    /**
     * After components have been retrieved,
     * find all retrieved components and build a json containing as much
     * metadata as possible.
     * @param {string} retrieveFolder path where downloaded files are
     * @param {string} sourceBU subfolder for BU
     * @param {string} metadataFilePath filename & path to where we store the final json for copado
     * @returns {void}
     */
    static createMetadataFile(retrieveFolder, sourceBU, metadataFilePath) {
        const retrievePath = path.join('/tmp', retrieveFolder, sourceBU);
        let retrievePathFixed = retrievePath;
        if (retrievePath.endsWith('/') || retrievePath.endsWith('\\')) {
            retrievePathFixed = retrievePath.substring(0, retrievePath.length - 1);
        }
        /**
         * @type {MetadataItem}
         */
        const metadataJson = [];
        Metadata._buildMetadataJson(retrievePathFixed, sourceBU, metadataJson);
        Log.info('Found items:' + metadataJson.length);
        const metadataString = JSON.stringify(metadataJson);
        // Log.debug('Metadata JSON is: ' + metadataString);
        fs.writeFileSync(metadataFilePath, metadataString);
    }

    /**
     * After components have been retrieved,
     * find all retrieved components and build a json containing as much
     * metadata as possible.
     * @private
     * @param {string} retrieveFolder path where downloaded files are
     * @param {string} sourceBU subfolder for BU
     * @param {MetadataItem[]} metadataJson reference to array that we want to pass to copado
     * @returns {void}
     */
    static _buildMetadataJson(retrieveFolder, sourceBU, metadataJson) {
        // Handle files within the current directory
        const filesAndFolders = fs
            .readdirSync(retrieveFolder)
            .map((entry) => path.join(retrieveFolder, entry));
        let skipped = 0;
        filesAndFolders.forEach((filePath) => {
            if (fs.statSync(filePath).isFile()) {
                const dirName = path.dirname(filePath);
                const componentType = path.basename(dirName);

                let componentJson;
                switch (componentType) {
                    case 'automation':
                        Log.debug('Handle component ' + filePath + ' with type ' + componentType);
                        componentJson = Metadata._buildAutomationMetadataJson(filePath, 'add');
                        break;
                    case 'dataExtension':
                        Log.debug('Handle component ' + filePath + ' with type ' + componentType);
                        componentJson = Metadata._buildDataExtensionMetadataJson(filePath, 'add');
                        break;
                    default:
                        Log.info(
                            'Skipping: Component ' +
                                filePath +
                                ' with type ' +
                                componentType +
                                ' is not supported'
                        );
                        skipped++;
                        return;
                }

                // Log.debug('Metadata JSON for component ' + filePath + ' is: ' + JSON.stringify(componentJson));
                metadataJson.push(componentJson);
            }
        });
        Log.info('Good items:' + metadataJson.length);
        Log.info('Skipped items:' + skipped);

        // Get folders within the current directory
        filesAndFolders.forEach((folderPath) => {
            if (fs.statSync(folderPath).isDirectory()) {
                Metadata._buildMetadataJson(folderPath, sourceBU, metadataJson);
            }
        });
    }

    /**
     * Build the metadata JSON for a automation component
     * @private
     * @param {string} filePath path to json
     * @param {string} [action] pass in value do govern what to do
     * @returns {MetadataItem} one table row
     */
    static _buildAutomationMetadataJson(filePath, action) {
        // Load the file
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        const metadata = {};
        metadata['n'] = parsed['name'] ? parsed['name'] : parsed['key'];
        metadata['k'] = parsed['key'];
        metadata['t'] = 'automation';
        // metadata['cd'] = parsed[''];
        // metadata['cb'] = parsed[''];
        // metadata['ld'] = parsed[''];
        // metadata['lb'] = parsed[''];

        if (action) {
            metadata.a = action;
        }

        return metadata;
    }

    /**
     * Build the metadata JSON for a data extension component
     * @private
     * @param {string} filePath path to json
     * @param {string} [action] pass in value do govern what to do
     * @returns {MetadataItem} one table row
     */
    static _buildDataExtensionMetadataJson(filePath, action) {
        // Load the file
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        const metadata = {};
        metadata['n'] = parsed['Name'] ? parsed['Name'] : parsed['CustomerKey'];
        metadata['k'] = parsed['CustomerKey'];
        metadata['t'] = 'dataExtension';
        metadata['cd'] = parsed['CreatedDate'];
        // metadata['cb'] = parsed[''];
        // metadata['ld'] = parsed[''];
        // metadata['lb'] = parsed[''];

        if (action) {
            metadata.a = action;
        }

        return metadata;
    }
}

/**
 * methods to handle interaction with the copado platform
 */
class Copado {
    /**
     * Finally, attach the resulting metadata JSON.
     * @param {string} metadataFilePath where we stored the temporary json file
     * @returns {void}
     */
    static attachJson(metadataFilePath) {
        Util.execCommand(
            'Attach JSON ' + metadataFilePath,
            [
                'cd /tmp',
                'copado --uploadfile "' + metadataFilePath + '" --parentid "' + CONFIG.envId + '"',
            ],
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
            ['cd /tmp', 'copado-git-get "' + mainBranch + '"'],
            'Completed cloning/checking out main branch'
        );
        if (featureBranch) {
            Util.execCommand(
                'Creating resp. checking out the feature branch ' + featureBranch,
                ['cd /tmp', 'copado-git-get --create "' + featureBranch + '"'],
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
            fs.readdirSync('/tmp/logs').forEach((file) => {
                Log.debug('- ' + file);
                Copado.attachLog('/tmp/logs/' + file);
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
     * Checks out the source repository and branch
     * @param {string} fromCommit commit id to merge
     * @param {string} toBranch branch name to merge into
     * @returns {void}
     */
    //  static checkoutSrcDeploy(fromCommit, toBranch) {
    //     // First make sure that the from branch is available
    //     Util.execCommand(
    //         'Cloning resp. checking out the repository commit/branch ' + fromCommit,
    //         ['cd /tmp', 'copado-git-get -d . ' + fromCommit],
    //         'Completed cloning commit/branch'
    //     );

    //     // Now checkout the target branch.
    //     // That branch/commit that contains changed files should be checked out.
    //     // When working with PRs, this is the target branch, after the source branch
    //     // has been merged into this branch. So basically the version range to deploy
    //     // is HEAD^..HEAD.
    //     Util.execCommand(
    //         'Cloning resp. checking out the repository branch ' + toBranch,
    //         ['cd /tmp', 'copado-git-get -d . ' + toBranch],
    //         'Completed cloning branch'
    //     );
    // }
    /**
     * Merge from branch into target branch
     * @param {string} fromCommit commit id to merge
     * @returns {void}
     */
    // static merge(fromCommit) {
    //     // Merge and commit changes.
    //     Util.execCommand(
    //         'Merge commit ' + fromCommit,
    //         ['cd /tmp', 'git merge "' + fromCommit + '"'],
    //         'Completed merging commit'
    //     );
    // }

    /**
     * After components have been retrieved,
     * adds selected components to the Git history.
     * @param {string} retrieveFolder path from mcdev config
     * @param {string} sourceBU bu name for source
     * @param {MetadataItem[]} metadataJson list of items to be added
     * @returns {void}
     */
    static addSelectedComponents(retrieveFolder, sourceBU, metadataJson) {
        // Iterate all metadata components selected by user to commit
        const retrieveFolderSeparator = retrieveFolder.endsWith('/') ? '' : '/';

        metadataJson.forEach((component) => {
            const name = component['n'];
            const type = component['t'];
            const actions = component['a'];
            Log.debug(
                'For component with name ' + name + ' and type ' + type + ', run actions ' + actions
            );

            let key = null;
            // Add all components
            if (component['k']) {
                key = component['k'];
            }
            // Add selected components
            else if (component['j']) {
                const componentJson = JSON.parse(component['j']);
                if (componentJson['key']) {
                    key = componentJson['key'];
                }
            }
            if (!key) {
                throw 'Could not find key for component with name ' + name + ' and type ' + type;
            }
            Log.debug('For component with name ' + name + ', key is ' + key);

            if (actions.includes('add')) {
                // The file name seems to use always the key.
                // TODO: check if the path is correctly created, also because the type is directly used twice.
                const componentPath = `${retrieveFolder}${retrieveFolderSeparator}${sourceBU}/${type}/${key}.${type}-meta.json`;
                Log.debug(
                    'For component with name ' + name + ', retrieve path is ' + componentPath
                );

                if (fs.existsSync(`/tmp/${componentPath}`)) {
                    // Add this component to the Git index.
                    Util.execCommand(
                        'Add ' + componentPath,
                        ['cd /tmp', 'git add "' + componentPath + '"'],
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
        const stdout = execSync('cd /tmp && git diff --staged --name-only');
        Log.debug('Git diff ended with the result: >' + stdout + '<');
        if (stdout && 0 < stdout.length) {
            Util.execCommand(
                'Commit',
                ['cd /tmp', 'git commit -m "' + CONFIG.commitMessage + '"'],
                'Completed committing'
            );
            const ec = Util.execCommandReturnStatus(
                'Push branch ' + branch,
                ['cd /tmp', 'git push origin "' + branch + '" --atomic'],
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
