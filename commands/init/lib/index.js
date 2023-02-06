'use strict';
const fs = require('fs');
const inquirer = require('inquirer');
const fse = require('fs-extra');
const semver = require('semver');
const userHome = require('user-home');
const glob = require('glob');
const ejs = require('ejs');
const Command = require('@turbo-cli-dev/command');
const log = require('@turbo-cli-dev/log');
const Package = require('@turbo-cli-dev/package');
const { spinnerStart, sleep, execAsync } = require('@turbo-cli-dev/utils');
const getProjectTemplate = require('./getProjectTemplate');
const path = require('path');

const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';

const TEMPLATE_TYPE_NORMAL = 'normal';
const TEMPLATE_TYPE_CUSTOM = 'custom';

// 命令白名单，只有在白名单的命令才能被执行
const WHITE_COMMAND = ['npm', 'cnpm'];

class InitCommand extends Command {
  init() {
    this.projectName = this._argv[0] || '';
    this.force = !!this._cmd.force;
    log.verbose('projectName', this.projectName);
    log.verbose('force', this.force);
  }

  async exec() {
    try {
      // 1，准备阶段
      const projectInfo = await this.prepare();
      if (projectInfo) {
        // 2. 下载模版
        this.projectInfo = projectInfo;
        log.verbose('projectInfo', projectInfo);
        await this.downloadTemplate();
        // 3. 安装模版
        await this.installTemplate();
      }
    } catch (e) {
      log.error(e.message);
      if (process.env.LOG_LEVEL === 'verbose') {
        console.log(e);
      }
    }
  }

  async installTemplate() {
    log.verbose('templateNpm', this.templateNpm);
    if (this.templateInfo) {
      if (!this.templateInfo.type) {
        this.templateInfo.type = TEMPLATE_TYPE_NORMAL;
      }
      if (this.templateInfo.type === TEMPLATE_TYPE_NORMAL) {
        // 标准安装
        await this.intallNormalTemplate();
      } else if (this.templateInfo.type === TEMPLATE_TYPE_CUSTOM) {
        // 自定义安装
        await this.installCustomTemplate();
      } else {
        throw new Error('无法识别项目模版类型！');
      }
    } else {
      throw new Error('项目模版信息不存在！');
    }
  }

  checkCommand(cmd) {
    if (WHITE_COMMAND.includes(cmd)) {
      return cmd;
    }
    return null;
  }

  // 执行命令
  async execCommand(command, errMsg) {
    // npm install ===> spwan('npm', [intall])
    let ret;
    if (command) {
      const cmdArray = command.split(' ');
      const cmd = this.checkCommand(cmdArray[0]);
      if (!cmd) {
        throw new Error('命令不存在！命令：: ' + command);
      }
      const args = cmdArray.slice(1);
      ret = await execAsync(cmd, args, {
        cwd: process.cwd(),
        stdio: 'inherit',
      });
    }
    if (ret !== 0) {
      throw new Error(errMsg);
    }
  }

  ejsRender(options) {
    const dir = process.cwd();
    const projectInfo = this.projectInfo;
    return new Promise(function (resolve, reject) {
      glob(
        '**',
        {
          cwd: dir,
          ignore: options.ignore,
          nodir: true,
        },
        function (err, fileList) {
          if (err) {
            reject(err);
          }
          Promise.all(
            fileList.map(file => {
              const filePath = path.join(dir, file);
              return new Promise((resolve1, reject1) => {
                ejs.renderFile(
                  filePath,
                  {
                    ...projectInfo,
                    version: projectInfo.projectVersion,
                    description: projectInfo.componentDescription,
                  },
                  {},
                  function (err, result) {
                    if (err) {
                      reject1(err);
                    } else {
                      resolve1(result);
                      // 渲染完成之后重新写入文件
                      fse.writeFileSync(filePath, result);
                    }
                  }
                );
              });
            })
          )
            .then(() => {
              resolve();
            })
            .catch(err => {
              reject(err);
            });
        }
      );
    });
  }

