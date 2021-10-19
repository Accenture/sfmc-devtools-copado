#!/usr/bin/env node

const readFileSync = require('fs').readFileSync;
const readdirSync = require('fs').readdirSync;
const existsSync = require('fs').existsSync;
const writeFileSync = require('fs').writeFileSync;

const execSync = require('child_process').execSync;

const mcdev             = 'node ./node_modules/mcdev/lib/index.js';
const debug             = false;//true;
const configFilePath    = '/tmp/.mcdevrc.json'
const deltaPackageLog   = '/tmp/docs/deltaPackage/delta_package.md';

const mcdevVersion      = process.env.mcdev_version;
const credentialName    = process.env.credentialName;
const clientId          = process.env.clientId;
const clientSecret      = process.env.clientSecret;
const tenant            = process.env.tenant;

const fromCommit        = 'promotion/' + process.env.promotion;   
    //The source branch of a PR, typically something like 'feature/...'
const toBranch          = process.env.toBranch;     
    //The target branch of a PR, like master. This commit will be lastly checked out

const authJson = `{
    "credentials": {
        "${credentialName}": {
            "clientId": "${clientId}",
            "clientSecret": "${clientSecret}",
            "tenant": "${tenant}",
            "eid": "7281698"
        }
    }
}`;

/**
 * Should go into a library!
 */
function logDebug(msg) {
    if ( true == debug ) {
        console.log(msg);
    }
}

/**
 * Should go into a library!
 */
function logWarn(msg) {
    console.log(msg);
}

/**
 * Should go into a library!
 */
function logInfo(msg) {
    console.log(msg);
}

/**
 * Should go into a library!
 */
function logError(msg) {
    logWarn(msg);
    execSync("copado --error-message '" + msg + "'");
}

/**
 * Should go into a library!
 */
function logProgress(msg) {
    logDebug(msg)
    execSync("copado --progress '" + msg + "'");
}

/**
 * Should go into a library!
 * Execute command
 * @param {*} preMsg 
 * @param {*} command 
 * @param {*} postMsg 
 */
function execCommand(preMsg, command, postMsg) {
    if (null != preMsg) {
        logProgress(preMsg);
    }
    logDebug(command);

    try {
        execSync(command, {stdio: 'inherit', stderr: 'inherit'});
    }
    catch (error) {
        logError(error.status + ": " + error.message);
        throw new Error(error);
    }

    if (null != postMsg) {
        logProgress(postMsg);
    }
}

/**
 * Should go into a library!
 * Execute command
 * @param {*} preMsg 
 * @param {*} command 
 * @param {*} postMsg 
 * @return exit code
 */
function execCommandReturnStatus(preMsg, command, postMsg) {
    if (null != preMsg) {
        logProgress(preMsg);
    }
    logDebug(command);

    let exitCode = null;
    try {
        execSync(command, {stdio: 'inherit', stderr: 'inherit'});

        //Seems command finished successfully, so change exit code from null to 0
        exitCode = 0;
    }
    catch (error) {
        logWarn(error.status + ": " + error.message);

        //The command failed, take the exit code from the error
        exitCode = error.status;
    }

    if (null != postMsg) {
        logProgress(postMsg);
    }

    return exitCode;
}

/**
 * Checks out the source repository and branch
 */
function checkoutSrc() {

    //First make sure that the from branch is available
    execCommand("Cloning resp. checking out the repository commit/branch " + fromCommit, 
                "cd /tmp && copado-git-get -d . "  + fromCommit, 
                "Completed cloning commit/branch");

    //Now checkout the target branch.
    //That branch/commit that contains changed files should be checked out.
    //When working with PRs, this is the target branch, after the source branch
    //has been merged into this branch. So basically the version range to deploy
    //is HEAD^..HEAD.
    execCommand("Cloning resp. checking out the repository branch " + toBranch, 
                "cd /tmp && copado-git-get -d . "  + toBranch, 
                "Completed cloning branch");
}

/**
 * Merge from branch into target branch
 * @param {*} fromCommit 
 */
function merge(fromCommit) {

    //Merge and commit changes.
    execCommand("Merge commit " + fromCommit, 
                "cd /tmp && git merge \"" + fromCommit + "\"",
                "Completed merging commit");
}

