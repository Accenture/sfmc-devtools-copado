#!/usr/bin/env node

const readFileSync = require('fs').readFileSync;
const readdirSync = require('fs').readdirSync;
const existsSync = require('fs').existsSync;
const writeFileSync = require('fs').writeFileSync;
const statSync = require('fs').statSync;
const dirname = require('path').dirname;

const execSync = require('child_process').execSync;

const mcdev             = 'node ./node_modules/mcdev/lib/index.js';
const debug             = false;//true;
const configFilePath    = '/tmp/.mcdevrc.json'

const mainBranch        = process.env.main_branch;
const featureBranch     = process.env.feature_branch;
const metadataFile      = process.env.metadata_file;
const metadataFileName  = 'Copado Commit changes.json';
const commitMessage     = process.env.commit_message;
const mcdevVersion      = process.env.mcdev_version;
const credentialName    = process.env.credentialName;
const clientId          = process.env.clientId;
const clientSecret      = process.env.clientSecret;
const tenant            = process.env.tenant;

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
    let stdout = null;
    try {
        stdout = execSync(command, {stdio: 'inherit', stderr: 'inherit'});

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
 * Checks out the source repository and create 
 * the feature branch based on the main branch.
 * @param {*} mainBranch 
 * @param {*} featureBranch 
 */
function checkoutSrc(mainBranch, featureBranch) {
    execCommand("Cloning and checking out the main branch " + mainBranch, 
                "cd /tmp && copado-git-get \""  + mainBranch + "\"", 
                "Completed cloning/checking out main branch");
    execCommand("Creating resp. checking out the feature branch " + featureBranch, 
                "cd /tmp && copado-git-get --create \""  + featureBranch + "\"", 
                "Completed creating/checking out feature branch");
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
 * Determines the retrieve folder from MC Dev configuration (.mcdev.json)
 * @return retrieve folder
 */
function getRetrieveFolder() {
    if ( ! existsSync(configFilePath) ) {
        throw new Error('Could not find config file ' + configFilePath);
    }
    const config = JSON.parse(readFileSync(configFilePath, "utf8"));
    const directories = config['directories'];
    if ( null == directories ) {
        throw new Error('Could not find directories in ' + configFilePath);
    }
    const folder = directories['retrieve'];
    if ( null == folder ) {
        throw new Error('Could not find directories/retrieve in ' + configFilePath);
    }
    
    logDebug("Retrieve folder is: " + folder);
    return folder;
}

/**
 * Determines the BU from MC Dev configuration (.mcdev.json)
 * from which to retrieve components.
 * @return BU
 */
function getSourceBU() {
    if ( ! existsSync(configFilePath) ) {
        throw new Error('Could not find config file ' + configFilePath);
    }
    const config = JSON.parse(readFileSync(configFilePath, "utf8"));
    const options = config['options'];
    if ( null == options ) {
        throw new Error('Could not find options in ' + configFilePath);
    }
    const deployment = options['deployment'];
    if ( null == deployment ) {
        throw new Error('Could not find options/deployment in ' + configFilePath);
    }
    const sourceTargetMapping = deployment['sourceTargetMapping'];
    if ( null == sourceTargetMapping ) {
        throw new Error('Could not find options/deployment/sourceTargetMapping in ' + configFilePath);
    }
    const sourceTargetMappingKeys = Object.keys(sourceTargetMapping);
    if ( ( null == sourceTargetMappingKeys ) || ( 1 != sourceTargetMappingKeys.length) ) {
        throw new Error('Got unexpected number of keys in options/deployment/sourceTargetMapping in ' + configFilePath + '. Expected is only one entry');
    }

    const marketList = config['marketList'];
    if ( null == marketList ) {
        throw new Error('Could not find marketList in ' + configFilePath);
    }
    const deploymentSource = marketList[sourceTargetMappingKeys[0]];
    if ( null == deploymentSource ) {
        throw new Error('Could not find marketList/ ' + deploymentSourceKeys[0] + ' in ' + configFilePath);
    }
    const deploymentSourceKeys = Object.keys(deploymentSource);
    if ( ( null == deploymentSourceKeys ) || ( ( 1 != deploymentSourceKeys.length) && ( 2 != deploymentSourceKeys.length) ) ) {
        throw new Error('Got unexpected number of keys in marketList/' + deploymentSource + ' in ' + configFilePath + '. Expected is one entry, or two in case there is a description entry.');
    }
    let sourceBU = null;
    if ( 'description' != deploymentSourceKeys[0]) {
        sourceBU = deploymentSourceKeys[0];
    }
    else {
        sourceBU = deploymentSourceKeys[1];
    }

    logDebug("BU to retrieve is: " + sourceBU);
    return sourceBU;
}

/**
 * Retrieve components.
 * As long as we are not able to retrieve only selected components,
 * we retrieve all and add only the selected components to Git.
 * @param {*} bu 
 */
function retrieveComponents(sourceBU) {
    execCommand("Retrieve components from " + sourceBU, 
                "cd /tmp && " + mcdev + " retrieve " + sourceBU + " --skipInteraction",
                "Completed retrieving components");
}

/**
 * Should go into a library!
 * After components have been retrieved,
 * find all retrieved components and build a json containing as much
 * metadata as possible.
 * @param {*} retrieveFolder 
 * @param {*} sourceBU 
 * @param {*} metadataJson
 */
function buildMetadataJson(retrieveFolder, sourceBU, metadataJson) {
    //Handle files within the current directory
    const filesAndFolders = readdirSync(retrieveFolder).map(entry => join(retrieveFolder, entry));
    filesAndFolders.forEach(function(filePath) {
        if ( statSync(filePath).isFile() ) {
            const dirName = dirname(filePath);
            const componentType = basename(dirName);

            let componentJson;
            switch (componentType) {
                case "automation":
                    logDebug('Handle component ' + filePath +' with type ' + componentType);
                    componentJson = buildAutomationMetadataJson(filePath, sourceBU);
                    break;
                case "dataExtension":
                    logDebug('Handle component ' + filePath +' with type ' + componentType);
                    componentJson = buildDataExtensionMetadataJson(filePath, sourceBU);
                    break;
                default:
                    throw new Error('Component ' + filePath+ ' with type ' + componentType +' is not supported');
            }

            //logDebug('Metadata JSON for component ' + filePath + ' is: ' + JSON.stringify(componentJson));
            metadataJson.push(componentJson);
        }
    });

    //Get folders within the current directory
    filesAndFolders.forEach(function(folderPath) {
        if ( statSync(folderPath).isDirectory() ) {
            buildMetadataJson(folderPath, sourceBU, metadataJson);
        }
    });
}

/**
 * Should go into a library!
 * Build the metadata JSON for a automation component
 * Should go into a library!
 * @param {*} filePath 
 * @param {*} sourceBU 
 */
function buildAutomationMetadataJson(filePath, sourceBU) {
    //Load the file
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));

    const metadata = {};
    metadata['n'] = (parsed['name']) ? parsed['name'] : parsed['key'];
    metadata['k'] = parsed['key'];
    metadata['t'] = 'automation';
    //metadata['cd'] = parsed[''];
    //metadata['cb'] = parsed[''];
    //metadata['ld'] = parsed[''];
    //metadata['lb'] = parsed[''];

    return metadata;
}

