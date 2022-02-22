#!/usr/bin/env node

const fs = require('fs');
const execSync = require('child_process').execSync;

const CONFIG = {
    // generic
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    configFilePath: '/tmp/.mcdevrc.json',
    credentialName: process.env.credentialName,
    debug: true,
    envId: null,
    mainBranch: null,
    mcdev: 'node ./node_modules/mcdev/lib/index.js',
    mcdevVersion: process.env.mcdev_version,
    metadataFilePath: null,
    tenant: process.env.tenant,
    // commit
    commitMessage: null,
    featureBranch: null,
    metadataFile: null,
    metadataFileName: null,
    // deploy
    deltaPackageLog: '/tmp/docs/deltaPackage/delta_package.md',
    fromCommit: 'promotion/' + process.env.promotion, // The source branch of a PR, typically something like 'feature/...'
    git_depth: 100, // set a default git depth of 100 commits
    merge_strategy: process.env.merge_strategy, // set default merge strategy
    promotionBranch: process.env.promotionBranch, // The promotion branch of a PR
    toBranch: process.env.toBranch, // The target branch of a PR, like master. This commit will be lastly checked out
};

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
            console.log(msg);
        }
    }
    /**
     * @param {string} msg your log message
     * @returns {void}
     */
    static warn(msg) {
        console.log(msg);
    }
    /**
     * @param {string} msg your log message
     * @returns {void}
     */
    static info(msg) {
        console.log(msg);
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
}

/**
 * helper class
 */
class Util {
    /**
     * Execute command
     * @param {string} [preMsg] the message displayed to the user in copado before execution
     * @param {string} command the cli command to execute synchronously
     * @param {string} [postMsg] the message displayed to the user in copado after execution
     * @returns {void}
     */
    static execCommand(preMsg, command, postMsg) {
        if (null != preMsg) {
            Log.progress(preMsg);
        }
        Log.debug(command);

        try {
            execSync(command, { stdio: 'inherit', stderr: 'inherit' });
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
     * @param {string} command the cli command to execute synchronously
     * @param {string} [postMsg] the message displayed to the user in copado after execution
     * @return {number} exit code
     */
    static execCommandReturnStatus(preMsg, command, postMsg) {
        if (null != preMsg) {
            Log.progress(preMsg);
        }
        Log.debug(command);

        let exitCode = null;
        try {
            execSync(command, { stdio: 'inherit', stderr: 'inherit' });

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
            'cd /tmp && npm init -y',
            'Completed initializing NPM'
        );

        Util.execCommand(
            'Initializing MC Dev Tools version ' + CONFIG.mcdevVersion,
            'cd /tmp && npm install --save mcdev@' +
                CONFIG.mcdevVersion +
                ' --foreground-scripts && ' +
                CONFIG.mcdev +
                ' --version',
            'Completed installing MC Dev Tools'
        );
    }

    /**
     * Initializes MC project
     * @returns {void}
     */
    static initProject() {
        // ! UPDATE NEEDED
        // TODO make eid configurable!!!
        const authJson = `{
            "credentials": {
                "${CONFIG.credentialName}": {
                    "clientId": "${CONFIG.clientId}",
                    "clientSecret": "${CONFIG.clientSecret}",
                    "tenant": "${CONFIG.tenant}",
                    "eid": "7281698"
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
            'cd /tmp && ' + CONFIG.mcdev + ' createDeltaPkg ' + versionRange + ' --skipInteraction',
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
            'cd /tmp && ' + CONFIG.mcdev + ' deploy ' + bu,
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
            'cd /tmp && copado --uploadfile "' +
                metadataFilePath +
                '" --parentid "' +
                CONFIG.envId +
                '"',
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
            'cd /tmp && copado-git-get "' + mainBranch + '"',
            'Completed cloning/checking out main branch'
        );
        if (featureBranch) {
            Util.execCommand(
                'Creating resp. checking out the feature branch ' + featureBranch,
                'cd /tmp && copado-git-get --create "' + featureBranch + '"',
                'Completed creating/checking out feature branch'
            );
        }
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
            'cd /tmp && copado-git-get -d . ' + fromCommit,
            'Completed cloning commit/branch'
        );

        // Now checkout the target branch.
        // That branch/commit that contains changed files should be checked out.
        // When working with PRs, this is the target branch, after the source branch
        // has been merged into this branch. So basically the version range to deploy
        // is HEAD^..HEAD.
        Util.execCommand(
            'Cloning resp. checking out the repository branch ' + toBranch,
            'cd /tmp && copado-git-get -d . ' + toBranch,
            'Completed cloning branch'
        );
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
            'cd /tmp && git merge "' + fromCommit + '"',
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
            'cd /tmp && git push origin "' + toBranch + '"',
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
            'cd /tmp && copado-git-get --depth ' + CONFIG.git_depth + ' ' + CONFIG.promotionBranch,
            'Completed cloning branch'
        );
        const mergeOption = CONFIG.merge_strategy ? '-X ' + CONFIG.merge_strategy + ' ' : '';
        Util.execCommand(
            'Merge commit ' + toBranch,
            'cd /tmp && git merge ' +
                mergeOption +
                '-m "Auto merge ' +
                toBranch +
                '" "' +
                toBranch +
                '"',
            'Completed merging'
        );

        Util.execCommand(
            'Push branch ' + CONFIG.promotionBranch,
            'cd /tmp && git push origin "' + CONFIG.promotionBranch + '"',
            'Completed pushing branch'
        );
    }
}

Log.info('Deploy.js started');
Log.debug('');
Log.debug('Parameters');
Log.debug('==========');
Log.debug('');
Log.debug(`fromCommit        = ${CONFIG.fromCommit}`);
Log.debug(`toBranch          = ${CONFIG.toBranch}`);
Log.debug('');
Log.debug(`mcdevVersion      = ${CONFIG.mcdevVersion}`);
Log.debug(`credentialName    = ${CONFIG.credentialName}`);

Log.info('');
Log.info('Clone repository');
Log.info('================');
Log.info('');
Copado.checkoutSrcDeploy(CONFIG.fromCommit, CONFIG.toBranch);

Log.info('');
Log.info('Merge branch');
Log.info('============');
Log.info('');
Copado.merge(CONFIG.fromCommit);

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
Log.info('Determine deploy folder');
Log.info('=======================');
Log.info('');
const deployFolder = Deploy.getDeployFolder();

Log.info('');
Log.info('Create delta package');
Log.info('====================');
Log.info('');
if (true == Deploy.createDeltaPackage('/tmp/' + deployFolder)) {
    const bus = Deploy.getDeployTargetBUs();

    Log.info('Deploy BUs');
    Log.info('----------');
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
        throw new Error('Deployment of at least one BU failed. See previous output for details');
    }

    Log.info('Commit and push changes');
    Log.info('-----------------------');
    Copado.push(CONFIG.toBranch);
}

Log.info('');
Log.info('Merge into promotion branch');
Log.info('===========================');
Log.info('');
Copado.promote(CONFIG.toBranch, CONFIG.promotionBranch);

Log.info('');
Log.info('Finished');
Log.info('========');
Log.info('');
Log.info('Deploy.js done');
