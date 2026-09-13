/* =====================================================================
 * js/scenes/rescue.js — 急救场景（处方笺三选一 + 盖章动画 + 结果弹窗）
 * 点选项 → 红色「勇」字印章旋转砸下（500ms）→ 再弹对/错结果窗。
 * ===================================================================== */
const store = require('../core/state.js');
const router = require('../core/router.js');
const gfx = require('../core/gfx.js');
const layout = require('../core/layout.js');
const audio = require('../core/audio.js');
const fx = require('../core/fx.js');
const C = gfx.C;

const MX = 40;
const CW = 750 - MX * 2;
const STAMP_DUR = 500; // 盖章动画时长，盖完才弹窗

module.exports = {
  optRects: [],    // [{i, rect}]
  optCls: [],      // [''] | 'ok' | 'no'
  chosen: null,    // index | null
  correct: false,
  why: '',
  stampT0: -1,     // 盖章动画起点
  modalOpen: false,
  modalContinueBtn: null,
  _timers: [],

  onEnter() {
    store.markStage('rescue');
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
    this.optRects = [];
    this.optCls = [];
    this.chosen = null;
    this.correct = false;
    this.why = '';
    this.stampT0 = -1;
    this.modalOpen = false;
    this.modalContinueBtn = null;
    if (!store.getLevel()) { router.switchScene('select'); }
  },
  onExit() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
  },

  onTap(x, y) {
    if (this.modalOpen) {
      if (this.modalContinueBtn && gfx.hit(x, y, this.modalContinueBtn)) {
        this.modalOpen = false;
        router.switchScene('result');
      }
      return; // 弹窗打开时吞掉其余点击
    }
    if (this.chosen !== null) return; // 盖章/弹窗动画中锁定输入
    for (const o of this.optRects) {
      if (gfx.hit(x, y, o.rect)) { this.onPick(o.i); return; }
    }
  },

  onPick(i) {
    const lv = store.getLevel();
    if (!lv) return;
    const r = store.chooseRescue(i);
    if (r.failed) { router.switchScene('fail'); return; }
    const opts = lv.firstAid.options;
    this.optCls = opts.map((o, idx) => {
      if (idx === i) return o.correct ? 'ok' : 'no';
      if (o.correct) return 'ok';
      return '';
    });
    this.chosen = i;
    this.correct = r.correct;
    this.why = r.why;
    this.stampT0 = Date.now();
    fx.shake(3);
    audio.play('click');
    this._timers.push(setTimeout(() => this.openModal(), STAMP_DUR));
  },

  openModal() {
    if (this.chosen === null) return;
    this.modalOpen = true; // 印章已盖完才弹窗
    if (this.correct) audio.play('correct');
    else {
      audio.play('wrong');
      fx.flash();
    }
  },

  /* ---------- 渲染 ---------- */
  render(ctx) {
    gfx.drawBg(ctx);
    const now = Date.now();
    gfx.drawHud(ctx, store.state.score, store.state.patience, store.state.patienceMax);

    const lv = store.getLevel();
    if (!lv) return;
    const top = layout.topInset + 84 + 8;

    gfx.drawText(ctx, '🚑 急救 · 开处方', 375, top, { size: 32, bold: true, align: 'center' });
    gfx.drawText(ctx, '见过太多坑后，你的一句话可能救回一家店', 375, top + 40, {
      size: 22, color: C.muted, align: 'center',
    });

    // 店主求助气泡
    let y = this.bubble(ctx, top + 84, `${lv.interview.owner.emoji} ${lv.interview.owner.name}`, lv.firstAid.prompt);

    // 处方笺选项
    this.optRects = [];
    y += 26;
    const cardH = 118;
    lv.firstAid.options.forEach((o, i) => {
      const rect = { x: MX, y, w: CW, h: cardH };
      this.optRects.push({ i, rect });
      const cls = this.optCls[i];
      // 处方笺：浅底卡 + 深色文字（深色背景上形成对比）
      const fill = cls === 'ok' ? '#e9faf2' : cls === 'no' ? '#fdeef0' : '#fbfaf4';
      gfx.fillRoundShadow(ctx, rect.x, rect.y, rect.w, rect.h, 14, fill, { blur: 18, dy: 6 });
      gfx.strokeRound(ctx, rect.x, rect.y, rect.w, rect.h, 14,
        cls === 'ok' ? C.green : cls === 'no' ? C.accent : 'rgba(0,0,0,0.1)', cls ? 2.5 : 1.5);
      // 左侧 A/B/C 圆形章位
      const cx = rect.x + 56, cy = rect.y + rect.h / 2;
      const sealColor = cls === 'ok' ? C.green : cls === 'no' ? C.accent : '#8a90a8';
      ctx.beginPath();
      ctx.arc(cx, cy, 30, 0, Math.PI * 2);
      ctx.strokeStyle = sealColor;
      ctx.lineWidth = 3;
      ctx.stroke();
      gfx.drawText(ctx, o.tag, cx, cy, { size: 30, bold: true, color: sealColor, align: 'center', baseline: 'middle' });
      // 右侧方案文字
      const textX = rect.x + 108, maxW = rect.w - 140;
      const lines = gfx.wrapLines(ctx, o.label, maxW, 27);
      gfx.drawWrapped(ctx, o.label, textX, cy - ((lines.length - 1) * 34) / 2, maxW, 34, {
        size: 27, color: '#2a2a3a',
      });
      // 盖章动画（点击的那张处方）
      if (this.chosen === i && this.stampT0 > 0) this.renderStamp(ctx, rect, now);
      y += cardH + 20;
    });

    if (this.modalOpen) this.renderModal(ctx);
  },

  // 红色「勇」字印章从上方旋转砸下：scale 1.6→1，rotate -30°→-8°
  renderStamp(ctx, rect, now) {
    const p = gfx.clamp((now - this.stampT0) / STAMP_DUR, 0, 1);
    const e = gfx.easeOutBack(p);
    const scale = 1.6 - 0.6 * e;
    const rot = (-30 + 22 * e) * Math.PI / 180;
    const x = rect.x + rect.w - 92;
    const y = rect.y + rect.h / 2 - 70 * (1 - e);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fillStyle = '#d4332e';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();
    gfx.drawText(ctx, '勇', 0, 2, { size: 40, bold: true, color: '#fff', align: 'center', baseline: 'middle' });
    ctx.restore();
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
    gfx.fillRoundShadow(ctx, x, y, w, h, 24, C.modalBg, { blur: 30 });
    gfx.strokeRound(ctx, x, y, w, h, 24, chosenOk ? C.green : C.accent, 2.5);
    gfx.drawText(ctx, chosenOk ? '✅ 选对了' : '❌ 选错了', x + 40, y + 48, {
      size: 36, bold: true, color: chosenOk ? C.green : C.accent,
    });
    gfx.drawWrapped(ctx, this.why, x + 40, y + 116, w - 80, 46, { size: 28 });
    this.modalContinueBtn = { x: x + 40, y: y + h - 96, w: w - 80, h: 84, label: '查看诊断报告 →', theme: 'primary', enabled: true };
    gfx.drawButton(ctx, this.modalContinueBtn);
  },
};
