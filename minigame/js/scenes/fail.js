/* =====================================================================
 * js/scenes/fail.js — 诊断失败场景（耐心值归零）
 * ===================================================================== */
const store = require('../core/state.js');
const router = require('../core/router.js');
const gfx = require('../core/gfx.js');
const layout = require('../core/layout.js');
const C = gfx.C;

module.exports = {
  buttons: [],
  _now: 0,

  onEnter() {
    if (!store.state.failed || !store.state.levelId) {
      router.switchScene('select');
      return;
    }
    this.buttons = [];
  },
  update(dt, now) { this._now = now; },

  onTap(x, y) {
    for (const b of this.buttons) {
      if (gfx.hit(x, y, b)) { b.action(); return; }
    }
  },

  onRetry() {
    store.start(store.state.levelId);
    router.switchScene('ask');
  },
  onBack() {
    router.switchScene('select');
  },

  render(ctx) {
    gfx.drawBg(ctx);
    const top = layout.topInset + 80;
    const t = this._now * 0.004;
    const wob = Math.sin(t * 3) * 8;

    gfx.drawText(ctx, '💥😤', 375, top + wob, { size: 150, align: 'center', baseline: 'middle' });
    gfx.drawText(ctx, '耐心耗尽 · 诊断失败', 375, top + 120, { size: 40, bold: true, align: 'center', color: C.accent });
    gfx.drawText(ctx, '勇哥摔了耳机……"下一个！"', 375, top + 180, { size: 30, align: 'center' });
    gfx.drawText(ctx, '店主还在追问，你的诊断被愤怒地打断了', 375, top + 226, { size: 24, color: C.muted, align: 'center' });

    const by = top + 320;
    this.buttons = [
      { x: 100, y: by, w: 550, h: 92, label: '🔄 重新诊断这家店', theme: 'primary', enabled: true, action: () => this.onRetry() },
      { x: 100, y: by + 112, w: 550, h: 92, label: '返回关卡选择', theme: 'ghost', enabled: true, action: () => this.onBack() },
    ];
    for (const b of this.buttons) gfx.drawButton(ctx, b);
  },
};