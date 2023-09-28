#!/usr/bin/env node

/*
 * mcdev-copado v1.3.0 (built 2023-09-28T15:27:05.908Z)
 * Function: Deploy.fn.js
 * Dependenies: mcdev@file:../sfmc-devtools, Copado Deployer@20.1
 * Homepage: https://github.com/Accenture/sfmc-devtools-copado#readme
 * Support: https://github.com/Accenture/sfmc-devtools-copado/issues
 * Git-Repository: https://github.com/Accenture/sfmc-devtools-copado.git
 * Copyright (c) 2023 Accenture. MIT licensed
*/



// Deploy.fn.js
import fs4 from "fs";
import { execSync as execSync4 } from "child_process";
import { resolve } from "path";

// common/Config.js
var Config_default = {};

// common/Log.js
import { execSync } from "child_process";
var Log = class {
  /**
   * @param {string} msg your log message
   * @returns {void}
   */
  static debug(msg) {
    if (Config_default.debug) {
      console.log("DEBUG:", msg);
    }
  }
  /**
   * @param {string} msg your log message
   * @returns {void}
   */
  static warn(msg) {
    console.log("\u26A0", msg);
  }
  /**
   * @param {string} msg your log message
   * @returns {void}
   */
  static info(msg) {
    console.log(msg);
  }
  /**
   * update job execution / result record error fields & show progress
   *
   * @param {string} error your error details
   * @param {string} [msg] optional progress message
   * @returns {void}
   */
  static error(error, msg = "Error") {
    console.log("\u274C", error);
    error = JSON.stringify(error);
    msg = JSON.stringify(msg);
    execSync(`copado --error-message ${error} --progress ${msg}`);
  }
  /**
   * update job execution / result record result fields & show progress
   *
   * @param {string|object} json results of your execution
   * @param {string} [msg] optional progress message
   * @returns {void}
   */
  static result(json, msg = "Result attached") {
    if (typeof json !== "string") {
      json = JSON.stringify(json);
    }
    console.log("\u2705", json);
    json = JSON.stringify(`${msg}: ${json}`);
    msg = JSON.stringify(msg);
    execSync(`copado --result-data ${json} --progress ${msg}`);
  }
  /**
   * @param {string} msg your log message
   * @returns {void}
   */
  static progress(msg) {
    msg = JSON.stringify(msg);
    execSync(`copado --progress ${msg}`);
  }
};
var Log_default = Log;

