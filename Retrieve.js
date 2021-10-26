#!/usr/bin/env node

/*
# 0 - Debug 
echo "envId: $envId"

# 1 - Generate JSON File
echo '[{"n":"test","key":"56346005-c5d2-25c0-1b4e-d71034de4794","t":"automation","cd":"2020-08-11T06:42:42.543","cb":"Arun Choudhary (ASGR)","ld":"2020-08-31T09:37:51.19","lb":"Catalyst Test Arun app user"},{"n":"Test Automation","key":"Test_Automation","t":"automation","cd":"2020-08-21T10:33:01.45","cb":"Arun Choudhary (ASGR)","ld":"2020-08-21T11:41:24.02","lb":"Arun Choudhary (ASGR)"},{"n":"Identities_Segmentation_DEV","key":"Identities_Segmentation_DEV","t":"automation","cd":"2020-05-07T00:30:37.45","cb":"Jörn Berkefeld (ASGR)","ld":"2020-08-31T09:37:51.03","lb":"Catalyst Test Arun app user"},{"n":"New Journey - 28 August 2020 11.07 - 2020-08-28T033952.188","key":"d5f56946-e3e3-4573-b457-7509cbd3dba3","t":"automation","cd":"2020-08-28T03:39:52.367","cb":"Arun Choudhary (ASGR)","ld":"2020-08-28T03:39:52.477","lb":"Arun Choudhary (ASGR)"},{"n":"","key":"Identities_Segmentation","t":"automation","cd":"2019-10-25T05:40:12.497","cb":"Jörn Berkefeld (ASGR)","ld":"2019-10-25T06:47:14.07","lb":"Jörn Berkefeld (ASGR)"},{"n":"Test","key":"66B48AB8-D7AE-417D-A9EC-2FD9FAF71F8D","t":"dataExtension","cd":"2020-08-11T06:17:30.18","ld":"2020-08-11T06:17:30.18"},{"n":"testForDeploy","key":"9F5C9344-5C4A-4090-90ED-8676A37FC47D","t":"dataExtension","cd":"2020-08-11T09:08:16.683","ld":"2020-08-11T09:08:16.683"},{"n":"Test sendable data extension","key":"Test_sendable_dataExtension","t":"dataExtension","cd":"2020-08-21T08:19:33.12","ld":"2020-08-21T08:19:33.12"},{"n":"TriggeredSendDataExtension Test","key":"TriggeredSendDataExtension_Test","t":"dataExtension","cd":"2020-08-21T08:24:09.17","ld":"2020-08-21T08:24:09.17"},{"n":"Identities","key":"Identities","t":"dataExtension","cd":"2019-10-25T04:58:32.273","ld":"2019-10-25T04:58:32.273"},{"n":"Identities_DE","key":"Identities_DE","t":"dataExtension","cd":"2019-10-25T04:59:47.09","ld":"2020-06-19T05:07:53.2"},{"n":"Identities_DEV","key":"Identities_DEV","t":"dataExtension","cd":"2019-10-25T05:00:45.793","ld":"2020-08-05T08:24:55.9"},{"n":"training_2020-05-05","key":"training_2020-05-05","t":"dataExtension","cd":"2020-05-06T00:16:00.737","ld":"2020-05-06T00:16:00.737"},{"n":"Identities_CH","key":"Identities_CH","t":"dataExtension","cd":"2020-05-07T00:26:43.947","ld":"2020-05-07T00:26:43.947"},{"n":"Identities_Shared_Demo_DE_copied","key":"Identities_Shared_Demo_DE_copied","t":"dataExtension","cd":"2020-05-27T10:13:32.377","ld":"2020-05-27T15:20:06.413"},{"n":"Account_Salesforce_Source","key":"Account_Salesforce_Source","t":"dataExtension","cd":"2020-05-27T15:20:05.163","ld":"2020-08-16T10:10:50.7"},{"n":"CSCLSROZ-272","key":"CSCLSROZ-272","t":"dataExtension","cd":"2020-11-25T13:08:07.02","ld":"2020-11-25T13:20:48.657"},{"n":"Test Target DE","key":"Test Target DE","t":"dataExtension","cd":"2021-08-09T09:18:47.417","ld":"2021-08-10T03:40:08.65"},{"n":"CopadoTest","key":"CopadoTest","t":"dataExtension","cd":"2021-08-24T05:04:06.65","ld":"2021-08-25T08:54:38.227"},{"n":"test-joern-filter-de","key":"test-joern-filter-de","t":"dataExtension","cd":"2020-12-25T13:51:22.813","ld":"2020-12-25T13:51:22.813"}]' > mcmetadata.json

*/

