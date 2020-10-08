const child_process = require("child_process");
const fs = require("fs");

main();

function main() {
	setUpOptions();
	runTsc();
}

function runTsc() {
	child_process.spawnSync(__dirname + "/node_modules/typescript/bin/tsc", ["-i"], { stdio: "inherit" });
}

function setUpOptions() {
	const configPath = __dirname + "/config.ts";

	if (fs.existsSync(configPath)) return;

	console.log("Creating new config.ts file from the default.");

	const defaultFilePath = __dirname + "/default_config.ts";
	fs.copyFileSync(defaultFilePath, configPath);
}
