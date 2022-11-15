/* eslint-disable unicorn/prefer-top-level-await */
const esbuild = require('esbuild');
const path = require('node:path');
(async () => {
    // console.log(process.cwd());
    // console.log(path.resolve(__dirname));
    let result;
    try {
        result = await esbuild.build({
            entryPoints: ['Retrieve.js', 'Commit.js', 'Deploy.js'],
            bundle: true,
            platform: 'node',
            external: ['../tmp/*'],
            preserveSymlinks: true,
            outdir: '../dist',
            absWorkingDir: path.resolve(__dirname),
            metafile: true,
        });
    } catch (ex) {
        console.error('Build failed:', ex.message);
        process.exitCode = 1;
    }
    try {
        const analyzeText = await esbuild.analyzeMetafile(result.metafile);
        console.log(analyzeText);
    } catch (ex) {
        console.warn('Analyze failed:', ex.message);
    }
})();
