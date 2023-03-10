"use strict";

module.exports = core;
const path = require("path");
const semver = require("semver");
const colors = require("colors");
const userHome = require("user-home");
const pathExists = require("path-exists").sync;
const commander = require("commander");
const pkg = require("../package.json");
const log = require("@turbo-cli-dev/log");
const init = require("@turbo-cli-dev/init");
const exec = require("@turbo-cli-dev/exec");
const constant = require("./const");

const program = new commander.Command();
let args, config;

async function core() {
  try {
    await prepare();
    registerCommand();
  } catch (e) {
    log.error(e.message);
    if (process.env.LOG_LEVEL === "verbose" || program.debug) {
      console.log(e);
    }
  }
}

// 命令注册
function registerCommand() {
  program
    .name(Object.keys(pkg.bin)[0] + 1)
    .usage("<command> <options>")
    .version(pkg.version)
    .option("-d, --debug", "是否开启调试模式", false)
    .option("-tp, --targetPath <targetPath>", "是否指定本地调试文件路径", "");

  program
    .command("init [projectName]")
    .option("-f, --force", "是否强制初始化项目")
    .action(exec);

  // 开启debug模式
  program.on("option:debug", function () {
    const options = program.opts();
    if (options.debug) {
      process.env.LOG_LEVEL = "verbose";
    } else {
      process.env.LOG_LEVEL = "info";
    }
    log.level = process.env.LOG_LEVEL;
  });

  // 指定targetPath
  program.on("option:targetPath", function () {
    // console.log("targetPath", program.opts());
    const options = program.opts();
    // if (options.targetPath) {
    process.env.CLI_TARGET_PATH = options.targetPath;
    // }
  });

  // 对未知命令的监听
  program.on("command:*", function (obj) {
    const availableCommand = program.commands.map((cmd) => cmd.name());
    console.log("未知的命令：", obj[0]);
    if (availableCommand.length > 0) {
      console.log("可用的命令：", availableCommand.join(","));
    }
  });

  program.parse(process.argv);

  if (program.args && program.args.length < 1) {
    // 打印帮助文档
    program.outputHelp();
  }
}

// 准备阶段
async function prepare() {
  checkPkgVersion();
  // checkNodeVersion();

  // -------- 此处还未完成
  // checkRoot();
  checkUserHome();
  checkEnv();
  // await checkGlobalUpdate();
  // -------- 此处还未完成
}

async function checkGlobalUpdate() {
  // 1. 获取当前版本号和模块名
  const currentVersion = pkg.version;
  const npmName = pkg.name;

  // 2. 调用npm API，获取所有版本号 https://registry.npmjs.org/turbo-test
  // 3. 提取所有的版本号，比对那些版本号是大于当前版本号
  // 4. 获取最新的版本号，提示用户更新到该版本号

  const { getNpmSemverVersion } = require("@imooc-cli-dev/get-npm-info");
  const lastVersion = await getNpmSemverVersion(currentVersion, npmName);
  if (lastVersion && semver.gt(lastVersion, currentVersion)) {
    log.warn(
      colors.yellow(`请手动更新 ${npmName}, 当前版本：${currentVersion}，最新版本：${lastVersion}
    更新命令：npm install -g ${npmName}`)
    );
  }
}

function checkEnv() {
  const dotenv = require("dotenv");
  const dotenvPath = path.resolve(userHome, ".env");
  if (pathExists(dotenvPath)) {
    config = dotenv.config({
      path: dotenvPath,
    });
  }
  createDefaultConfig();
}

function createDefaultConfig() {
  const cliConfig = {
    home: userHome,
  };
  if (process.env.CLI_HOME) {
    cliConfig["cliHome"] = path.join(userHome, process.env.CLI_HOME);
  } else {
    cliConfig["cliHome"] = path.join(userHome, constant.DEFAULT_CLI_HOME);
  }

  process.env.CLI_HOME_PATH = cliConfig.cliHome;
}

function checkUserHome() {
  if (!userHome || !pathExists(userHome)) {
    throw new Error(colors.red("当前登录用户主目录不存在！"));
  }
}

function checkRoot() {
  const rootCheck = require("root-check");
  rootCheck();
}

function checkPkgVersion() {
  log.info("cli", pkg.version);
  // log.success("test", "success...");
  // log.verbose("debug", "debug...");
}
