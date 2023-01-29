"use strict";
const log = require("npmlog");

module.exports = log;

log.level = process.env.LOG_LEVEL ? process.env.LOG_LEVEL : "info"; // 判断debug模式
log.heading = "turbo"; // 修改前缀
// log.headingStyle = { fg: "red", bd: "black" };
log.addLevel("success", 2000, { fg: "green", bold: true }); // 添加自定义的命令
