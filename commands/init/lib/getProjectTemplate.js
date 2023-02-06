const request = require('@turbo-cli-dev/request');

module.exports = function () {
  return request({ url: '/project/template' });
};