/**
 * Installs MC Dev Tools and prints the version number
 * TODO: This will later be moved into an according Docker container.
 */
function provideMCDevTools() {
    execCommand('Initializing npm', 
                'cd /tmp && npm init -y', 
                'Completed initializing NPM');

    execCommand("Initializing MC Dev Tools version " + mcdevVersion, 
                "cd /tmp && npm install --save mcdev@" + mcdevVersion + " --foreground-scripts && " + mcdev + " --version", 
                "Completed installing MC Dev Tools");
}

/**
 * Initializes MC project
 */
function initProject() {
    //The following command fails for an unknown reason.
    //As workaround, provide directly the authentication file. This is also faster.
    //execCommand("Initializing MC project with credential name " + credentialName + " for tenant " + tenant, 
    //            "cd /tmp && " + mcdev + " init --y.credentialsName " + credentialName + " --y.clientId " + clientId + " --y.clientSecret " + clientSecret + " --y.tenant " + tenant + " --y.gitRemoteUrl " + remoteUrl,
    //            "Completed initializing MC project");
    logProgress("Provide authentication");
    writeFileSync('/tmp/.mcdev-auth.json', authJson);    
    logProgress("Completed providing authentication");
}

/**
 * Determines the deploy folder from MC Dev configuration (.mcdev.json)
 * @return deploy folder
 */
function getDeployFolder() {
    if ( ! existsSync(configFilePath) ) {
        throw new Error('Could not find config file ' + configFilePath);
    }
    const config = JSON.parse(readFileSync(configFilePath, "utf8"));
    const directories = config['directories'];
    if ( null == directories ) {
        throw new Error('Could not find directories in ' + configFilePath);
    }
    const folder = directories['deploy'];
    if ( null == folder ) {
        throw new Error('Could not find directories/deploy in ' + configFilePath);
    }
    
    logDebug("Deploy folder is: " + folder);
    return folder;
}

/**
 * Create the delta package containing the changed components
 * return whether the delta package is empty or not
 * @param {*} deployFolder
 */
function createDeltaPackage(deployFolder) {
    const versionRange = "HEAD^..HEAD";
    execCommand("Create delta package using version range " + versionRange, 
                "cd /tmp && " + mcdev + " createDeltaPkg " + versionRange + " --skipInteraction",
                "Completed creating delta package");
    if ( existsSync(deltaPackageLog) ) {
        execCommand("Upload delta package results file",
                    "copado --uploadfile " + deltaPackageLog,
                    "Completed uploading delta package results file");
    }

    if ( existsSync(deployFolder) ) {
        const deltaPackageFiles = readdirSync(deployFolder);
        if ( null != deltaPackageFiles ) {
            logDebug("Found " + deltaPackageFiles.length + " files to deploy");
            if ( 0 < deltaPackageFiles.length ) {
                return true;
            }
        }
        else {
            logDebug("Could not find any files to deploy in folder " + deployFolder);
        }
    }
    else {
        logDebug("Could not find deploy folder " + deployFolder);
    }
    return false;
}

/**
 * Returns the to branch to use when accessing MC Dev configuration
 * The branch is the normal PR to branch, except if the PR is for a release or hotfix.
 * Release- and hotfix branches have a detailed release or hotfix number in the branch name,
 * and rather than using these detailed names the configuration used only 'release' resp. 'hotfix'.
 * @param {*} branch 
 * @return
 */
function getConfigForToBranch(branch) {
    let configBranch = branch
    if ( branch.startsWith('release/' ) ) {
        configBranch = 'release/*'
    }
    else
    if ( branch.startsWith('hotfix/' ) ) {
        configBranch = 'hotfix/*'
    }
    logDebug("Config branch for branch " + branch + " is " + configBranch);
    return configBranch
}

/**
 * Determines the list of BUs from MC Dev configuration (.mcdev.json)
 * to which changes should be deployed.
 * @return List of BUs
 */
