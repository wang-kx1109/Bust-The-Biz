// pages/find/find.js — 阶段二：找茬
// 750x750 坐标 → rpx（K = 750 / sceneSize.w；两关均为 750 → K=1）
const game = require('../../utils/game.js');

Page({
  data: {
    levelTitle: '',
    sceneH: 750,
    zones: [],        // [{id, icon, label, style, revealed}]
    faults: [],       // [{id, title, style, found}]
    foundFaults: [],  // 面板行：[{id, panelLabel, data, panelNormal}]
    totalFaults: 0,
    revealBanner: '',
    popId: '',
    bellOn: false,
    bellKey: 0,
    modalFault: null,
  },

  onLoad() {
    this._timers = [];
    if (game.state.stage !== 'find' || !game.state.levelId) {
      wx.reLaunch({ url: '/pages/select/select' });
      return;
    }
    game.sync(this); // 先注入基础视图（HUD 的 score/patience）
    this.computeScene();
  },

  onUnload() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
  },

  // 依据当前状态重建场景视图（zone/fault 定位 + 已找到面板）
  computeScene() {
    const lv = game.getLevel();
    if (!lv) { wx.reLaunch({ url: '/pages/select/select' }); return; }
    const ff = lv.findFaults;
    const K = 750 / ff.sceneSize.w;
    const found = game.state.foundFlaws;
    const R = Math.round;

    const zones = ff.zones.map(z => ({
      id: z.id,
      icon: z.icon,
      label: z.label,
      style: `left:${R(z.x * K)}rpx;top:${R(z.y * K)}rpx;width:${R(z.w * K)}rpx;height:${R(z.h * K)}rpx;background:${z.bg};`,
    }));

    const faults = game.visibleFaults().map(ft => ({
      id: ft.id,
      title: ft.title,
      style: `left:${R(ft.x * K)}rpx;top:${R(ft.y * K)}rpx;`,
      found: found.indexOf(ft.id) >= 0,
    }));

    const foundFaults = found.map(id => {
      const ft = ff.faults.find(x => x.id === id);
      return ft ? { id, panelLabel: ft.panelLabel, data: ft.data, panelNormal: ft.panelNormal } : null;
    }).filter(Boolean);

    this.setData({
      levelTitle: lv.title,
      sceneH: R(ff.sceneSize.h * K),
      zones,
      faults,
      foundFaults,
      totalFaults: ff.faults.length,
    });
  },

  // 点击正常区域：触发隐藏点解锁；非解锁 zone 给轻提示避免"死点击"
  onZoneTap(e) {
    const id = e.currentTarget.dataset.id;
    const r = game.tapZone(id);
    if (!r.revealed) {
      wx.showToast({ title: '这里好像没什么异常', icon: 'none' });
      return;
    }
    game.sync(this);
    this.computeScene();
    this.setData({ revealBanner: r.hint, popId: r.faultId });
    this._timers.push(setTimeout(() => this.setData({ revealBanner: '' }), 2400));
    this._timers.push(setTimeout(() => this.setData({ popId: '' }), 900));
  },

  // 点击错误点 → 打开确认弹窗
  onFaultTap(e) {
    const id = e.currentTarget.dataset.id;
    if (game.state.foundFlaws.indexOf(id) >= 0) return;
    const ft = game.getLevel().findFaults.faults.find(x => x.id === id);
    if (!ft) return;
    this.setData({
      modalFault: { id: ft.id, title: ft.title, desc: ft.desc, data: ft.data, panelNormal: ft.panelNormal },
    });
  },

  onModalCancel() {
    this.setData({ modalFault: null });
  },

  // 确认找到 → 敲锣 + 入面板
  onModalConfirm() {
    const fault = this.data.modalFault;
    if (!fault) return;
    const r = game.confirmFlaw(fault.id);
    this.setData({ modalFault: null });
    if (r.already) return;

    game.sync(this);
    this.computeScene();
    this.setData({ bellOn: true, bellKey: this.data.bellKey + 1 });
    this._timers.push(setTimeout(() => this.setData({ bellOn: false }), 1100));
  },

  onContinue() {
    game.markStage('link');
    wx.redirectTo({ url: '/pages/link/link' });
  },

  noop() {},
});