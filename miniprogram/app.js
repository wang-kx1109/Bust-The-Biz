// app.js — 小程序入口
// 全局加载解锁进度；核心游戏逻辑全部在 utils/game.js
const game = require('./utils/game');

App({
  onLaunch() {
    game.loadProgress();
  },
});