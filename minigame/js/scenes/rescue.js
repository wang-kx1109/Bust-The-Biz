/* =====================================================================
 * js/scenes/rescue.js — 急救场景（三选一 + 结果弹窗）
 * ===================================================================== */
const store = require('../core/state.js');
const router = require('../core/router.js');
const gfx = require('../core/gfx.js');
const layout = require('../core/layout.js');
const C = gfx.C;

const MX = 40;
const CW = 750 - MX * 2;

module.exports = {
  optRects: [],    // [{i, rect}]
  optCls: [],      // [''] | 'ok' | 'no'
  chosen: null,    // index | null
  why: '',
  modalOpen: false,

  onEnter() {
    store.markStage('rescue');
    this.optRects = [];
    this.optCls = [];
    this.chosen = null;
    this.why = '';
    this.modalOpen = false;
    if (!store.getLevel()) { router.switchScene('select'); }
  },

  onTap(x, y) {
    if (this.modalOpen) {
      if (this.modalContinueBtn && gfx.hit(x, y, this.modalContinueBtn)) {
        this.modalOpen = false;
        router.switchScene('result');
      }
      return;
    }
    if (this.chosen !== null) return;
    for (const o of this.optRects) {
      if (gfx.hit(x, y, o.rect)) { this.onPick(o.i); return; }
    }
  },

  onPick(i) {
    const lv = store.getLevel();
    const r = store.chooseRescue(i);
    if (r.failed) { router.switchScene('fail'); return; }
    const opts = lv.firstAid.options;
    this.optCls = opts.map((o, idx) => {
      if (idx === i) return o.correct ? 'ok' : 'no';
      if (o.correct) return 'ok';
      return '';
    });
    this.chosen = i;
    this.why = r.why;
    this.modalOpen = true;
  },

  render(ctx) {
    gfx.drawBg(ctx);
    const top = layout.topInset;
    gfx.drawHud(ctx, store.state.score, store.state.patience, 5);

    const lv = store.getLevel();
    if (!lv) return;

    gfx.drawText(ctx, '🚑 急救 · 开处方', 375, top + 92, { size: 32, bold: true, align: 'center' });
    gfx.drawText(ctx, '见过太多坑后，你的一句话可能救回一家店', 375, top + 132, { size: 22, color: C.muted, align: 'center' });

    // 店主求助气泡
    let y = this.bubble(ctx, top + 168, `${lv.interview.owner.emoji} ${lv.interview.owner.name}`, lv.firstAid.prompt);

    // 选项
    this.optRects = [];
    y += 24;
    lv.firstAid.options.forEach((o, i) => {
      const rect = { x: MX, y, w: CW, h: 96 };
      this.optRects.push({ i, rect });
      const cls = this.optCls[i];
      if (cls === 'ok') gfx.fillRound(ctx, rect.x, rect.y, rect.w, rect.h, 18, 'rgba(22,199,154,0.2)');
      else if (cls === 'no') gfx.fillRound(ctx, rect.x, rect.y, rect.w, rect.h, 18, 'rgba(233,69,96,0.2)');
      else gfx.fillRound(ctx, rect.x, rect.y, rect.w, rect.h, 18, 'rgba(255,255,255,0.08)');
      gfx.strokeRound(ctx, rect.x, rect.y, rect.w, rect.h, 18,
        cls === 'ok' ? C.green : (cls === 'no' ? C.accent : C.glassBorder), 2);
      gfx.drawText(ctx, o.tag, rect.x + 36, rect.y + rect.h / 2, { size: 34, bold: true, color: '#fff', align: 'center', baseline: 'middle' });
      gfx.drawText(ctx, o.label, rect.x + 72, rect.y + rect.h / 2, { size: 28, baseline: 'middle' });
      y += 96 + 18;
    });

    if (this.modalOpen) this.renderModal(ctx);
  },

  bubble(ctx, top, who, text) {
    const lines = gfx.wrapLines(ctx, text, CW - 56, 28);
    const h = 40 + lines.length * 42;
    gfx.fillRound(ctx, MX, top, CW, h, 18, C.bubble);
    gfx.strokeRound(ctx, MX, top, CW, h, 18, C.glassBorder, 1);
    if (who) gfx.drawText(ctx, who, MX + 24, top + 14, { size: 22, bold: true, color: C.gold });
    gfx.drawWrapped(ctx, text, MX + 24, top + 50, CW - 48, 42, { size: 28 });
    return top + h;
  },

  renderModal(ctx) {
    const w = 660, x = (750 - w) / 2, h = 380, y = (layout.LOGICAL_H - h) / 2;
    const chosenOk = this.chosen !== null && store.getLevel().firstAid.options[this.chosen].correct;
    ctx.fillStyle = C.overlay;
    ctx.fillRect(0, 0, 750, layout.LOGICAL_H);
    gfx.fillRound(ctx, x, y, w, h, 24, C.modalBg);
    gfx.strokeRound(ctx, x, y, w, h, 24, C.glassBorder, 2);
    gfx.drawText(ctx, chosenOk ? '✅ 选对了' : '❌ 选错了', x + 40, y + 48, { size: 36, bold: true });
    gfx.drawWrapped(ctx, this.why, x + 40, y + 116, w - 80, 46, { size: 28 });
    this.modalContinueBtn = { x: x + 40, y: y + h - 96, w: w - 80, h: 84, label: '查看诊断报告 →', theme: 'primary', enabled: true };
    gfx.drawButton(ctx, this.modalContinueBtn);
  },
};