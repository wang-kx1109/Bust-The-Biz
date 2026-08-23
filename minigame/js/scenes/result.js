/* =====================================================================
 * js/scenes/result.js — 结算 / 诊断报告场景
 * ===================================================================== */
const store = require('../core/state.js');
const router = require('../core/router.js');
const gfx = require('../core/gfx.js');
const layout = require('../core/layout.js');
const C = gfx.C;

module.exports = {
  report: null,
  stats: [],
  buttons: [],

  onEnter() {
    store.markStage('result');
    if (!store.getLevel()) { router.switchScene('select'); return; }
    store.completeLevel(); // 写入解锁进度（幂等）
    const lv = store.getLevel();
    this.report = store.computeResult();

    this.stats = [
      { k: '🔍 找到错误', v: `${this.report.foundCount}/${lv.findFaults.faults.length}` },
      { k: '🔗 连线正确', v: `${this.report.linkCount}/${lv.connectPairs.length}` },
      { k: '🚑 急救判断', v: store.state.rescueCorrect ? '✅' : '❌' },
      { k: '🗣 审问答对', v: `${store.state.askCorrect}/${lv.interview.questions.length}` },
      { k: '❤️ 剩余耐心', v: `${store.state.patience}` },
    ];
    this.nextId = store.nextLevelId();
    this.levelTitle = lv.title;
    this.buttons = [];
  },

  onTap(x, y) {
    for (const b of this.buttons) {
      if (b.enabled === false) continue;
      if (gfx.hit(x, y, b)) { b.action(); return; }
    }
  },

  onShare() {
    const r = this.report;
    try {
      wx.shareAppMessage({
        title: r.shareText,
        query: 'level=' + (store.state.levelId || ''),
      });
    } catch (e) { /* 兼容 */ }
  },
  onRestart() {
    store.start(store.state.levelId);
    router.switchScene('ask');
  },
  onNext() {
    if (!this.nextId) return;
    store.start(this.nextId);
    router.switchScene('ask');
  },
  onBack() {
    router.switchScene('select');
  },

  render(ctx) {
    gfx.drawBg(ctx);
    if (!this.report) return;
    const top = layout.topInset;
    const r = this.report;

    // 头部
    gfx.drawText(ctx, '🕵️', 375, top + 14, { size: 64, align: 'center' });
    gfx.drawText(ctx, `${r.score}`, 375, top + 92, { size: 92, bold: true, align: 'center', color: C.gold });
    gfx.drawText(ctx, `诊断得分 · ${this.levelTitle}`, 375, top + 198, { size: 26, color: C.muted, align: 'center' });
    // 成就徽章
    const achW = gfx.textWidth(ctx, r.achievement, 28, true) + 56;
    gfx.fillRound(ctx, (750 - achW) / 2, top + 236, achW, 48, 24, C.gold);
    gfx.drawText(ctx, r.achievement, 375, top + 236 + 11, { size: 28, bold: true, align: 'center', color: '#3a2a00' });

    // 数据网格 2xN（两行两列）
    const gy = top + 304;
    const cellW = (702 - 20) / 2, cellH = 118;
    this.stats.forEach((s, i) => {
      const col = i % 2, row = (i / 2) | 0;
      const x = 24 + col * (cellW + 20), y = gy + row * (cellH + 20);
      gfx.card(ctx, x, y, cellW, cellH, 18);
      gfx.drawText(ctx, s.k, x + cellW / 2, y + 22, { size: 22, color: C.muted, align: 'center' });
      gfx.drawText(ctx, s.v, x + cellW / 2, y + 58, { size: 38, bold: true, align: 'center', color: C.text });
    });

    // 亏损卡
    const statsEnd = gy + Math.ceil(this.stats.length / 2) * (cellH + 20);
    const ly = statsEnd + 16;
    gfx.card(ctx, 24, ly, 702, 168, 20);
    gfx.drawText(ctx, '若继续硬扛 · 预计亏损', 375, ly + 18, { size: 22, color: C.muted, align: 'center' });
    gfx.drawText(ctx, `${r.loss} 万`, 375, ly + 48, { size: 64, bold: true, align: 'center', color: C.accent });
    gfx.drawText(ctx, r.loss === 0 ? '你帮他完美止损，堪称人间清醒！' : `你帮他挽回了 ${r.recoveredTotal} 万潜在亏损`,
      375, ly + 130, { size: 24, align: 'center', color: '#cfd3e6' });

    // 按钮（两行两列）
    const btnY = ly + 188;
    const bw = (702 - 20) / 2, bh = 86;
    const acts = [
      { label: '📤 分享诊断结果', theme: 'green', action: () => this.onShare() },
      { label: '🔄 再开一局', theme: 'ghost', action: () => this.onRestart() },
    ];
    if (this.nextId) {
      acts.push({ label: `⬇ 下一关已解锁`, theme: 'primary', action: () => this.onNext() });
      acts.push({ label: '返回选关', theme: 'ghost', action: () => this.onBack() });
    } else {
      acts.push({ label: '返回选关', theme: 'ghost', action: () => this.onBack() });
    }
    this.buttons = [];
    acts.forEach((a, i) => {
      const col = i % 2, row = (i / 2) | 0;
      const b = { x: 24 + col * (bw + 20), y: btnY + row * (bh + 20), w: bw, h: bh, label: a.label, theme: a.theme, enabled: true, action: a.action };
      this.buttons.push(b);
      gfx.drawButton(ctx, b);
    });
  },
};