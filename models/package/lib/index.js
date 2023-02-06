'use strict';
const pkgDir = require('pkg-dir').sync;
const fse = require('fs-extra');
const pathExists = require('path-exists').sync;
const npminstall = require('npminstall');
const path = require('path');
const formatPath = require('@turbo-cli-dev/format-path');
const {
  getDefaultRegistry,
  getNpmLatestVersion,
} = require('@turbo-cli-dev/get-npm-info');

const { isObject } = require('@turbo-cli-dev/utils');

class Package {
  constructor(options) {
    if (!options) {
      throw new Error('Package类的options参数不能为空！');
    }
    if (!isObject(options)) {
      throw new Error('Package类的options参数必须为对象！');
    }
    // package的目标路径
    this.targetPath = options.targetPath;
    // package的缓存文件
    this.storeDir = options.storeDir;
    // package的name
    this.packageName = options.packageName;
    // package的version
    this.packageVersion = options.packageVersion;
    // package缓存目录前缀
    this.npmCacheFilePathPrefix = this.packageName.replace('/', '+');
  }

  async prepare() {
    if (this.storeDir && pathExists(this.storeDir)) {
      // 创建缓存目录
      fse.mkdirpSync(this.storeDir);
    }
    if (this.packageVersion === 'latest') {
      this.packageVersion = await getNpmLatestVersion(this.packageName);
    }
  }

  get cacheFilePath() {
    return path.resolve(
      this.storeDir,
      '.store',
      `${this.npmCacheFilePathPrefix}@${this.packageVersion}/node_modules/${this.packageName}`
    );
  }

  getSpecificCacheFilePath(packageVersion) {
    return path.resolve(
      this.storeDir,
      '.store',
      `${this.npmCacheFilePathPrefix}@${packageVersion}/node_modules/${this.packageName}`
    );
  }

  // 判断当前Package是否存在
  async exists() {
    if (this.storeDir) {
      // 缓存模式
      await this.prepare();
      // console.log(
      //   "cacheFilePath",
      //   this.cacheFilePath,
      //   pathExists(this.cacheFilePath)
      // );
      return pathExists(this.cacheFilePath);
    } else {
      return pathExists(this.targetPath);
    }
  }

  // 安装Package
  async install() {
    await this.prepare();
    return npminstall({
      root: this.targetPath,
      storeDir: this.storeDir,
      regisrty: getDefaultRegistry(),
      pkgs: [
        {
          name: this.packageName,
          version: this.packageVersion,
        },
      ],
    });
  }

  // 更新Package
  async update() {
    await this.prepare();
    // 1. 获取最新的npm模块版本号
    const latestPackageVersion = await getNpmLatestVersion(this.packageName);
    // 2. 查询最新版本号对应的路径是否存在
    const latestFilePath = this.getSpecificCacheFilePath(latestPackageVersion);
    // 3. 如果不存在，则直接安装最新版本
    if (!pathExists(latestFilePath)) {
      await npminstall({
        root: this.targetPath,
        storeDir: this.storeDir,
        regisrty: getDefaultRegistry(),
        pkgs: [
          {
            name: this.packageName,
            version: latestPackageVersion,
          },
        ],
      });
      this.packageVersion = latestPackageVersion;
    } else {
      this.packageVersion = latestPackageVersion;
    }
  }

  // 获取入口文件的路径
  getRootFilePath() {
    function _getRootFile(targetPath) {
      // 1. 获取package.json所在目录
      const dir = pkgDir(targetPath);

      if (dir) {
        // 2. 读取package.json
        const pkgFile = require(path.resolve(dir, 'package.json'));
        // 3. 寻找main/lib
        if (pkgFile && pkgFile.main) {
          // 4. 路径的兼容（macOS/windows）
          return formatPath(path.resolve(dir, pkgFile.main));
        }
      }

      return null;
    }

    if (this.storeDir) {
      // console.log(
      //   this.storeDir,
      //   this.cacheFilePath,
      //   _getRootFile(this.cacheFilePath)
      // );
      return _getRootFile(this.cacheFilePath);
    } else {
      return _getRootFile(this.targetPath);
    }
  }
}

module.exports = Package;
