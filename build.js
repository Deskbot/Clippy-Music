const child_process = require('child_process');
const fs = require('fs');

main();

function main() {
    setUpOptions();
    runTsc();
}

function runTsc() {
    child_process.spawnSync(__dirname + '/node_modules/typescript/bin/tsc', { stdio: "inherit" });
}

function setUpOptions() {
    const optionsPath = __dirname + '/options.ts';

    if (fs.existsSync(optionsPath)) return;

    console.log('Creating new options.ts file from the default.');

    const defaultFilePath = __dirname + '/default_options.ts';
    fs.copyFileSync(defaultFilePath, optionsPath);
}
