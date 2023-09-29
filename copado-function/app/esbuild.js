/* eslint-disable unicorn/prefer-top-level-await */
'use strict';

import * as esbuild from 'esbuild';
import path from 'node:path';
import { esbuildPluginVersionInjector } from 'esbuild-plugin-version-injector';

// import just to resolve cyclical - TO DO consider if could move to file or context
import { readJsonSync } from 'fs-extra/esm';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const eslintrc = readJsonSync(path.join(__dirname, './.eslintrc.json'));
const packageJson = readJsonSync(path.join(__dirname, '../../package.json'));

const args = process.argv.slice(2);
const isWatch = args.includes('--watch');

(async () => {
    // console.log(process.cwd());
    // console.log(path.resolve(__dirname));
    // let result;
    const ecmaVersion = 'es' + eslintrc.parserOptions.ecmaVersion;
    const nodeVersion = 'node' + packageJson.engines.node.replace('>=', '');
    const peerDependencies = Object.keys(packageJson.peerDependencies).map(
        (name) => name + '@' + packageJson.peerDependencies[name]
    );
    const copadoDependencies = Object.keys(packageJson.copadoDependencies).map(
        (name) => name + '@' + packageJson.copadoDependencies[name]
    );
    peerDependencies.push(...copadoDependencies);
    const absWorkingDir = path.resolve(__dirname);
    const plugins = [
        {
            name: 'my-plugin',
            /**
             *
             * @param {any} build -
             */
            setup(build) {
                build.onEnd((result) => {
                    onRebuild(result);
                });
            },
        },
    ];
    for (const entryPoint of ['Retrieve.fn.js', 'Commit.fn.js', 'Deploy.fn.js', 'Init.fn.js']) {
        const buildOptions = {
            entryPoints: [entryPoint],
            bundle: true,
            banner: {
                js:
                    `\n/*\n * ${packageJson.name} v${
                        packageJson.version
                    } (built ${new Date().toISOString()})\n` +
                    ` * Function: ${entryPoint}\n` +
                    ` * Dependenies: ${peerDependencies.join(', ')}\n` +
                    ` * Homepage: ${packageJson.homepage}\n` +
                    ` * Support: ${packageJson.bugs.url}\n` +
                    ` * Git-Repository: ${packageJson.repository.url}\n` +
                    ` * Copyright (c) ${new Date().getFullYear()} Accenture. ${
                        packageJson.license
                    } licensed\n` +
                    '*/\n\n',
            },
            platform: 'node',
            external: ['../tmp/*', 'mcdev', 'mcdev/*'],
            preserveSymlinks: true,
            outdir: '../dist',
            // outExtension: { '.js': '.cjs' },
            format: 'esm',
            absWorkingDir: absWorkingDir,
            metafile: true,
            plugins: [esbuildPluginVersionInjector()],
            target: [ecmaVersion, nodeVersion],
        };
        if (isWatch) {
            const ctx = await esbuild.context({ ...buildOptions, plugins });
            await ctx.watch();
            await ctx.dispose(); // To free resources
        } else {
            const result = await esbuild.build(buildOptions);
            onRebuild(result);
        }
    }
})();

/**
 *
 * @param {object} result ?
 */
function onRebuild(result) {
    try {
        esbuild.analyzeMetafile(result.metafile).then((analyzeText) => {
            console.log(analyzeText); // eslint-disable-line no-console
        });
    } catch (ex) {
        console.warn('Analyze failed:', ex.message); // eslint-disable-line no-console
    }
}
