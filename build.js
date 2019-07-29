const child_process = require('child_process');
const fs = require('fs');

main();

function main() {
    setUpOptions();
    runTsc();
}

function runTsc() {
    child_process.spawn(__dirname + '/node_modules/typescript/bin/tsc', { stdio: "inherit" });
}

function setUpOptions() {
    const optionsPath = __dirname + '/options.js';

    if (fs.existsSync(optionsPath)) return;

    console.log('Creating new options.js file from the default.');

    const defaultFilePath = __dirname + '/src/default_options.js';
    fs.copyFileSync(defaultFilePath, optionsPath);
}
