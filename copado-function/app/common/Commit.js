'use strict';
const fs = require('node:fs');
const execSync = require('node:child_process').execSync;

const TYPE = require('../types/mcdev-copado.d');
const CONFIG = require('./Config');
const Log = require('./Log');
const Util = require('./Util');

/**
 * methods to handle interaction with the copado platform
 */
class Commit {
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
        // * dont use CONFIG.tempDir here to allow proper resolution of required package in VSCode
        const mcdev = require('../tmp/node_modules/mcdev/lib/');
        // ensure wizard is not started
        mcdev.setSkipInteraction(true);

        // limit to files that git believes need to be added
        commitSelectionArr = commitSelectionArr.filter((item) => item.a === 'add');
        // get list of types with their respective keys
        const typeKeyMap = {};
        for (const item of commitSelectionArr) {
            if (!typeKeyMap[item.t]) {
                typeKeyMap[item.t] = [];
            }
            const jObj = JSON.parse(item.j);
            typeKeyMap[item.t].push(jObj.newKey || jObj.key);
        }
        // get unique list of types that need to be retrieved
        const typeArr = [...new Set(commitSelectionArr.map((item) => item.t))];
        // download all types of which
        await mcdev.retrieve(sourceBU, typeKeyMap, null, false);
        const fileArr = (
            await Promise.all(
                typeArr.map((type) => {
                    const keyArr = [
                        ...new Set(
                            commitSelectionArr
                                .filter((item) => item.t === type)
                                .map((item) => {
                                    const jObj = JSON.parse(item.j);
                                    return jObj.newKey || jObj.key;
                                })
                        ),
                    ];
                    return mcdev.getFilesToCommit(sourceBU, type.split('-')[0], keyArr);
                })
            )
        ).flat();
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
        // Iterate all metadata components selected by user to commit

        for (const filePath of gitAddArr) {
            if (fs.existsSync(filePath)) {
                // Add this component to the Git index.
                Util.execCommand(null, ['git add "' + filePath + '"'], 'staged ' + filePath);
            } else {
                Log.warn('❌  could not find ' + filePath);
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
        // If the following command returns some output,
        // git commit must be executed. Otherwise there
        // are no differences between the components retrieved
        // from the org and selected by the user
        // and what is already in Git, so commit and push
        // can be skipped.
        const gitDiffArr = execSync('git diff --staged --name-only')
            .toString()
            .split('\n')
            .map((item) => item.trim())
            .filter((item) => !!item);
        Log.debug('Git diff ended with the result:');
        Log.debug(gitDiffArr);
        if (Array.isArray(gitDiffArr) && gitDiffArr.length) {
            Util.execCommand(
                'Committing changes to branch',
                ['git commit -n -m "' + CONFIG.commitMessage + '"'],
                'Completed committing'
            );
            const result = {
                committed: gitDiffArr,
                noChangesFound: originalSelection
                    .map((item) => item.replace(new RegExp('\\\\', 'g'), '/'))
                    .filter(
                        // ensure that "\\" in windows-paths get rewritten to forward slashes again for comparison
                        (item) => !gitDiffArr.includes(item)
                    ),
            };
            Log.result(
                result,
                `Committed ${
                    result.committed.filter((item) => item.endsWith('.json')).length
                } items with ${result.committed.length} files`
            );
        } else {
            Log.error(
                'Nothing to commit as all selected components have the same content as already exists in Git. ' +
                    JSON.stringify(originalSelection),
                'Nothing to commit'
            );
            throw new Error('Nothing to commit');
        }
    }
}
module.exports = Commit;
