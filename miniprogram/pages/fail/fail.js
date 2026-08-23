// pages/fail/fail.js — 诊断失败（耐心值归零）
const game = require('../../utils/game.js');

Page({
  onLoad() {
    // 必须是由失败路径进入（failIfZero 置 failed）才展示；否则回选关
    if (!game.state.failed || !game.state.levelId) {
      wx.reLaunch({ url: '/pages/select/select' });
      return;
    }
    game.sync(this);
  },

  onRetry() {
    const levelId = game.state.levelId;
    game.start(levelId);
    wx.reLaunch({ url: '/pages/ask/ask' });
  },

  onBack() {
    wx.reLaunch({ url: '/pages/select/select' });
  },
});