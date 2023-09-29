#!/usr/bin/env node

/*
 * mcdev-copado v2.0.0 (built 2023-09-29T12:01:33.973Z)
 * Function: Commit.fn.js
 * Dependenies: mcdev@>=6.0.0, Copado Deployer@20.1
 * Homepage: https://github.com/Accenture/sfmc-devtools-copado#readme
 * Support: https://github.com/Accenture/sfmc-devtools-copado/issues
 * Git-Repository: https://github.com/Accenture/sfmc-devtools-copado.git
 * Copyright (c) 2023 Accenture. MIT licensed
*/



// Commit.fn.js
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

// Commit.fn.js
Config_default.mcdevCopadoVersion = "2.0.0";
Config_default.credentialNameSource = process.env.credentialNameSource;
Config_default.credentialNameTarget = null;
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
Config_default.commitMessage = process.env.commit_message;
Config_default.featureBranch = process.env.feature_branch;
Config_default.fileSelectionSalesforceId = process.env.metadata_file;
Config_default.fileSelectionFileName = "Copado Commit changes";
Config_default.recreateFeatureBranch = process.env.recreateFeatureBranch === "true" ? true : false;
Config_default.envVariables = {
  source: null,
  sourceChildren: null,
  destination: null,
  destinationChildren: null
};
Config_default.deltaPackageLog = null;
Config_default.destinationBranch = null;
Config_default.fileUpdatedSelectionSfid = null;
Config_default.git_depth = null;
Config_default.merge_strategy = null;
Config_default.promotionBranch = null;
Config_default.promotionName = null;
Config_default.target_mid = null;
async function run() {
  Log_default.info("Commit.js started");
  Log_default.debug("");
  Log_default.debug("Parameters");
  Log_default.debug("===================");
  try {
    Config_default.credentials = JSON.parse(Config_default.credentials);
  } catch (ex) {
    Log_default.error("Could not parse credentials");
    throw ex;
  }
  Util_default.convertEnvVariables(Config_default.envVariables);
  Log_default.debug(Config_default);
  if (!Config_default.credentials[Config_default.credentialNameSource]) {
    Log_default.error(`No credentials found for source (${Config_default.credentialNameSource})`);
    throw new Error(`No source credentials`);
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
  Log_default.info("");
  Log_default.info("Clone repository");
  Log_default.info("===================");
  Log_default.info("");
  try {
    Copado_default.checkoutSrc(Config_default.mainBranch);
    try {
      if (Config_default.recreateFeatureBranch) {
        Copado_default.deleteBranch(Config_default.featureBranch);
      }
    } catch (ex) {
      Log_default.warn("Delete feature branch failed:" + ex.message);
    }
    Copado_default.checkoutSrc(Config_default.featureBranch, true);
  } catch (ex) {
    Log_default.error("Checkout to feature and/or master branch failed:" + ex.message);
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
        "Copado has not registered any files selected for commit. Please go back and select at least one item in the Commit page."
      );
    }
  } catch (ex) {
    Log_default.error("Getting Commit-selection file failed:" + ex.message);
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
  let sourceBU;
  let gitAddArr;
  try {
    Log_default.info("");
    Log_default.info("Get source BU");
    Log_default.info("===================");
    Log_default.info("");
    sourceBU = Util_default.getBuName(Config_default.credentialNameSource, Config_default.source_mid);
  } catch (ex) {
    Log_default.error("Getting Source BU failed: " + ex.message);
    throw ex;
  }
  try {
    Log_default.info("");
    Log_default.info("Retrieve components");
    Log_default.info("===================");
    Log_default.info("");
    gitAddArr = await Commit_default.retrieveCommitSelection(sourceBU, commitSelectionArr);
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
    Copado_default.uploadToolLogs();
    throw ex;
  }
  try {
    Log_default.info("");
    Log_default.info("Commit");
    Log_default.info("===================");
    Log_default.info("");
    Commit_default.commit(gitAddArr);
    Log_default.info("Push");
    Log_default.info("===================");
    Util_default.push(Config_default.featureBranch);
  } catch (ex) {
    Log_default.error("git commit / push failed:" + ex.message);
    Copado_default.uploadToolLogs();
    throw ex;
  }
  Log_default.info("");
  Log_default.info("===================");
  Log_default.info("");
  Log_default.info("Commit.js done");
  Copado_default.uploadToolLogs();
}
run();
