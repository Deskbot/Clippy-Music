const glob = require("glob");
const process = require("process");

const { stdout } = process;

const testFileDir = __dirname + "/src";

main();

function main() {
    const args = process.argv.slice(2); // ignore node command and file being ran

    // get files to be tested

    let files;

    if (args.length === 0) {
        files = getFiles(testFileDir);
    } else {
        files = [];
        for (const arg of args) {
            const targetPath = resolvePath(arg);
            files.push(targetPath, ...getFiles(targetPath));
        }
    }

    // test the chosen files
    testFiles(files);
}

function clearLastLine() {
    stdout.clearLine();
    stdout.cursorTo(0);
}

function escape(str, badChars) {
    if (badChars.includes("\\")) {
        str = str.replace("\\", "\\\\");
    }

    for (const badChar of badChars) {
        if (badChar === "\\") continue;
        str = str.replace(badChar, "\\" + badChar);
    }

    return str;
}

function getFiles(dir) {
    dir = escape(dir, ["*", "(", ")", "!", "?", "@", "[", "]", "^", "+"]);

    return glob.sync(`${dir}/**/*`, {
        dot: true,
        nodir: true
    });
}

function resolvePath(path) {
    // user has given a full path
    if (path[0] === "/") return path;

    // determine whether the path is relative to the user's working directory
    const fullyQualifiedPath = process.cwd() + "/" + path;
    if (fullyQualifiedPath.includes(__dirname)) return fullyQualifiedPath;

    // assume the path is relative to ./test/
    return __dirname + "/" + path;
}

function testFiles(files) {
    for (const file of files) {
        let failCount = 0;
        let passCount = 0;
        let relativeFilePath = file.replace(__dirname, "");
        let tests;

        try {
            tests = require(file);
        } catch (e) {
            console.error(e);
            console.log(`--- ${relativeFilePath} SKIPPED ---`);
            continue;
        }

        console.log(`--- ${relativeFilePath} START ---`);

        for (const testName in tests) {
            try {
                stdout.write(`    RUNNING ${testName}`);
                tests[testName]();
                passCount++;
                clearLastLine();
                console.log(`    PASS ${testName}`);
            } catch (e) {
                allPass = false;
                failCount++;
                clearLastLine();
                console.log(`    FAIL ${testName}\n`);
                console.error(e); // display the error to the user
            }
        }

        console.log(`--- ${passCount} pass, ${failCount} fail: ${relativeFilePath} ---`);
    }
}