  async intallNormalTemplate() {
    const spinner = spinnerStart('正在安装模版...');
    sleep();

    const templatePath = path.resolve(
      this.templateNpm.cacheFilePath,
      'template'
    );
    const targetPath = process.cwd(); // 当前执行的目录
    try {
      fse.ensureDirSync(templatePath);
      fse.ensureDirSync(targetPath);
      fse.copySync(templatePath, targetPath);
    } catch (e) {
      throw e;
    } finally {
      spinner.stop(true);
      if (!this.isDirEmpty(targetPath)) {
        // 当前目录不为空
        log.success('模版安装成功');
      }
    }

    // 拷贝完成之后做ejs渲染
    const templateIgnore = this.templateInfo.ignore || [];
    const ignore = ['**/node_muodule/**', ...templateIgnore];
    await this.ejsRender({ ignore });

    const { installCommand, startCommand } = this.templateInfo;
    // // // 依赖安装
    // await this.execCommand(installCommand, '依赖安装过程中失败！');

    // // // 启动命令执行
    // await this.execCommand(startCommand, '启动命令执行失败！');
  }

  async installCustomTemplate() {
    console.log('installCustomTemplate');
  }

  async downloadTemplate() {
    const targetPath = path.resolve(userHome, '.turbo-cli-dev', 'template');
    const storeDir = path.resolve(
      userHome,
      '.turbo-cli-dev',
      'template/node_modules'
    );
    const { projectTemplate } = this.projectInfo;
    const templateInfo = this.template.find(
      item => item.npmName === projectTemplate
    );
    const { npmName, version } = templateInfo;
    this.templateInfo = templateInfo;
    const templateNpm = new Package({
      targetPath,
      storeDir,
      packageName: npmName,
      packageVersion: version,
    });

    if (!(await templateNpm.exists())) {
      const spinner = spinnerStart('正在下载模版...');
      await sleep();
      try {
        await templateNpm.install();
      } catch (e) {
        throw new Error(e);
      } finally {
        spinner.stop(true);
        if (templateNpm.exists()) {
          log.success('模版下载成功');
          this.templateNpm = templateNpm;
        }
      }
    } else {
      const spinner = spinnerStart('正在更新模版...');
      await sleep();
      try {
        await templateNpm.update();
      } catch (e) {
        throw e;
      } finally {
        spinner.stop(true);
        if (templateNpm.exists()) {
          log.success('模版更新成功');
          this.templateNpm = templateNpm;
        }
      }
    }
    // 1. 通过项目模版API获取项目模版信息
    // 1.1 通过egg.js搭建一套后端系统
    // 1.2 通过npm存储项目模版(vue-cli/vue-element-admin)
    // 1.3 将项目模版信息存储到mongodb数据库中
    // 1.4 通过egg.js获取mongodb中的数据并且通过API返回
  }

