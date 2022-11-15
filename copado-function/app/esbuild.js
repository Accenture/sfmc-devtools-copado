/* eslint-disable unicorn/prefer-top-level-await */
const esbuild = require('esbuild');
const path = require('node:path');
const { esbuildPluginVersionInjector } = require('esbuild-plugin-version-injector');

(async () => {
    // console.log(process.cwd());
    // console.log(path.resolve(__dirname));
    let result;
    try {
        result = await esbuild.build({
            entryPoints: ['Retrieve.fn.js', 'Commit.fn.js', 'Deploy.fn.js', 'McdevInit.fn.js'],
            bundle: true,
            platform: 'node',
            external: ['../tmp/*'],
            preserveSymlinks: true,
            outdir: '../dist',
            absWorkingDir: path.resolve(__dirname),
            metafile: true,
            plugins: [esbuildPluginVersionInjector()],
            target: ['es2020', 'node14.16'],
        });
    } catch (ex) {
        console.error('Build failed:', ex.message); // eslint-disable-line no-console
        process.exitCode = 1;
    }
    try {
        const analyzeText = await esbuild.analyzeMetafile(result.metafile);
        console.log(analyzeText); // eslint-disable-line no-console
    } catch (ex) {
        console.warn('Analyze failed:', ex.message); // eslint-disable-line no-console
    }
})();