function getDeployTargetBUs() {
    if ( ! existsSync(configFilePath) ) {
        throw new Error('Could not find config file ' + configFilePath);
    }
    const config = JSON.parse(readFileSync(configFilePath, "utf8"));
    const configToBranch = getConfigForToBranch(toBranch);
    const options = config['options'];
    if ( null == options ) {
        throw new Error('Could not find options in ' + configFilePath);
    }
    const deployment = options['deployment'];
    if ( null == deployment ) {
        throw new Error('Could not find options/deployment in ' + configFilePath);
    }
    const targetBranchBuMapping = deployment['targetBranchBuMapping'];
    if ( null == targetBranchBuMapping ) {
        throw new Error('Could not find options/deployment/targetBranchBuMapping in ' + configFilePath);
    }
    const bus = targetBranchBuMapping[configToBranch];
    if ( null == bus ) {
        throw new Error('Could not find config branch ' + configToBranch + ' in options/deployment/targetBranchBuMapping in ' + configFilePath);
    }
    if (bus instanceof String) {
        bus = [bus];
    }
    logDebug("BUs to deploy for config branch " + configToBranch + " are: " + bus.join());
    return bus;
}

/**
 * Deploys one specific BU.
 * In case of errors, the deployment is not stopped.
 * @param {*} bu 
 * @return exit code of the deployment
 */
function deployBU(bu) {
    const ec = execCommandReturnStatus("Deploy BU " + bu, 
                                       "cd /tmp && " + mcdev + " deploy " + bu,
                                       "Completed deploying BU");
    if ( 0 != ec ) {                                       
        logWarn("Deployment of BU " + bu + " failed with exit code " + ec + ". Other BUs will be deployed, but overall deployment will fail at the end.");
        //logError("Deployment of BU " + bu + " failed with exit code " + ec + ". Other BUs will be deployed, but overall deployment will fail at the end.");
        //logInfo("Deployment of BU " + bu + " failed with exit code " + ec + ". Other BUs will be deployed, but overall deployment will fail at the end.");
        //console.log("Deployment of BU " + bu + " failed with exit code " + ec + ". Other BUs will be deployed, but overall deployment will fail at the end.");
    }
    
    return ec;
}

/**
 * Pushes after a successfull deployment
 * @param {*} toBranch 
 */
function push(toBranch) {
    execCommand("Push branch " + toBranch, 
                "cd /tmp && git push origin \"" + toBranch + "\"",
                "Completed pushing branch");
}

logDebug("")
logDebug("Parameters")
logDebug("==========")
logDebug("")
logDebug(`mcdevVersion      = ${mcdevVersion}`);
logDebug(`credentialName    = ${credentialName}`);
//logDebug(`clientId          = ${clientId}`);
//logDebug(`clientSecret      = ${clientSecret}`);
//logDebug(`tenant            = ${tenant}`);
logDebug(`fromCommit        = ${fromCommit}`);
logDebug(`toBranch          = ${toBranch}`);

logInfo("")
logInfo("Clone repository")
logInfo("================")
logInfo("")
checkoutSrc();

logInfo("")
logInfo("Merge branch")
logInfo("============")
logInfo("")
merge(fromCommit);

logInfo("")
logInfo("Preparing")
logInfo("=========")
logInfo("")
provideMCDevTools();

logInfo("")
logInfo("Initialize project")
logInfo("==================")
logInfo("")
initProject();

logInfo("")
logInfo("Determine deploy folder")
logInfo("=======================")
logInfo("")
const deployFolder = getDeployFolder();

logInfo("")
logInfo("Create delta package")
logInfo("====================")
logInfo("")
if ( true == createDeltaPackage('/tmp/' + deployFolder) ) {
    const bus = getDeployTargetBUs()
    
    logInfo("Deploy BUs")
    logInfo("----------")
    let exitCode = 0
    bus.forEach( function (bu, index) {
        const ec = deployBU(bu);
        if ( 0 != ec ) {
            if ( 0 == exitCode ) {
                exitCode = ec
            }
        }
    });
    if ( 0 != exitCode ) {
        throw new Error('Deployment of at least one BU failed. See previous output for details')
    }

    logInfo("Commit and push changes")
    logInfo("-----------------------")
    push(toBranch);
}
logInfo("")
logInfo("Finished")
logInfo("========")
logInfo("")