/**
 * Should go into a library!
 * Build the metadata JSON for a data extension component
 * Should go into a library!
 * @param {*} filePath 
 * @param {*} sourceBU 
 */
function buildDataExtensionMetadataJson(filePath, sourceBU) {
    //Load the file
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));

    const metadata = {};
    metadata['n'] = (parsed['Name']) ? parsed['Name'] : parsed['CustomerKey'];
    metadata['k'] = parsed['CustomerKey'];
    metadata['t'] = 'dataExtension';
    metadata['cd'] = parsed['CreatedDate'];
    //metadata['cb'] = parsed[''];
    //metadata['ld'] = parsed[''];
    //metadata['lb'] = parsed[''];

    return metadata;
}

/**
 * After components have been retrieved,
 * adds selected components to the Git history.
 * @param {*} retrieveFolder 
 * @param {*} sourceBU 
 * @param {*} metadataJson
 */
function addSelectedComponents(retrieveFolder, sourceBU, metadataJson) {
    //Iterate all metadata components selected by user to commit
    const retrieveFolderSeparator = retrieveFolder.endsWith('/') ? '' : '/';

    metadataJson.forEach(function(component) {
        const name = component['n'];
        const type = component['t'];
        const actions = component['a'];
        logDebug("For component with name " + name + " and type " + type + ", run actions " + actions);

        let key = null;
        if ( component['j'] ) {
            const componentJson = JSON.parse(component['j']);
            if ( componentJson['key'] ) {
                key = componentJson['key'];
            }
        }
        if ( ! key ) {
            throw("Could not find key for component with name " + name + " and type " + type);
        }
        logDebug("For component with name " + name + ", key is " + key);

        if ( actions.includes('add') ) {
            //The file name seems to use always the key.
            //TODO: check if the path is correctly created, also because the type is directly used twice.
            const componentPath = `${retrieveFolder}${retrieveFolderSeparator}${sourceBU}/${type}/${key}.${type}-meta.json`;
            logDebug("For component with name " + name + ", retrieve path is " + componentPath);

            if ( existsSync(`/tmp/${componentPath}`) ) {
                //Add this component to the Git index.
                execCommand("Add " + componentPath, 
                            "cd /tmp && git add \"" + componentPath + "\"",
                            "Completed adding component");
            }
            else {
                logWarn("For component with name " + name + ", could not find retrieved component file " + componentPath); 
            }
        }
    });    
}

