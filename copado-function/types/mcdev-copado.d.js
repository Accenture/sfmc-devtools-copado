/**
 * @typedef {object} MetadataItem
 * @property {string} n Name
 * @property {string} k Key (Customer Key / External Key)
 * @property {string} t metadata type
 * @property {string} [cd] created date
 * @property {string} [cb] created by name
 * @property {string} [ld] last modified date
 * @property {string} [lb] last modified by name
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
 * @property {string} [u] copado__User_Story__c.Name (US-00000101) only available during Deploy
 * @property {string} t type
 * @property {string} n name
 * @property {string} m ???
 * @property {string} j json string with exta info "{\"key\":\"test-joern-filter-de\"}"
 * @property {'sfmc'} c system
 * @property {'add'} a action
 */

/**
 * TYPES DEFINED BY mcdev. copied here for easier reference
 *
 * @typedef {'accountUser'|'asset'|'attributeGroup'|'automation'|'campaign'|'contentArea'|'dataExtension'|'dataExtensionField'|'dataExtensionTemplate'|'dataExtract'|'dataExtractType'|'discovery'|'email'|'emailSendDefinition'|'eventDefinition'|'fileTransfer'|'filter'|'folder'|'ftpLocation'|'importFile'|'interaction'|'list'|'mobileCode'|'mobileKeyword'|'query'|'role'|'script'|'setDefinition'|'triggeredSendDefinition'} SupportedMetadataTypes
 * @typedef {object} DeltaPkgItem
 * //@property {string} file relative path to file
 * //@property {number} changes changed lines
 * //@property {number} insertions added lines
 * //@property {number} deletions deleted lines
 * //@property {boolean} binary is a binary file
 * //@property {boolean} moved git thinks this file was moved
 * //@property {string} [fromPath] git thinks this relative path is where the file was before
 * @property {SupportedMetadataTypes} type metadata type
 * @property {string} externalKey key
 * @property {string} name name
 * @property {'move'|'add/update'|'delete'} gitAction what git recognized as an action
 * @property {string} _credential mcdev credential name
 * @property {string} _businessUnit mcdev business unit name inside of _credential
 */

module.exports = {};
