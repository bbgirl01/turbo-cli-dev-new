"use strict";
const semver = require("semver");
const colors = require("colors");
const log = require("@turbo-cli-dev/log");
const { isObject } = require("@turbo-cli-dev/utils");

const LOWEST_NODE_VERSION = "12.0.0";

class Command {
  constructor(argv) {
    // console.log("Command constructor", argv);
    if (!argv) {
      throw new Error("参数不能为空!");
    }
    if (!Array.isArray(argv)) {
      throw new Error("参数必须为数组!");
    }
    if (argv.length < 1) {
      throw new Error("参数为空!");
    }
    this._argv = argv;
    let runner = new Promise((resolve, reject) => {
      let chain = Promise.resolve();
      chain = chain.then(() => this.checkNodeVersion());
      chain = chain.then(() => this.initArgs());
      chain = chain.then(() => this.init());
      chain = chain.then(() => this.exec());
      chain.catch((err) => {
        log.error(err.message);
      });
    });
  }

  initArgs() {
    // this._cmd = this._argv[this._argv.length - 1];
    this._cmd = this._argv[1];
    this._argv = this._argv.slice(0, this._argv.length - 1);
    // console.log("initArgs", this._cmd, this._argv);
  }

  checkNodeVersion() {
    // 第一步，获取当前node版本号
    const currentVersion = process.version;
    // 第二步，比对最低版本号
    const lowestNodeVersion = LOWEST_NODE_VERSION;
    if (!semver.gte(currentVersion, lowestNodeVersion)) {
      throw new Error(
        colors.red(`turbo-cli 需要安装 v${lowestNodeVersion}以上版本的 Nodejs`)
      );
    }
  }

  init() {
    throw new Error("init必须实现");
  }
  exec() {
    throw new Error("exec必须实现");
  }
}

module.exports = Command;
