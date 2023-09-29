#!/usr/bin/env node

/*
 * mcdev-copado v2.0.0 (built 2023-09-29T12:01:32.664Z)
 * Function: Retrieve.fn.js
 * Dependenies: mcdev@>=6.0.0, Copado Deployer@20.1
 * Homepage: https://github.com/Accenture/sfmc-devtools-copado#readme
 * Support: https://github.com/Accenture/sfmc-devtools-copado/issues
 * Git-Repository: https://github.com/Accenture/sfmc-devtools-copado.git
 * Copyright (c) 2023 Accenture. MIT licensed
*/



// Retrieve.fn.js
import fs3 from "fs";
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

// Retrieve.fn.js
import mcdev2 from "mcdev";
import Definition from "mcdev/lib/MetadataTypeDefinitions.js";
import MetadataType from "mcdev/lib/MetadataTypeInfo.js";
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
Config_default.source_sfid = process.env.source_sfid;
Config_default.commitMessage = null;
Config_default.featureBranch = null;
Config_default.fileSelectionSalesforceId = null;
Config_default.fileSelectionFileName = null;
Config_default.recreateFeatureBranch = null;
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
  Log_default.info("Retrieve.js started");
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
    throw new Error(`No credentials`);
  }
  Log_default.debug("Credentials found for source BU");
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
    Copado_default.checkoutSrc(Config_default.mainBranch);
  } catch (ex) {
    Log_default.error("Cloning failed:" + ex.message);
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
  let metadataJson;
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
    Log_default.progress("Retrieving components");
    Log_default.info("===================");
    Log_default.info("");
    metadataJson = await Retrieve.retrieveChangelog(sourceBU);
  } catch (ex) {
    Log_default.error("Retrieving failed: " + ex.message);
    Copado_default.uploadToolLogs();
    throw ex;
  }
  try {
    Log_default.info("");
    Log_default.info("Saving metadata JSON to disk");
    Log_default.info("===================");
    Log_default.info("");
    Util_default.saveJsonFile(Config_default.metadataFilePath, metadataJson);
  } catch (ex) {
    Log_default.error("Saving metadata JSON failed:" + ex.message);
    throw ex;
  }
  try {
    Log_default.info("");
    Log_default.info("Attach JSON");
    Log_default.info("===================");
    Log_default.info("");
    Copado_default.attachJson(
      Config_default.metadataFilePath,
      Config_default.source_sfid,
      false,
      "Loading items into Copado"
    );
  } catch (ex) {
    Log_default.error("Attaching JSON file failed:" + ex.message);
    throw ex;
  }
  Log_default.result(`Found ${metadataJson.length} items on server`, "Refresh done");
  Log_default.info("");
  Log_default.info("===================");
  Log_default.info("");
  Log_default.info("Retrieve.js done");
  Copado_default.uploadToolLogs();
}
var Retrieve = class {
  /**
   * Determines the retrieve folder from MC Dev configuration (.mcdev.json)
   * TODO: replace by simply requiring the config file
   *
   * @returns {string} retrieve folder
   */
  static getRetrieveFolder() {
    if (!fs3.existsSync(Config_default.configFilePath)) {
      throw new Error("Could not find config file " + Config_default.configFilePath);
    }
    const config = JSON.parse(fs3.readFileSync(Config_default.configFilePath, "utf8"));
    const directories = config["directories"];
    if (null == directories) {
      throw new Error("Could not find directories in " + Config_default.configFilePath);
    }
    const folder = directories["retrieve"];
    if (null == folder) {
      throw new Error("Could not find directories/retrieve in " + Config_default.configFilePath);
    }
    Log_default.debug("Retrieve folder is: " + folder);
    return folder;
  }
  /**
   * Retrieve components into a clean retrieve folder.
   * The retrieve folder is deleted before retrieving to make
   * sure we have only components that really exist in the BU.
   *
   * @param {string} sourceBU specific subfolder for downloads
   * @returns {object} changelog JSON
   */
  static async retrieveChangelog(sourceBU) {
    if (!Config_default.debug) {
      mcdev2.setLoggingLevel({ silent: true });
    }
    mcdev2.setSkipInteraction(true);
    const customDefinition = {
      automation: {
        keyField: "CustomerKey",
        nameField: "Name",
        createdDateField: "CreatedDate",
        createdNameField: "CreatedBy",
        lastmodDateField: "LastSaveDate",
        lastmodNameField: "LastSavedBy"
      }
    };
    const retrieve = await mcdev2.retrieve(sourceBU, ["user"], null, true);
    if (!retrieve) {
      throw new Error("Could not retrieve User List");
    }
    const userList = retrieve.user;
    for (const key of Object.keys(userList)) {
      userList[userList[key].ID] = userList[key].Name;
      delete userList[key];
    }
    const changelogList = await mcdev2.retrieve(sourceBU, null, null, true);
    const allMetadata = [];
    Object.keys(changelogList).map((type) => {
      if (changelogList[type]) {
        const def = customDefinition[type] || Definition[type];
        allMetadata.push(
          ...Object.keys(changelogList[type]).map((key) => {
            const item = changelogList[type][key];
            const salesforceRegex = new RegExp(/(_Salesforce)(_[0-9])?$/gm);
            if (MetadataType[type].isFiltered(item, true) || MetadataType[type].isFiltered(item, false)) {
              return;
            }
            if (type === "dataExtension" && (this._getAttrValue(item, def.nameField).startsWith(
              "QueryStudioResults at "
            ) || salesforceRegex.test(this._getAttrValue(item, def.nameField)))) {
              return;
            }
            const listEntry = {
              n: this._getAttrValue(item, def.nameField),
              k: this._getAttrValue(item, def.keyField),
              p: this._getAttrValue(item, "r__folder_Path"),
              t: this._getAttrValue(item, "_subType") ? type + "-" + this._getAttrValue(item, "_subType") : type,
              cd: this._convertTimestamp(
                this._getAttrValue(item, def.createdDateField)
              ),
              cb: this._getUserName(userList, item, def.createdNameField),
              ld: this._convertTimestamp(
                // if no lastmodified date is provided, try showing the created date instead (problem on newly created automations)
                this._getAttrValue(item, def.lastmodDateField) !== "0001-01-01T00:00:00" ? this._getAttrValue(item, def.lastmodDateField) : this._getAttrValue(item, def.createdDateField)
              ),
              lb: this._getUserName(userList, item, def.lastmodNameField)
            };
            return listEntry;
          })
        );
      }
    });
    return allMetadata.filter((item) => void 0 !== item);
  }
  /**
   * converts timestamps provided by SFMCs API into a format that SF core understands
   *
   * @private
   * @param {string} iso8601dateTime 2021-10-16T15:20:41.990
   * @returns {string} 2021-10-16T15:20:41.990-06:00
   * //@returns {string} apexDateTime 2021-10-1615:20:41
   */
  static _convertTimestamp(iso8601dateTime) {
    if (!iso8601dateTime || iso8601dateTime === "0001-01-01T00:00:00") {
      return "-";
    }
    if (iso8601dateTime.split("-").length === 3) {
      iso8601dateTime += "-06:00";
    }
    return iso8601dateTime;
  }
  /**
   *
   * @private
   * @param {Object.<string, string>} userList user-id > user-name map
   * @param {Object.<string, string>} item single metadata item
   * @param {string} fieldname name of field containing the info
   * @returns {string} username or user id or 'n/a'
   */
  static _getUserName(userList, item, fieldname) {
    return userList[this._getAttrValue(item, fieldname)] || this._getAttrValue(item, fieldname) || "n/a";
  }
  /**
   * helps get the value of complex and simple field references alike
   *
   * @private
   * @param {TYPE.MetadataItem} obj one item
   * @param {string} key field key
   * @returns {string} value of attribute
   */
  static _getAttrValue(obj, key) {
    if (!key || !obj) {
      return null;
    }
    if (key.includes(".")) {
      const keys = key.split(".");
      const first = keys.shift();
      return this._getAttrValue(obj[first], keys.join("."));
    } else {
      return obj[key];
    }
  }
};
run();
