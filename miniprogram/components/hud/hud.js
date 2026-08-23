// components/hud/hud.js — 顶部 HUD（LIVE 状态 + 得分 + ❤️耐心值）
Component({
  properties: {
    score: { type: Number, value: 0 },
    hearts: { type: Number, value: 5 },
    maxHearts: { type: Number, value: 5 },
  },
  data: {
    // 兜底初值（observers 首次是否触发有版本差异；页面起始 patience 恒为 5）
    filledHearts: ['x', 'x', 'x', 'x', 'x'],
    emptyHearts: [],
  },
  observers: {
    'hearts, maxHearts': function (hearts, maxHearts) {
      const h = Math.max(0, Math.min(hearts, maxHearts));
      this.setData({
        filledHearts: new Array(h).fill('x'),
        emptyHearts: new Array(Math.max(0, maxHearts - h)).fill('x'),
      });
    },
  },
});