const readFileSync = require('fs').readFileSync;
const readdirSync = require('fs').readdirSync;
const existsSync = require('fs').existsSync;
const writeFileSync = require('fs').writeFileSync;
const statSync = require('fs').statSync;
const rmSync = require('fs').rmSync;
const basename = require('path').basename;
const dirname = require('path').dirname;
const join = require('path').join;

const execSync = require('child_process').execSync;

const mcdev             = 'node ./node_modules/mcdev/lib/index.js';
const debug             = false;//true;
const configFilePath    = '/tmp/.mcdevrc.json'
const metadataFilePath  = '/tmp/mcmetadata.json';

const mainBranch        = process.env.main_branch;
const envId             = process.env.envId;
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
 * Checks out the source repository.
 * @param {*} mainBranch 
 */
function checkoutSrc(mainBranch) {
    execCommand("Cloning and checking out the main branch " + mainBranch, 
                "cd /tmp && copado-git-get \""  + mainBranch + "\"", 
                "Completed cloning/checking out main branch");
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
 * Retrieve components into a clean retrieve folder.
 * The retrieve folder is deleted before retrieving to make
 * sure we have only components that really exist in the BU.
 * @param {*} retrieveFolder 
 * @param {*} bu 
 */
function retrieveComponents(retrieveFolder, sourceBU) {
    const retrievePath = join('/tmp', retrieveFolder, sourceBU);
    let retrievePathFixed = retrievePath;
    if ( retrievePath.endsWith('/') || retrievePath.endsWith('\\') ) {
        retrievePathFixed = retrievePath.substring(0, retrievePath.length - 1);
    }
    logInfo("Delete retrieve folder " + retrievePathFixed);
    rmSync(retrievePathFixed, { recursive: true, force: true });
    execCommand("Retrieve components from " + sourceBU, 
                "cd /tmp && " + mcdev + " retrieve " + sourceBU + " --skipInteraction",
                "Completed retrieving components");
}

/**
 * After components have been retrieved,
 * find all retrieved components and build a json containing as much
 * metadata as possible.
 * @param {*} retrieveFolder 
 * @param {*} sourceBU 
 * @param {*} metadataFilePath
 */
function createMetadataFile(retrieveFolder, sourceBU, metadataFilePath) {
    const retrievePath = join('/tmp', retrieveFolder, sourceBU);
    let retrievePathFixed = retrievePath;
    if ( retrievePath.endsWith('/') || retrievePath.endsWith('\\') ) {
        retrievePathFixed = retrievePath.substring(0, retrievePath.length - 1);
    }
    const metadataJson = [];
    buildMetadataJson(retrievePathFixed, sourceBU, metadataJson);
    const metadataString = JSON.stringify(metadataJson);
    //logDebug('Metadata JSON is: ' + metadataString);
    writeFileSync(metadataFilePath, metadataString);    
}

/**
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
 * Build the metadata JSON for a automation component
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
 * Build the metadata JSON for a data extension component
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
 * Finally, attach the resulting metadata JSON.
 * @param {*} metadataFilePath
 */
function attachJson(metadataFilePath) {
    execCommand("Attach JSON " + metadataFilePath, 
                "cd /tmp && copado --uploadfile \"" + metadataFilePath + "\" --parentid \"" + envId + "\"",
                "Completed attaching JSON");
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
logDebug(`branch            = ${mainBranch}`);
logDebug(`envId             = ${envId}`);

logInfo("")
logInfo("Clone repository")
logInfo("================")
logInfo("")
checkoutSrc(mainBranch);

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
retrieveComponents(retrieveFolder, sourceBU);

logInfo("")
logInfo("Build metadata JSON")
logInfo("===================")
logInfo("")
createMetadataFile(retrieveFolder, sourceBU, metadataFilePath);

logInfo("")
logInfo("Attach JSON")
logInfo("===========")
logInfo("")
attachJson(metadataFilePath);
