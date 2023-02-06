'use strict';
const semver = require('semver');
const axios = require('axios');
const urlJoin = require('url-join');

function getNpmInfo(npmName, regisrty) {
  if (!npmName) {
    return null;
  }
  regisrty = regisrty || getDefaultRegistry();
  const npmInfoUrl = urlJoin(regisrty, npmName);
  // console.log("getNpmInfo", npmName, npmInfoUrl);
  return axios
    .get(npmInfoUrl)
    .then(response => {
      if (response.status === 200) {
        return response.data;
      }
      return null;
    })
    .catch(err => {
      return Promise.reject(err);
    });
}

function getDefaultRegistry(isOriginal = true) {
  return isOriginal // 是否是原生的
    ? 'https://registry.npmjs.org'
    : 'https://registry.npm.taobao.org';
}

async function getNpmVersions(npmName, registry) {
  const data = await getNpmInfo(npmName, registry);
  if (data) {
    return Object.keys(data.versions);
  } else {
    [];
  }
}

async function getNpmLatestVersion(npmName, registry) {
  const versions = await getNpmVersions(npmName, registry);
  if (versions) {
    return versions.sort((a, b) => {
      if (semver.gt(b, a)) {
        return 1;
      }
      if (semver.gt(a, b)) {
        return -1;
      }
      return 0;
    })[0];
  }
  return null;
}

module.exports = {
  getNpmInfo,
  getDefaultRegistry,
  getNpmLatestVersion,
};
