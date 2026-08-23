// pages/ask/ask.js — 阶段一：连麦审问
// askStep：0开场 → 1环视 → 2/3/4三连问 → 5隔壁老王 → 6完成(跳找茬)
const game = require('../../utils/game.js');

Page({
  data: {
    // 基础视图（game.sync 注入）：score / patience / savedClues / maxClues 等
    owner: null,
    envClues: [],
    qIndex: -1,
    question: null,
    options: [],
    optionsDisabled: false,
    feedback: null,
    neighbor: null,
  },

  onLoad() {
    this._timers = [];
    // 冷启动/深链守卫：run 未开始则回选关
    if (game.state.stage !== 'ask' || !game.state.levelId) {
      wx.reLaunch({ url: '/pages/select/select' });
      return;
    }
    this.render();
  },

  onUnload() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
  },

  // 依据 askStep 渲染当前子阶段
  render() {
    const lv = game.getLevel();
    if (!lv) { wx.reLaunch({ url: '/pages/select/select' }); return; }
    const o = lv.interview.owner;
    const patch = {
      owner: { name: o.name, emoji: o.emoji, intro: o.intro, camHint: o.camHint },
      envClues: [],
      qIndex: -1,
      question: null,
      options: [],
      optionsDisabled: false,
      feedback: null,
      neighbor: null,
    };
    const step = game.state.askStep;

    if (step === 1) {
      patch.envClues = lv.interview.envClues.map(c => ({
        id: c.id, icon: c.icon, label: c.label, desc: c.desc,
        saved: game.state.savedClues.indexOf(c.id) >= 0,
      }));
    } else if (step >= 2 && step <= 4) {
      const q = lv.interview.questions[step - 2];
      patch.qIndex = step - 2;
      patch.question = { ask: q.ask, vague: q.vague };
      patch.options = q.options.map((o2, i) => ({ label: o2.label, slot: i }));
    } else if (step === 5) {
      patch.neighbor = lv.interview.neighbor;
    }
    // step>=6 由 onPhoneDone 直接跳转，这里兜底
    else if (step >= 6) {
      game.markStage('find');
      wx.redirectTo({ url: '/pages/find/find' });
      return;
    }

    game.sync(this);
    this.setData(patch);
  },

  // 开场/环视的"下一步"
  onStepNext() {
    game.advanceAsk();
    this.render();
  },

  // 环视：收藏/取消线索
  onClueTap(e) {
    const id = e.currentTarget.dataset.id;
    const r = game.toggleClue(id);
    if (r.full) {
      wx.showToast({ title: `最多收藏 ${this.data.maxClues} 条线索`, icon: 'none' });
      return;
    }
    const envClues = this.data.envClues.map(c => ({
      id: c.id, icon: c.icon, label: c.label, desc: c.desc,
      saved: r.savedClues.indexOf(c.id) >= 0,
    }));
    game.sync(this);
    this.setData({ envClues });
  },

  // 三连问答题
  onAnswer(e) {
    if (this.data.optionsDisabled) return;
    const slot = Number(e.currentTarget.dataset.slot);
    const qslot = game.state.askStep - 2;
    const q = game.getLevel().interview.questions[qslot];
    const r = game.answerQuestion(qslot, slot);

    const options = this.data.options.map((o, i) => {
      if (i === slot) return Object.assign({}, o, { cls: r.correct ? 'opt-correct' : 'opt-wrong' });
      if (!r.correct && q.options[i].correct) return Object.assign({}, o, { cls: 'opt-correct' });
      return o;
    });

    game.sync(this);
    this.setData({
      options,
      optionsDisabled: true,
      feedback: { type: r.correct ? 'ok' : 'no', text: r.reveal },
    });

    this._timers.push(setTimeout(() => {
      if (r.failed) {
        wx.reLaunch({ url: '/pages/fail/fail' });
        return;
      }
      game.advanceAsk();
      this.render();
    }, 900));
  },

  // 老王电话验证完成 → 进入找茬
  onPhoneDone() {
    game.phoneVerified();
    game.markStage('find');
    wx.redirectTo({ url: '/pages/find/find' });
  },
});