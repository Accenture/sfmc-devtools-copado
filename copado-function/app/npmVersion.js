/* eslint-disable unicorn/prefer-top-level-await */
'use strict';

/**
 * helper class that wraps typical version release tasks into one script
 */

const execSync = require('node:child_process').execSync;

const args = process.argv.slice(2);
const versionIncreaseType = args[0];

(async () => {
    if (!['major', 'minor', 'patch'].includes(versionIncreaseType)) {
        throw new Error(
            'Invalid version increase type. Please use one of: major, minor, patch (found: ' +
                versionIncreaseType +
                ')'
        );
    }
    // increase version in package.json and package-lock.json without creating a git commit or adding a git tag
    exec('npm version --no-git-tag-version ' + versionIncreaseType);

    // re-build the project to ensure the new versions are mentioned in the build
    exec('npm run build:docs');

    // stage changes
    exec('git add copado-function/dist/*');
    exec('git add package.json');
    exec('git add package-lock.json');

    // get the new version number
    const packageJson = require('../../package.json');
    const newVersion = packageJson.version;

    // commit changes without commit-hooks
    exec(`git commit -n -m "${newVersion}"`);

    exec('git tag -a v' + newVersion + ' -m "Release v' + newVersion + '"');
})();

/**
 * helper class that wraps showing the executed command and its output
 *
 * @param {string} command the cli command to execute synchronously
 */
function exec(command) {
    console.log('⚡ ' + command); // eslint-disable-line no-console
    execSync(command, {
        stdio: [0, 1, 2],
        stderr: 'inherit',
    });
}
