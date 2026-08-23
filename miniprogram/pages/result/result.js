// pages/result/result.js — 阶段五：结算 / 诊断报告
const game = require('../../utils/game.js');

Page({
  data: {
    levelTitle: '',
    report: null,   // computeResult() 输出
    stats: [],      // [{k, v}] 数据网格
    nextId: null,   // 打通后解锁的下一关
  },

  onLoad() {
    if (game.state.stage !== 'result' || !game.state.levelId) {
      wx.reLaunch({ url: '/pages/select/select' });
      return;
    }
    const lv = game.getLevel();
    game.completeLevel(); // 写入解锁进度（幂等）

    const r = game.computeResult();
    const stats = [
      { k: '🔍 找到错误', v: `${r.foundCount}/${lv.findFaults.faults.length}` },
      { k: '🔗 连线正确', v: `${r.linkCount}/${lv.connectPairs.length}` },
      { k: '🚑 急救判断', v: game.state.rescueCorrect ? '✅' : '❌' },
      { k: '🗣 审问答对', v: `${game.state.askCorrect}/${lv.interview.questions.length}` },
      { k: '❤️ 剩余耐心', v: `${game.state.patience}` },
    ];

    this.setData({
      levelTitle: lv.title,
      report: r,
      stats,
      nextId: game.nextLevelId(),
    });
  },

  // 分享卡片：标题用 shareText 插值结果
  onShareAppMessage() {
    const r = this.data.report || game.computeResult();
    return {
      title: r.shareText,
      path: '/pages/select/select',
    };
  },

  onRestart() {
    game.start(game.state.levelId);
    wx.reLaunch({ url: '/pages/ask/ask' });
  },

  onNext() {
    if (!this.data.nextId) return;
    game.start(this.data.nextId);
    game.markStage('ask');
    wx.reLaunch({ url: '/pages/ask/ask' });
  },

  onBack() {
    wx.reLaunch({ url: '/pages/select/select' });
  },
});