  async prepare() {
    // 0. 判断项目模版是否存在
    const template = await getProjectTemplate();
    if (!template || template.length === 0) {
      throw new Error('项目模版不存在');
    }
    this.template = template;

    // 1. 判断当前目录是否为空
    const localPath = process.cwd();
    if (!this.isDirEmpty(localPath)) {
      let ifContinue = false;
      if (!this.force) {
        // 不为空，询问是否继续创建
        ifContinue = (
          await inquirer.prompt({
            type: 'confirm',
            name: 'ifContinue',
            default: false,
            message: '当前文件夹不为空，是否继续创建项目？',
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
          type: 'confirm',
          name: 'confirmDelete',
          default: false,
          message: '是否确认清空当前目录下的文件？',
        });

        if (confirmDelete) {
          // 清空当前目录
          fse.emptyDirSync(localPath);
        }
      }
    }

    return await this.getProjectInfo();
  }

  async getProjectInfo() {
    function isValidName(v) {
      return /^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(
        v
      );
    }
    let projectInfo = {};
    let isProjectNameValid = false;
    if (isValidName(this.projectName)) {
      isProjectNameValid = true;
      projectInfo.projectName = this.projectName;
    }
    // 1. 选择创建项目或组件
    const { type } = await inquirer.prompt({
      type: 'list',
      name: 'type',
      message: '请选择初始化类型',
      default: TYPE_PROJECT,
      choices: [
        {
          name: '项目',
          value: TYPE_PROJECT,
        },
        {
          name: '组件',
          value: TYPE_COMPONENT,
        },
      ],
    });
    log.verbose('type', type);
    this.template = this.template.filter(template =>
      template.tag.includes(type)
    );

    const title = type === TYPE_PROJECT ? '项目' : '组件';
    const projectPromptArr = [];
    const projectNamePrompt = {
      type: 'input',
      name: 'projectName',
      message: `请输入${title}名称`,
      default: '',
      validate: function (v) {
        var done = this.async();
        // 1. 首字符必须为英文字母
        // 2. 尾字符必须为英文或数字，不能为字符
        // 3. 字符仅允许“-_”
        // 4. \w=a-zA-Z0-9_

        // 合法: a, a-b, a_b, a-b-c, a_b_c, a-b1-c1, a_b1_c1
        // 不合法: 1, a_, a-, a_1, a-1
        setTimeout(function () {
          if (!isValidName(v)) {
            done(`请输入合法的${title}名称`);
            return;
          }
          done(null, true);
        }, 0);
      },
      filter: v => {
        return v;
      },
    };
    if (!isProjectNameValid) {
      projectPromptArr.push(projectNamePrompt);
    }
    projectPromptArr.push(
      {
        type: 'input',
        name: 'projectVersion',
        message: `请输入${title}版本号`,
        default: '1.0.0',
        validate: function (v) {
          var done = this.async();
          setTimeout(function () {
            if (!!!semver.valid(v)) {
              done('请输入合法的版本号');
              return;
            }
            done(null, true);
          }, 0);
        },
        filter: v => {
          if (!!semver.valid(v)) {
            return semver.valid(v);
          } else {
            return v;
          }
        },
      },
      {
        type: 'list',
        name: 'projectTemplate',
        message: `请选择${title}模版`,
        choices: this.createTemplateChoice(),
      }
    );

    // 2. 获取项目基本信息
    if (type === TYPE_PROJECT) {
      const project = await inquirer.prompt(projectPromptArr);

      projectInfo = {
        ...projectInfo,
        type,
        ...project,
      };
    } else if (type === TYPE_COMPONENT) {
      const decriptionPrompt = {
        type: 'input',
        name: 'componentDescription',
        message: '请输入组件描述',
        default: '',
        validate: function (v) {
          var done = this.async();
          setTimeout(function () {
            if (!v) {
              done('请输入组件描述');
              return;
            }
            done(null, true);
          }, 0);
        },
      };
      projectPromptArr.push(decriptionPrompt);
      const componentInfo = await inquirer.prompt(projectPromptArr);

      projectInfo = {
        ...projectInfo,
        type,
        ...componentInfo,
      };
    }

    // 生成className
    if (projectInfo.projectName) {
      projectInfo.name = projectInfo.projectName;
      // 驼峰转-，testProject =》 test-project
      const kebabCase = require('kebab-case');
      projectInfo.className = kebabCase(projectInfo.projectName).replace(
        /^-/,
        ''
      );
    }

    if (projectInfo.projectVersion) {
      projectInfo.version = projectInfo.projectVersion;
    }

    // return 项目的基本信息(object)
    return projectInfo;
  }

  createTemplateChoice() {
    return this.template.map(item => ({
      name: item.name,
      value: item.npmName,
    }));
  }

  isDirEmpty(localPath) {
    let fileList = fs.readdirSync(localPath);
    // 文件过滤的逻辑
    fileList = fileList.filter(
      file => !file.startsWith('.') && ['node_modules'].indexOf(file) < 0
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