// common/Util.js
import fs from "fs";
import { execSync as execSync2 } from "child_process";
import mcdev from "mcdev";
var Util = class _Util {
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
    fs.writeFileSync(localPath, jsonString, "utf8");
  }
  /**
   * Pushes after a successfull deployment
   *
   * @param {string} destinationBranch name of branch to push to
   * @returns {void}
   */
  static push(destinationBranch) {
    _Util.execCommand(
      `Pushing updates to ${destinationBranch} branch`,
      ['git push origin "' + destinationBranch + '"'],
      "Completed pushing branch"
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
      Log_default.progress(preMsg);
    }
    if (command && Array.isArray(command)) {
      command = command.join(" && ");
    }
    Log_default.debug("\u26A1 " + command);
    try {
      execSync2(command, { stdio: [0, 1, 2], stderr: "inherit" });
    } catch (ex) {
      Log_default.info(ex.status + ": " + ex.message);
      throw new Error(ex);
    }
    if (null != postMsg) {
      Log_default.debug("\u2714\uFE0F  " + postMsg);
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
      Log_default.progress(preMsg);
    }
    if (command && Array.isArray(command)) {
      command = command.join(" && ");
    }
    Log_default.debug("\u26A1 " + command);
    let exitCode = null;
    try {
      execSync2(command, { stdio: [0, 1, 2], stderr: "inherit" });
      exitCode = 0;
    } catch (ex) {
      Log_default.warn("\u274C  " + ex.status + ": " + ex.message);
      exitCode = ex.status;
      return exitCode;
    }
    if (null != postMsg) {
      Log_default.progress("\u2714\uFE0F  " + postMsg);
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
    mcdev.version();
  }
  /**
   * creates credentials file .mcdev-auth.json based on provided credentials
   *
   * @param {object} credentials contains source and target credentials
   * @returns {void}
   */
  static provideMCDevCredentials(credentials) {
    Log_default.info("Provide authentication");
    _Util.saveJsonFile(".mcdev-auth.json", credentials, true);
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
      if (key.endsWith("Children")) {
        envVariables[key] = _Util._convertEnvChildVars(envVariables[key]);
      } else {
        envVariables[key] = _Util._convertEnvVars(envVariables[key]);
      }
    });
  }
  /**
   * helper that converts the copado-internal format for "environment variables" into an object
   *
   * @param {TYPE.EnvVar[]} envVarArr -
   * @returns {Object.<string,string>} proper object
   */
  static _convertEnvVars(envVarArr) {
    if (!envVarArr) {
      return envVarArr;
    }
    if (typeof envVarArr === "string") {
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
   * @param {TYPE.EnvChildVar[]} envChildVarArr -
   * @returns {Object.<string,string>} proper object
   */
  static _convertEnvChildVars(envChildVarArr) {
    if (!envChildVarArr) {
      return envChildVarArr;
    }
    if (typeof envChildVarArr === "string") {
      envChildVarArr = JSON.parse(envChildVarArr);
    }
    const response = {};
    for (const item of envChildVarArr) {
      response[item.id] = _Util._convertEnvVars(item.environmentVariables);
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
    if (!fs.existsSync(Config_default.configFilePath)) {
      throw new Error("Could not find config file " + Config_default.configFilePath);
    }
    const config = JSON.parse(fs.readFileSync(Config_default.configFilePath, "utf8"));
    if (config.credentials[credName] && config.credentials[credName].businessUnits) {
      const myBuNameArr = Object.keys(config.credentials[credName].businessUnits).filter(
        (buName) => config.credentials[credName].businessUnits[buName] == mid
      );
      if (myBuNameArr.length === 1) {
        Log_default.debug("BU Name is: " + credName + "/" + myBuNameArr[0]);
        credBuName = credName + "/" + myBuNameArr[0];
      } else {
        throw new Error(`MID ${mid} not found for ${credName}`);
      }
    }
    return credBuName;
  }
};
var Util_default = Util;

// common/Copado.js
import fs2 from "fs";
import { exec } from "child_process";
var Copado = class _Copado {
  /**
   *
   * @param {object} credentials the credentials for the salesforce marketing cloud
   * @param {string }credentialName the credential name
   * @param {string} url the git remote URL
   */
  static mcdevInit(credentials, credentialName, url) {
    Util_default.execCommand(
      `Initializing mcdev: ${credentialName}, ${credentials[credentialName].client_id}", "${credentials[credentialName].client_secret}", "${credentials[credentialName].auth_url}", "${url}", ${credentials[credentialName].account_id}`,
      [
        `mcdev init --y.credentialName "${credentialName}" --y.client_id "${credentials[credentialName].client_id}" --y.client_secret "${credentials[credentialName].client_secret}" --y.auth_url "${credentials[credentialName].auth_url}" --y.gitRemoteUrl "${url}" --y.account_id ${credentials[credentialName].account_id} --y.downloadBUs "false" --y.gitPush "true"`
      ],
      "Mcdev initialized!"
    );
  }
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
    _Copado._attachFile(localPath, async, parentSfid, preMsg);
  }
  /**
   * Finally, attach the resulting metadata JSON. Always runs asynchronously
   *
   * @param {string} localPath where we stored the temporary json file
   * @returns {Promise.<void>} promise of log upload
   */
  static async attachLog(localPath) {
    _Copado._attachFile(localPath, true);
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
  static _attachFile(localPath, async = false, parentSfid, preMsg, postMsg = "Completed uploading file") {
    const command = `copado --uploadfile "${localPath}"` + (parentSfid ? ` --parentid "${parentSfid}"` : "");
    if (async) {
      Log_default.debug("\u26A1 " + command);
      try {
        exec(command);
      } catch (ex) {
        Log_default.info(ex.status + ": " + ex.message);
        throw new Error(ex);
      }
    } else {
      if (!preMsg) {
        preMsg = "Uploading file " + localPath;
        if (parentSfid) {
          preMsg += ` to ${parentSfid}`;
        }
      }
      Util_default.execCommand(preMsg, [command], postMsg);
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
      Util_default.execCommand(preMsg, `copado --downloadfiles "${fileSFID}"`, "Completed download");
    } else {
      throw new Error("fileSalesforceId is not set");
    }
  }
  /**
   * downloads & parses JSON file from Salesforce
   *
   * @param {string} fileSFID salesforce ID of the file to download
   * @param {string} fileName name of the file the download will be saved as
   * @param {string} [preMsg] optional message to display before uploading synchronously
   * @returns {TYPE.CommitSelection[]} commitSelectionArr
   */
  static getJsonFile(fileSFID, fileName, preMsg) {
    _Copado._downloadFile(fileSFID, preMsg);
    return JSON.parse(fs2.readFileSync(fileName, "utf8"));
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
    Util_default.execCommand(
      `Switching to ${workingBranch} branch`,
      [`copado-git-get ${createBranch ? "--create " : ""}"${workingBranch}"`],
      "Completed creating/checking out branch"
    );
  }
  /**
   * Deletes the remote feature branch
   *
   * @param {string} featureBranch branch that is going to be deleted
   * @returns {void}
   */
  static deleteBranch(featureBranch) {
    Util_default.execCommand(
      `Deleting branch ${featureBranch} on server`,
      [`git push origin --delete ${featureBranch}`],
      "Completed deleting server branch " + featureBranch
    );
    Util_default.execCommand(
      `Deleting branch ${featureBranch} locally`,
      [`git branch --delete --force ${featureBranch}`],
      "Completed deleting local branch " + featureBranch
    );
  }
  /**
   * to be executed at the very end
   *
   * @returns {Promise.<void>} promise of uploads
   */
  static async uploadToolLogs() {
    Log_default.debug("Getting mcdev logs");
    try {
      const logsAttached = [];
      for (const file of fs2.readdirSync("logs")) {
        Log_default.debug("- " + file);
        logsAttached.push(_Copado.attachLog("logs/" + file));
      }
      const response = await Promise.all(logsAttached);
      Log_default.debug("Attached mcdev logs");
      return response;
    } catch (ex) {
      Log_default.debug("attaching mcdev logs failed:" + ex.message);
    }
  }
};
var Copado_default = Copado;

// common/Commit.js
import fs3 from "fs";
import { execSync as execSync3 } from "child_process";
import mcdev2 from "mcdev";
var Commit = class {
  /**
   * Retrieve components into a clean retrieve folder.
   * The retrieve folder is deleted before retrieving to make
   * sure we have only components that really exist in the BU.
   *
   * @param {string} sourceBU specific subfolder for downloads
   * @param {TYPE.CommitSelection[]} commitSelectionArr list of items to be added
   * @returns {Promise.<string[]>} list of files to git add & commit
   */
  static async retrieveCommitSelection(sourceBU, commitSelectionArr) {
    mcdev2.setSkipInteraction(true);
    commitSelectionArr = commitSelectionArr.filter((item) => item.a === "add");
    const typeKeyMap = {};
    for (const item of commitSelectionArr) {
      if (!typeKeyMap[item.t]) {
        typeKeyMap[item.t] = [];
      }
      const jObj = JSON.parse(item.j);
      typeKeyMap[item.t].push(jObj.newKey || jObj.key);
    }
    const typeArr = [...new Set(commitSelectionArr.map((item) => item.t))];
    await mcdev2.retrieve(sourceBU, typeKeyMap, null, false);
    const fileArr = (await Promise.all(
      typeArr.map((type) => {
        const keyArr = [
          ...new Set(
            commitSelectionArr.filter((item) => item.t === type).map((item) => {
              const jObj = JSON.parse(item.j);
              return jObj.newKey || jObj.key;
            })
          )
        ];
        return mcdev2.getFilesToCommit(sourceBU, type.split("-")[0], keyArr);
      })
    )).flat();
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
    for (const filePath of gitAddArr) {
      if (fs3.existsSync(filePath)) {
        Util_default.execCommand(null, ['git add "' + filePath + '"'], "staged " + filePath);
      } else {
        Log_default.warn("\u274C  could not find " + filePath);
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
    const gitDiffArr = execSync3("git diff --staged --name-only").toString().split("\n").map((item) => item.trim()).filter((item) => !!item);
    Log_default.debug("Git diff ended with the result:");
    Log_default.debug(gitDiffArr);
    if (Array.isArray(gitDiffArr) && gitDiffArr.length) {
      Util_default.execCommand(
        "Committing changes to branch",
        ['git commit -n -m "' + Config_default.commitMessage + '"'],
        "Completed committing"
      );
      const result = {
        committed: gitDiffArr,
        noChangesFound: originalSelection.map((item) => item.replace(new RegExp("\\\\", "g"), "/")).filter(
          // ensure that "\\" in windows-paths get rewritten to forward slashes again for comparison
          (item) => !gitDiffArr.includes(item)
        )
      };
      Log_default.result(
        result,
        `Committed ${result.committed.filter((item) => item.endsWith(".json")).length} items with ${result.committed.length} files`
      );
    } else {
      Log_default.error(
        "Nothing to commit as all selected components have the same content as already exists in Git. " + JSON.stringify(originalSelection),
        "Nothing to commit"
      );
      throw new Error("Nothing to commit");
    }
  }
};
var Commit_default = Commit;

// Deploy.fn.js
import mcdev3 from "mcdev";
Config_default.mcdevCopadoVersion = "1.3.0";
Config_default.credentialNameSource = process.env.credentialNameSource;
Config_default.credentialNameTarget = process.env.credentialNameTarget;
Config_default.credentials = process.env.credentials;
Config_default.configFilePath = ".mcdevrc.json";
Config_default.debug = process.env.debug === "true" ? true : false;
Config_default.installMcdevLocally = process.env.installMcdevLocally === "true" ? true : false;
Config_default.mainBranch = process.env.main_branch;
Config_default.mcdevVersion = process.env.mcdev_version;
Config_default.metadataFilePath = "mcmetadata.json";
Config_default.source_mid = process.env.source_mid;
Config_default.tmpDirectory = "../tmp";
Config_default.source_sfid = null;
Config_default.commitMessage = null;
Config_default.featureBranch = null;
Config_default.recreateFeatureBranch = null;
Config_default.envVariables = {
  source: process.env.envVariablesSource,
  sourceChildren: process.env.envVariablesSourceChildren,
  destination: process.env.envVariablesDestination,
  destinationChildren: process.env.envVariablesDestinationChildren
};
Config_default.deltaPackageLog = "docs/deltaPackage/delta_package.md";
Config_default.destinationBranch = process.env.toBranch;
Config_default.fileSelectionFileName = "Copado Deploy changes";
Config_default.fileSelectionSalesforceId = process.env.metadata_file;
Config_default.fileUpdatedSelectionSfid = null;
Config_default.git_depth = 100;
Config_default.merge_strategy = process.env.merge_strategy;
Config_default.promotionBranch = process.env.promotionBranch;
Config_default.promotionName = process.env.promotionName;
Config_default.target_mid = process.env.target_mid;
Config_default.sourceProperties = process.env.sourceProperties;
Config_default.deployNTimes = process.env.deployNTimes === "true" ? true : false;
async function run() {
  Log_default.info("Deploy.js started");
  Log_default.debug("");
  Log_default.debug("Parameters");
  Log_default.debug("===================");
  try {
    Config_default.credentials = JSON.parse(Config_default.credentials);
  } catch (ex) {
    Log_default.error("Could not parse credentials");
    throw ex;
  }
  try {
    Config_default.sourceProperties = JSON.parse(Config_default.sourceProperties);
  } catch (ex) {
    Log_default.error("Could not parse sourceProperties");
    throw ex;
  }
  Util_default.convertEnvVariables(Config_default.envVariables);
  Config_default.sourceProperties = Util_default.convertSourceProperties(Config_default.sourceProperties);
  Config_default.source_mid = Config_default.sourceProperties.mid;
  Config_default.credentialNameSource = Config_default.sourceProperties.credential_name;
  Log_default.debug(Config_default);
  if (!Config_default.credentials[Config_default.credentialNameSource]) {
    Log_default.error(`No credentials found for source (${Config_default.credentialNameSource})`);
    throw new Error(`No source credentials`);
  }
  if (!Config_default.credentials[Config_default.credentialNameTarget]) {
    Log_default.error(`No credentials found for target (${Config_default.credentialNameTarget})`);
    throw new Error(`No target credentials`);
  }
  Log_default.debug("Environment");
  Log_default.debug("===================");
  if (Config_default.debug) {
    Util_default.execCommand(null, "npm --version", null);
    Util_default.execCommand(null, "node --version", null);
    Util_default.execCommand(null, "git version", null);
  }
  Log_default.debug(`Change Working directory to: ${Config_default.tmpDirectory}`);
  try {
    Util_default.execCommand(null, ["git config --global --add safe.directory /tmp"]);
  } catch {
    try {
      Util_default.execCommand(null, [
        "git config --global --add safe.directory " + resolve(Config_default.tmpDirectory)
      ]);
    } catch {
      Log_default.error("Could not set tmp directoy as safe directory");
    }
  }
  process.chdir(Config_default.tmpDirectory);
  Log_default.debug(process.cwd());
  try {
    Log_default.info("");
    Log_default.info("Clone repository");
    Log_default.info("===================");
    Log_default.info("");
    Copado_default.checkoutSrc(Config_default.promotionBranch);
    Copado_default.checkoutSrc(Config_default.mainBranch);
  } catch (ex) {
    Log_default.error("Cloning failed:" + ex.message);
    throw ex;
  }
  try {
    Log_default.info("");
    Log_default.info("Merge branch");
    Log_default.info("===================");
    Log_default.info("");
    Deploy.merge(Config_default.promotionBranch, Config_default.mainBranch);
  } catch (ex) {
    Log_default.error("Merge failed: " + ex.message);
    throw ex;
  }
  let commitSelectionArr;
  try {
    Log_default.info("");
    Log_default.info(
      `Add selected components defined in ${Config_default.fileSelectionSalesforceId} to metadata JSON`
    );
    Log_default.info("===================");
    Log_default.info("");
    commitSelectionArr = Copado_default.getJsonFile(
      Config_default.fileSelectionSalesforceId,
      Config_default.fileSelectionFileName,
      "Retrieving list of selected items"
    );
    if (!Array.isArray(commitSelectionArr) || commitSelectionArr.length === 0) {
      throw new Error(
        "Copado has not registered any files ready for deployment. Please check if you committed all files."
      );
    }
  } catch (ex) {
    Log_default.error("Getting Deploy-selection file failed:" + ex.message);
    throw ex;
  }
  try {
    Log_default.info("");
    Log_default.info("Preparing");
    Log_default.info("===================");
    Log_default.info("");
    Util_default.provideMCDevTools();
    Util_default.provideMCDevCredentials(Config_default.credentials);
  } catch (ex) {
    Log_default.error("initializing failed: " + ex.message);
    throw ex;
  }
  let deployFolder;
  try {
    Log_default.info("");
    Log_default.info("Determine deploy folder");
    Log_default.info("===================");
    Log_default.info("");
    deployFolder = Deploy.getDeployFolder();
  } catch (ex) {
    Log_default.error("getDeployFolder failed: " + ex.message);
    throw ex;
  }
  let sourceBU;
  let targetBU;
  try {
    Log_default.info("");
    Log_default.info("Create delta package");
    Log_default.info("===================");
    Log_default.info("");
    sourceBU = Util_default.getBuName(Config_default.credentialNameSource, Config_default.source_mid);
    targetBU = Util_default.getBuName(Config_default.credentialNameTarget, Config_default.target_mid);
  } catch (ex) {
    Log_default.error("Getting Source / Target BU failed: " + ex.message);
    throw ex;
  }
  try {
    Deploy.updateMarketLists(sourceBU, targetBU, Config_default.envVariables);
  } catch (ex) {
    Log_default.error("Updateing Market List failed: " + ex.message);
    throw ex;
  }
  try {
    if (await Deploy.createDeltaPackage(
      deployFolder,
      commitSelectionArr,
      sourceBU.split("/")[1]
    )) {
      Log_default.info("Deploy BUs");
      Log_default.info("===================");
      const deployResult = await Deploy.deployBU(targetBU);
      commitSelectionArr = Deploy.replaceMarketValues(commitSelectionArr);
      Deploy.replaceAssetKeys(targetBU, commitSelectionArr, deployResult);
    } else {
      throw new Error("No changes found. Nothing to deploy");
    }
  } catch (ex) {
    Log_default.error("Deploy failed: " + ex.message);
    Copado_default.uploadToolLogs();
    throw ex;
  }
  let gitDiffArr;
  let verificationText;
  try {
    gitDiffArr = await Deploy.retrieveAndCommit(targetBU, commitSelectionArr);
  } catch (ex) {
    verificationText = "Failed deploy verification, check BU on SFMC to verify manually. Git not updated with the changes on target BU";
    Log_default.warn(verificationText + ": " + ex.message);
    gitDiffArr = [];
  }
  let success = false;
  let i = 0;
  do {
    i++;
    try {
      Log_default.info("git-push changes");
      Log_default.info("===================");
      Util_default.push(Config_default.mainBranch);
      success = true;
    } catch (ex) {
      if (ex.message === `Error: Command failed: git push origin "${Config_default.mainBranch}"`) {
        Log_default.progress("Merging changes from parallel deployments");
        Util_default.execCommand(null, ['git fetch origin "' + Config_default.mainBranch + '"'], null);
        Util_default.execCommand(null, ["git reset --hard origin/" + Config_default.mainBranch], null);
        Util_default.execCommand(null, ['git merge "' + Config_default.promotionBranch + '"'], null);
      }
    }
  } while (!success && i <= 50);
  Log_default.info("");
  Log_default.info("===================");
  Log_default.info("");
  Log_default.info("Deploy.js done");
  Log_default.result(
    gitDiffArr,
    `Deployed ${gitDiffArr.filter((item) => item.endsWith(".json")).length} items with ${gitDiffArr.length} files` + (verificationText ? ` (${verificationText})` : "")
  );
  Copado_default.uploadToolLogs();
}
var Deploy = class _Deploy {
  /**
   * used to ensure our working directory is clean before checking out branches
   */
  static stashChanges() {
    Util_default.execCommand(null, [`git stash`], null);
  }
  /**
   * retrieve the new values into the targets folder so it can be commited later.
   *
   * @param {string} targetBU buname of source BU
   * @param {TYPE.CommitSelection[]} commitSelectionArr list of committed components based on user selection
   * @returns {string[]} gitDiffArr
   */
  static async retrieveAndCommit(targetBU, commitSelectionArr) {
    let gitAddArr;
    let gitDiffArr = [];
    try {
      Log_default.info(
        `Stashing changes made by mcdev.deploy() to avoid issues during branch checkout`
      );
      _Deploy.stashChanges();
      Log_default.info("Switch to source branch to add updates for target");
      Copado_default.checkoutSrc(Config_default.promotionBranch);
    } catch (ex) {
      Log_default.error("Switching failed:" + ex.message);
      throw ex;
    }
    try {
      Log_default.info("");
      Log_default.info("Retrieve components");
      Log_default.info("===================");
      Log_default.info("");
      gitAddArr = await Commit_default.retrieveCommitSelection(targetBU, commitSelectionArr);
    } catch (ex) {
      Log_default.error("Retrieving failed: " + ex.message);
      Copado_default.uploadToolLogs();
      throw ex;
    }
    try {
      Log_default.info("");
      Log_default.info("Add components in metadata JSON to Git history");
      Log_default.info("===================");
      Log_default.info("");
      Commit_default.addSelectedComponents(gitAddArr);
    } catch (ex) {
      Log_default.error("git add failed:" + ex.message);
      throw ex;
    }
    try {
      Log_default.info("");
      Log_default.info("Commit");
      Log_default.info("===================");
      Log_default.info("");
      const commitMsgLines = _Deploy.getCommitMessage(targetBU, commitSelectionArr);
      gitDiffArr = _Deploy.commit(commitMsgLines);
    } catch (ex) {
      Log_default.error("git commit failed:" + ex.message);
      throw ex;
    }
    try {
      Log_default.info("Switch back to main branch to allow merging promotion branch into it");
      Copado_default.checkoutSrc(Config_default.mainBranch);
    } catch (ex) {
      Log_default.error("Switching failed:" + ex.message);
      throw ex;
    }
    try {
      Log_default.info("Merge promotion into main branch");
      _Deploy.merge(Config_default.promotionBranch, Config_default.mainBranch);
    } catch (ex) {
      Log_default.error("Merge failed: " + ex.message);
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
    const gitDiffArr = execSync4("git diff --staged --name-only").toString().split("\n").map((item) => item.trim()).filter((item) => !!item);
    Log_default.debug("Git diff ended with the result:");
    Log_default.debug(gitDiffArr);
    if (Array.isArray(gitDiffArr) && gitDiffArr.length) {
      if (!Array.isArray(commitMsgLines)) {
        commitMsgLines = [Config_default.commitMessage];
      }
      const commitMsgParam = commitMsgLines.map((line) => '-m "' + line + '"').join(" ");
      Util_default.execCommand(
        "Committing changes",
        ["git commit -n " + commitMsgParam],
        "Completed committing"
      );
      Log_default.progress("Commit of target BU files completed");
    } else {
      Log_default.error(
        "Nothing to commit as all selected components have the same content as already exists in Git.",
        "Nothing to commit"
      );
      throw new Error("Nothing to commit");
    }
    return gitDiffArr;
  }
  /**
   * helper for Deploy.retrieveAndCommit that creates a multi-line commit msg
   *
   * @param {string} targetBU name of BU we deployed to incl. credential name
   * @param {TYPE.CommitSelection[]} commitSelectionArr list of committed components based on user selection
   * @returns {string[]} commitMsgLines
   */
  static getCommitMessage(targetBU, commitSelectionArr) {
    const userStoryNames = [
      ...new Set(commitSelectionArr.map((item) => item.u).filter(Boolean))
    ].sort();
    const commitMsgLines = [
      Config_default.promotionName + ": " + userStoryNames.join(", "),
      `Updated BU "${targetBU}" (${Config_default.target_mid})`
    ];
    return commitMsgLines;
  }
  /**
   * convert CommitSelection[] to DeltaPkgItem[]
   *
   * @param {TYPE.CommitSelection[]} commitSelectionArr list of committed components based on user selection
   * @param {string} sourceBU buname of source BU
   * @returns {TYPE.DeltaPkgItem[]} format required by mcdev.createDeltaPkg
   */
  static _convertCommitToDeltaPkgItems(commitSelectionArr, sourceBU) {
    return commitSelectionArr.map(
      (item) => (
        /** @type {TYPE.DeltaPkgItem} */
        {
          type: item.t.split("-")[0],
          name: item.n,
          externalKey: JSON.parse(item.j).newKey || JSON.parse(item.j).key,
          gitAction: "add/update",
          _credential: Config_default.credentialNameSource,
          _businessUnit: sourceBU
        }
      )
    );
  }
  /**
   * Determines the deploy folder from MC Dev configuration (.mcdev.json)
   *
   * @returns {string} deploy folder
   */
  static getDeployFolder() {
    var _a;
    if (!fs4.existsSync(Config_default.configFilePath)) {
      throw new Error("Could not find config file " + Config_default.configFilePath);
    }
    const config = JSON.parse(fs4.readFileSync(Config_default.configFilePath, "utf8"));
    const folder = (_a = config == null ? void 0 : config.directories) == null ? void 0 : _a.deploy;
    if (!folder) {
      throw new Error("Could not find config.directories.deploy in " + Config_default.configFilePath);
    }
    Log_default.debug("Deploy folder is: " + folder);
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
    const deploySourceList = "deployment-source";
    const deployTargetList = "deployment-target";
    const config = JSON.parse(fs4.readFileSync(Config_default.configFilePath, "utf8"));
    config.options.deployment.sourceTargetMapping = {};
    config.options.deployment.sourceTargetMapping[deploySourceList] = deployTargetList;
    config.markets = {};
    if (Config_default.deployNTimes) {
      if (Object.keys(Config_default.envVariables.sourceChildren).length !== 1) {
        throw new Error(
          'Expected exactly one source child BU when "deployNTimes" is active in pipeline but found ' + Object.keys(Config_default.envVariables.sourceChildren).length
        );
      }
      for (const childSfid in Config_default.envVariables.sourceChildren) {
        config.markets[childSfid] = Config_default.envVariables.sourceChildren[childSfid];
      }
      for (const childSfid in Config_default.envVariables.destinationChildren) {
        config.markets[childSfid] = Config_default.envVariables.destinationChildren[childSfid];
      }
    } else {
      config.markets["source"] = marketVariables.source;
      config.markets["target"] = marketVariables.destination;
    }
    config.marketList = {};
    for (const listName of [deploySourceList, deployTargetList]) {
      config.marketList[listName] = {};
    }
    if (Config_default.deployNTimes) {
      config.marketList[deploySourceList][sourceBU] = Object.keys(
        Config_default.envVariables.sourceChildren
      )[0];
      config.marketList[deployTargetList][targetBU] = Object.keys(
        Config_default.envVariables.destinationChildren
      );
    } else {
      config.marketList[deploySourceList][sourceBU] = "source";
      config.marketList[deployTargetList][targetBU] = "target";
    }
    Log_default.debug("config.options.deployment.sourceTargetMapping");
    Log_default.debug(config.options.deployment.sourceTargetMapping);
    Log_default.debug("config.markets");
    Log_default.debug(config.markets);
    Log_default.debug("config.marketList");
    Log_default.debug(JSON.stringify(config.marketList));
    try {
      fs4.renameSync(Config_default.configFilePath, Config_default.configFilePath + ".BAK");
      Util_default.saveJsonFile(Config_default.configFilePath, config, "utf8");
    } catch (ex) {
      Log_default.error("Updating updateMarketLists failed: " + ex.message);
      throw ex;
    }
  }
  /**
   * Create the delta package containing the changed components
   * return whether the delta package is empty or not
   *
   * @param {string} deployFolder path
   * @param {TYPE.CommitSelection[]} commitSelectionArr list of committed components based on user selection
   * @param {string} sourceBU buname of source BU
   * @returns {Promise.<boolean>} true: files found, false: not
   */
  static async createDeltaPackage(deployFolder, commitSelectionArr, sourceBU) {
    mcdev3.setSkipInteraction(true);
    const versionRange = null;
    let deltaPkgItems = null;
    if (Array.isArray(commitSelectionArr) && commitSelectionArr.length) {
      deltaPkgItems = this._convertCommitToDeltaPkgItems(commitSelectionArr, sourceBU);
      Log_default.info(`Found ${deltaPkgItems.length} changed components in commits`);
      Log_default.debug("DeltaPkgItems: ");
      Log_default.debug(deltaPkgItems);
    } else {
      Log_default.info("No changed components found in commits");
    }
    const deltaPackageLog = await mcdev3.createDeltaPkg({
      range: versionRange,
      diffArr: deltaPkgItems
    });
    Log_default.debug("deltaPackageLog: " + JSON.stringify(deltaPackageLog));
    if (!(deltaPackageLog == null ? void 0 : deltaPackageLog.length)) {
      Log_default.error("No changes found for deployment");
      return false;
    } else {
      Log_default.debug("deltaPackageLog:");
      Log_default.debug(deltaPackageLog);
    }
    Log_default.debug("Completed creating delta package");
    if (fs4.existsSync(Config_default.deltaPackageLog)) {
      Copado_default.attachLog(Config_default.deltaPackageLog);
    }
    if (fs4.existsSync(deployFolder)) {
      const deltaPackageFiles = fs4.readdirSync(deployFolder);
      if (null != deltaPackageFiles) {
        Log_default.debug("Found " + deltaPackageFiles.length + " files to deploy");
        if (0 < deltaPackageFiles.length) {
          return true;
        }
      } else {
        Log_default.debug("Could not find any files to deploy in folder " + deployFolder);
      }
    } else {
      Log_default.debug("Could not find deploy folder " + deployFolder);
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
    if (branch.startsWith("release/")) {
      configBranch = "release/*";
    } else if (branch.startsWith("hotfix/")) {
      configBranch = "hotfix/*";
    }
    Log_default.debug("Config branch for branch " + branch + " is " + configBranch);
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
    mcdev3.setSkipInteraction(true);
    const deployResult = await mcdev3.deploy(bu);
    if (process.exitCode === 1) {
      throw new Error(
        "Deployment of BU " + bu + " failed. Please check the SFMC DevTools logs for more details."
      );
    }
    return deployResult;
  }
  /**
   *
   * @param {string} bu name of BU
   * @param {TYPE.CommitSelection[]} commitSelectionArr list of committed components based on user selection
   * @param {object} deployResult result of deployment
   * @returns {void}
   */
  static replaceAssetKeys(bu, commitSelectionArr, deployResult) {
    const commitSelectionArrMap = [];
    for (const i in commitSelectionArr) {
      if (commitSelectionArr[i].t.split("-")[0] === "asset") {
        const suffix = "-" + Config_default.target_mid;
        const jObj = JSON.parse(commitSelectionArr[i].j);
        const oldKey = jObj.newKey || jObj.key;
        const newKey = Config_default.source_mid === Config_default.target_mid || oldKey.endsWith(suffix) ? oldKey : oldKey.slice(0, Math.max(0, 36 - suffix.length)) + suffix;
        if (deployResult[bu].asset[newKey]) {
          jObj.newKey = newKey;
          commitSelectionArr[i].j = JSON.stringify(jObj);
          commitSelectionArrMap.push(jObj);
        } else {
          throw new Error(
            `New key for ${commitSelectionArr[i].n} does not match any valid keys.`
          );
        }
      }
    }
    Util_default.saveJsonFile(`Copado Deploy changes-${Config_default.target_mid}.json`, commitSelectionArr);
    Copado_default.attachJson(`Copado Deploy changes-${Config_default.target_mid}.json`, null, true);
  }
  /**
   * Merge from branch into target branch
   *
   * @param {string} promotionBranch commit id to merge
   * @param {string} currentBranch should be master in most cases
   * @returns {void}
   */
  static merge(promotionBranch, currentBranch) {
    Util_default.execCommand(
      `Merge ${promotionBranch} into ${currentBranch}`,
      ['git merge "' + promotionBranch + '"'],
      "Completed merging commit"
    );
  }
  /**
   * applies market values of target onto name and key of commitSelectionArr
   *
   * @param {TYPE.CommitSelection[]} commitSelectionArr list of items to be added
   * @returns {void}
   */
  static replaceMarketValues(commitSelectionArr) {
    Log_default.debug("replacing market values");
    const commitSelectionArrNew = [];
    const replaceMapList = [];
    if (Config_default.deployNTimes) {
      for (const sfid in Config_default.envVariables.destinationChildren) {
        const replaceMap = {};
        const sourceSfid = Object.keys(Config_default.envVariables.sourceChildren)[0];
        for (const item in Config_default.envVariables.sourceChildren[sourceSfid]) {
          if (typeof Config_default.envVariables.destinationChildren[sfid][item] !== "undefined") {
            replaceMap[Config_default.envVariables.sourceChildren[sourceSfid][item]] = Config_default.envVariables.destinationChildren[sfid][item];
          }
        }
        replaceMapList.push(replaceMap);
      }
    } else {
      const replaceMap = {};
      for (const item in Config_default.envVariables.source) {
        if (typeof Config_default.envVariables.destination[item] !== "undefined") {
          replaceMap[Config_default.envVariables.source[item]] = Config_default.envVariables.destination[item];
        }
      }
      replaceMapList.push(replaceMap);
    }
    for (const replaceMap of replaceMapList) {
      const commitSelectionArrClone = JSON.parse(JSON.stringify(commitSelectionArr));
      for (const item of commitSelectionArrClone) {
        for (const oldValue in replaceMap) {
          item.n = item.n.replace(new RegExp(oldValue, "g"), replaceMap[oldValue]);
          const jObj = JSON.parse(item.j);
          jObj.newKey = (jObj.newKey || jObj.key).replace(
            new RegExp(oldValue, "g"),
            replaceMap[oldValue]
          );
          item.j = JSON.stringify(jObj);
        }
      }
      commitSelectionArrNew.push(...commitSelectionArrClone);
    }
    return commitSelectionArrNew;
  }
};
run();
