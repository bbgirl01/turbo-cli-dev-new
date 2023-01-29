"use strict";
const fs = require("fs");
const inquirer = require("inquirer");
const fse = require("fs-extra");
const semver = require("semver");
const Command = require("@turbo-cli-dev/command");
const log = require("@turbo-cli-dev/log");

const TYPE_PROJECT = "project";
const TYPE_COMPONENT = "component";

class InitCommand extends Command {
  init() {
    this.projectName = this._argv[0] || "";
    this.force = !!this._cmd.force;
    log.verbose("projectName", this.projectName);
    log.verbose("force", this.force);
  }

  async exec() {
    try {
      // 1，准备阶段
      const projectInfo = await this.prepare();
      if (ret) {
        console.log("projectInfo", projectInfo);
        // 2. 下载模版
        // 3. 安装模版
      }
    } catch (e) {
      log.error(e.message);
    }
  }

  async prepare() {
    // 1. 判断当前目录是否为空
    const localPath = process.cwd();
    if (!this.isDirEmpty(localPath)) {
      let ifContinue = false;
      if (!this.force) {
        // 不为空，询问是否继续创建
        ifContinue = (
          await inquirer.prompt({
            type: "confirm",
            name: "ifContinue",
            default: false,
            message: "当前文件夹不为空，是否继续创建项目？",
          })
        ).ifContinue;
        if (!ifContinue) {
          return;
        }
      }

      // 2. 是否启动强制更新
      if (ifContinue || this.force) {
        // 给用户做二次确认
        const { confirmDelete } = await inquirer.prompt({
          type: "confirm",
          name: "confirmDelete",
          default: false,
          message: "是否确认清空当前目录下的文件？",
        });

        if (confirmDelete) {
          // 清空当前目录
          console.log("二次确认删除");
          fse.emptyDirSync(localPath);
        }
      }
    }

    return await this.getProjectInfo();
  }

  async getProjectInfo() {
    let projectInfo = {};
    // 1. 选择创建项目或组件
    const { type } = await inquirer.prompt({
      type: "list",
      name: "type",
      message: "请选择初始化类型",
      default: TYPE_PROJECT,
      choices: [
        {
          name: "项目",
          value: TYPE_PROJECT,
        },
        {
          name: "组件",
          value: TYPE_COMPONENT,
        },
      ],
    });
    log.verbose("type", type);

    // 2. 获取项目基本信息
    if (type === TYPE_PROJECT) {
      const project = await inquirer.prompt([
        {
          type: "input",
          name: "projectName",
          message: "请输入项目名称",
          default: "",
          validate: function (v) {
            var done = this.async();
            // 1. 首字符必须为英文字母
            // 2. 尾字符必须为英文或数字，不能为字符
            // 3. 字符仅允许“-_”
            // 4. \w=a-zA-Z0-9_

            // 合法: a, a-b, a_b, a-b-c, a_b_c, a-b1-c1, a_b1_c1
            // 不合法: 1, a_, a-, a_1, a-1
            setTimeout(function () {
              if (
                !/^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(
                  v
                )
              ) {
                done("请输入合法的项目名称");
                return;
              }
              done(null, true);
            }, 0);
          },
          filter: (v) => {
            return v;
          },
        },
        {
          type: "input",
          name: "projectVersion",
          message: "请输入项目版本号",
          default: "1.0.0",
          validate: function (v) {
            var done = this.async();
            setTimeout(function () {
              if (!!!semver.valid(v)) {
                done("请输入合法的版本号");
                return;
              }
              done(null, true);
            }, 0);
          },
          filter: (v) => {
            if (!!semver.valid(v)) {
              return semver.valid(v);
            } else {
              return v;
            }
          },
        },
      ]);
      projectInfo = {
        type,
        ...project,
      };
    } else if (type === TYPE_COMPONENT) {
    }
    // return 项目的基本信息(object)
    return projectInfo;
  }

  isDirEmpty(localPath) {
    let fileList = fs.readdirSync(localPath);
    // 文件过滤的逻辑
    fileList = fileList.filter(
      (file) => !file.startsWith(".") && ["node_modules"].indexOf(file) < 0
    );
    return !fileList || fileList.length <= 0;
  }
}

function init(argv) {
  // console.log("init", argv);
  return new InitCommand(argv);
  // console.log("init", projectName, options.force, process.env.CLI_TARGET_PATH);
}

module.exports = init;
module.InitCommand = InitCommand;