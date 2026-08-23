// pages/link/link.js — 阶段三：连线（Canvas 2d）
// 左列 = connectPairs 原顺序；右列 = game.state.rightOrder（洗牌）。
// 卡片以 pair index 匹配（index-vs-index，而非字符串 id）。
// 所有几何均以 canvas 自身 rect 为基准做局部坐标 → 页面滚动不影响对齐。
const game = require('../../utils/game.js');

Page({
  data: {
    pairs: [],          // [{idx, left, cls}]
    rightCards: [],     // [{pairIndex, right, cls}]
    connectedCount: 0,
    totalPairs: 0,
  },

  onLoad() {
    this._timers = [];
    if (game.state.stage !== 'link' || !game.state.levelId) {
      wx.reLaunch({ url: '/pages/select/select' });
      return;
    }
    game.sync(this);
    this.setData(this.buildCards());
  },

  onReady() {
    // canvas 2d 节点仅在 onReady 后可取（必须 fields({node,size})）
    wx.createSelectorQuery()
      .select('#linkCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const info = res && res[0];
        if (!info || !info.node) return;
        const canvas = info.node;
        let dpr = 2;
        try { dpr = (wx.getSystemInfoSync().pixelRatio) || 2; } catch (e) { /* 兜底 */ }
        canvas.width = info.width * dpr;
        canvas.height = info.height * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        this.canvas = canvas;
        this.ctx = ctx;
        setTimeout(() => this.draw(), 60); // 等本帧布局稳定
      });
  },

  onUnload() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
  },

  // 视口变化时重绘（如旋转/开发者工具改尺寸）
  onResize() {
    this.scheduleDraw();
  },

  // 依据当前状态构建卡片视图 + 计数
  buildCards() {
    const lv = game.getLevel();
    if (!lv) return { pairs: [], rightCards: [], connectedCount: 0, totalPairs: 0, allDone: false };
    const connected = game.state.connected;
    const n = lv.connectPairs.length;
    const pairs = lv.connectPairs.map((p, i) => ({
      idx: i,
      left: p.left,
      cls: connected[i] ? 'lcard locked' : (game.state.selectedLeft === i ? 'lcard selected' : 'lcard'),
    }));
    const rightCards = game.state.rightOrder.map(pi => ({
      pairIndex: pi,
      right: lv.connectPairs[pi].right,
      cls: connected[pi] ? 'rcard locked' : 'rcard',
    }));
    return {
      pairs,
      rightCards,
      connectedCount: Object.keys(connected).length,
      totalPairs: n,
      allDone: Object.keys(connected).length === n,
    };
  },

  render() {
    game.sync(this);
    this.setData(this.buildCards());
    this.scheduleDraw();
  },

  scheduleDraw() {
    this._timers.push(setTimeout(() => this.draw(), 50));
  },

  // 一次 query 取 canvas + 所有卡片 rect，换算局部坐标绘制
  draw() {
    if (!this.ctx) return;
    const sel = wx.createSelectorQuery();
    sel.select('#linkCanvas').boundingClientRect();
    sel.selectAll('.lcard').boundingClientRect();
    sel.selectAll('.rcard').boundingClientRect();
    sel.exec((res) => {
      const cv = res[0];
      const lefts = res[1] || [];
      const rights = res[2] || [];
      if (!cv) return;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      const px = p => ({ x: p.left + p.width / 2 - cv.left, y: p.top + p.height / 2 - cv.top });
      const lv = game.getLevel();
      if (!lv) return;
      const n = lv.connectPairs.length;

      // 已正确连线：绿线（左 i -> 右 i）
      for (let i = 0; i < n; i++) {
        if (!game.state.connected[i]) continue;
        const k = game.state.rightOrder.indexOf(i);
        const a = lefts[i], b = rights[k];
        if (a && b) this.line(px(a), px(b), '#16c79a');
      }

      // 错误闪线：红线（左 f -> 右 r）短暂显示
      if (this._flash) {
        const f = this._flash.fromIdx;
        const r = this._flash.toIdx;
        const k = game.state.rightOrder.indexOf(r);
        const a = lefts[f], b = rights[k];
        if (a && b) this.line(px(a), px(b), '#e94560');
      }
    });
  },

  line(p1, p2, color) {
    const ctx = this.ctx;
    const mx = (p1.x + p2.x) / 2;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(mx, p1.y - 24, p2.x, p2.y); // 上拱贝塞尔
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
  },

  onLeftTap(e) {
    game.selectLeft(Number(e.currentTarget.dataset.idx));
    this.render();
  },

  onRightTap(e) {
    const pi = Number(e.currentTarget.dataset.pair);
    const r = game.selectRight(pi);

    if (r.needLeft) {
      wx.showToast({ title: '先点左侧的「错误原因」', icon: 'none' });
      return;
    }
    if (r.locked) return;

    if (r.correct) {
      this.render();
    } else if (r.pairIndex !== null) {
      // 错配：红闪 600ms + 扣耐心（HUD 通过 sync 更新）
      game.sync(this);
      this.setData(this.buildCards());
      this._flash = { fromIdx: r.pairIndex, toIdx: r.wrongRight };
      this.scheduleDraw();
      this._timers.push(setTimeout(() => {
        this._flash = null;
        this.draw();
      }, 600));
      if (r.failed) {
        this._timers.push(setTimeout(() => {
          wx.reLaunch({ url: '/pages/fail/fail' });
        }, 700));
      }
    }
  },

  onContinue() {
    if (!game.allConnected()) {
      // 正常情况下按钮 disabled，兜底提示
      wx.showToast({ title: '还有错误没配对完', icon: 'none' });
      return;
    }
    game.markStage('rescue');
    wx.redirectTo({ url: '/pages/rescue/rescue' });
  },
});