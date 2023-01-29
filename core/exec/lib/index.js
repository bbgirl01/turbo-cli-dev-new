"use strict";
const cp = require("child_process");
const path = require("path");
const Package = require("@turbo-cli-dev/package");
const log = require("@turbo-cli-dev/log");

module.exports = exec;

const SETTINGS = {
  // init: "@imooc-cli/init",
  init: "@turbo-cli-dev/core",
  // init: "turbo-test",
};
const CHCHE_DIR = "dependencies";

async function exec(name, options, cmdObj) {
  let targetPath = process.env.CLI_TARGET_PATH;
  const homePath = process.env.CLI_HOME_PATH;
  let storeDir = "";
  let pkg;
  log.verbose("targetPath", targetPath);
  log.verbose("homePath", homePath);

  const cmdName = cmdObj._name;
  const packageName = SETTINGS[cmdName];
  const packageVersion = "latest";

  if (!targetPath) {
    targetPath = path.resolve(homePath, CHCHE_DIR); // 生成缓存路径
    storeDir = path.resolve(targetPath, "node_modules");
    log.verbose("targetPath", targetPath);
    log.verbose("storeDir", storeDir);

    pkg = new Package({
      targetPath,
      storeDir,
      packageName,
      packageVersion,
    });

    if (await pkg.exists()) {
      // 更新package
      // console.log("update");
      pkg.update();
    } else {
      // 安装package
      await pkg.install();
    }
    // console.log("exec", pkg, pkg.getRootFilePath());
  } else {
    pkg = new Package({
      targetPath,
      packageName,
      packageVersion,
    });
  }

  // console.log(pkg, await pkg.exists());
  const rootFile = pkg.getRootFilePath();
  // console.log("rootFile", rootFile);
  if (rootFile) {
    try {
      // 在当前进程中调用
      // require(rootFile).call(null, Array.from(arguments))
      // 在node子进程中调用
      const argv = Array.from(arguments).slice(0, arguments.length - 1);
      const code = `require('${rootFile}').call(null, ${JSON.stringify(argv)})`;
      // windows环境
      // cp.spawn("cmd", ["/c", "node", "-e", code]);
      const child = spawn("node", ["-e", code], {
        cwd: process.cwd(),
        stdio: "inherit",
      });
      child.on("error", (e) => {
        log.error(e.message);
        process.exist(1);
      });
      child.on("exit", (e) => {
        // log.verbose("命令执行成功:" + e);
        process.exit(e);
      });
      // child.stdout.on("data", (chunk) => {});
      // child.stderr.on("data", (chunk) => {});
    } catch (e) {
      log.error(e.message);
    }
  }
}

function spawn(command, args, options) {
  const win32 = process.platform === "win32";
  const cmd = win32 ? "cmd" : command;
  const cmdArgs = win32 ? ["/c"].concat(command, args) : args;

  return cp.spawn(cmd, cmdArgs, options || {});
}
