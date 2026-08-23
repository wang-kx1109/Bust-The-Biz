// pages/select/select.js — 关卡选择页
const game = require('../../utils/game.js');

Page({
  data: {
    levels: [],
  },

  onShow() {
    game.loadProgress();
    const completed = game.progress.completed || [];
    const levels = game.LEVELS.map(lv => {
      const locked = !game.isUnlocked(lv.id);
      const cleared = completed.indexOf(lv.id) !== -1;
      let lockText = '';
      if (locked && lv.unlockCondition) {
        const pre = game.findLevel(lv.unlockCondition.id);
        lockText = `需先通关「${pre ? pre.title : lv.unlockCondition.id}」`;
      }
      return {
        id: lv.id,
        icon: lv.icon,
        title: lv.title,
        subtitle: lv.subtitle,
        stars: '★'.repeat(lv.difficulty),
        locked,
        cleared,
        lockText,
      };
    });
    this.setData({ levels });
  },

  onLevelTap(e) {
    const id = e.currentTarget.dataset.id;
    const lv = game.findLevel(id);
    if (!lv) return;
    if (!game.isUnlocked(id)) {
      wx.showToast({ title: '未解锁', icon: 'none' });
      return;
    }
    game.start(id);
    wx.navigateTo({ url: '/pages/ask/ask' });
  },

  onDevUnlock() {
    game.unlockAll();
    this.onShow();
    wx.showToast({ title: '已解锁全部关卡', icon: 'success' });
  },
});