/**
 * Commits and pushes after adding selected components
 * @param {*} featureBranch 
 */
function commitAndPush(featureBranch) {
    //If the following command returns some output, 
    //git commit must be executed. Otherwise there
    //are no differences between the components retrieved
    //from the org and selected by the user
    //and what is already in Git, so commit and push
    //can be skipped.
    const stdout = execSync("cd /tmp && git diff --staged --name-only");
    logDebug("Git diff ended with the result: >" + stdout + "<"); 
    if ( stdout && (0 < stdout.length)) {
        execCommand("Commit", 
                    "cd /tmp && git commit -m \"" + commitMessage + "\"",
                    "Completed committing");
        const ec = execCommandReturnStatus("Push branch " + featureBranch, 
                                        "cd /tmp && git push origin \"" + featureBranch + "\" --atomic",
                                        "Completed pushing branch");
        if ( 0 != ec ) {                                       
            throw("Could not push changes to feature branch " + featureBranch + ". Exit code is " + ec + ". Please check logs for further details.");
        }
    }
    else {
        logInfo("Nothing to commit as all selected components have the same content as already exists in Git."); 
        execCommand("Nothing to Commit.", 
                    "copado -p \"Nothing to commit\" -r \"Nothing to Commit as all selected components have the same content as already exists in Git.\"",
                    "Completed committing");        
    }
}

logDebug("")
logDebug("Parameters")
logDebug("==========")
logDebug("")
logDebug(`mainBranch               = ${mainBranch}`);
logDebug(`featurebranch            = ${featureBranch}`);
logDebug(`metadataFile             = ${metadataFile}`);
logDebug(`commitMessage            = ${commitMessage}`);
logDebug("")
logDebug(`mcdevVersion             = ${mcdevVersion}`);
logDebug(`credentialName           = ${credentialName}`);
//logDebug(`clientId                 = ${clientId}`);
//logDebug(`clientSecret             = ${clientSecret}`);
//logDebug(`tenant                   = ${tenant}`);

logInfo("")
logInfo("Clone repository")
logInfo("================")
logInfo("")
checkoutSrc(mainBranch, featureBranch);

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
logInfo("Determine retrieve folder")
logInfo("=========================")
logInfo("")
const retrieveFolder = getRetrieveFolder();

logInfo("")
logInfo("Get source BU")
logInfo("=============")
logInfo("")
const sourceBU = getSourceBU();

logInfo("")
logInfo("Retrieve components")
logInfo("===================")
logInfo("")
retrieveComponents(sourceBU);

let metadataJson;
if ( ! metadataFile ) {
    logInfo("")
    logInfo("Add all components to the metadata JSON")
    logInfo("=======================================")
    logInfo("")
    metadataJson = [];
    buildMetadataJson(retrieveFolder, sourceBU, metadataJson);
}
else {
    logInfo("")
    logInfo(`Add selected components defined in ${metadataFile} to metadata JSON`)
    logInfo("====================================================================")
    logInfo("")
    
    execCommand(`Download ${metadataFile}.`, 
                `copado --downloadfiles \"${metadataFile}\"`,
                "Completed download");        

    const metadata = readFileSync(metadataFileName, "utf8");
    metadataJson = JSON.parse(metadata);
}

logInfo("")
logInfo("Add components in metadata JSON to Git history")
logInfo("==============================================")
logInfo("")
addSelectedComponents(retrieveFolder, sourceBU, metadataJson);

logInfo("")
logInfo("Commit and push")
logInfo("===============")
logInfo("")
commitAndPush(featureBranch);