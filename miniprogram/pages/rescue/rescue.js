// pages/rescue/rescue.js — 阶段四：急救
const game = require('../../utils/game.js');

Page({
  data: {
    prompt: '',
    options: [],        // [{tag, label, i, cls}]
    chosen: null,
    chosenCorrect: false,
    why: '',
    modalOpen: false,
  },

  onLoad() {
    this._timers = [];
    if (game.state.stage !== 'rescue' || !game.state.levelId) {
      wx.reLaunch({ url: '/pages/select/select' });
      return;
    }
    const lv = game.getLevel();
    game.sync(this);
    this.setData({
      prompt: lv.firstAid.prompt,
      options: lv.firstAid.options.map((o, i) => ({ tag: o.tag, label: o.label, i, cls: '' })),
    });
  },

  onUnload() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
  },

  onPick(e) {
    if (this.data.chosen !== null) return;
    const i = Number(e.currentTarget.dataset.i);
    const r = game.chooseRescue(i);
    game.sync(this);

    // 耐心归零 → 立即失败
    if (r.failed) {
      wx.reLaunch({ url: '/pages/fail/fail' });
      return;
    }

    const opts = game.getLevel().firstAid.options;
    const options = this.data.options.map(o => {
      if (o.i === i) return Object.assign({}, o, { cls: r.correct ? 'ok' : 'no' });
      if (!r.correct && opts[o.i].correct) return Object.assign({}, o, { cls: 'ok' });
      return o; // 其余保持原样（可置灰，但不影响阅读）
    });

    this.setData({
      chosen: i,
      chosenCorrect: r.correct,
      why: r.why,
      options,
      modalOpen: true,
    });
  },

  onContinue() {
    game.markStage('result');
    wx.redirectTo({ url: '/pages/result/result' });
  },

  noop() {},
});