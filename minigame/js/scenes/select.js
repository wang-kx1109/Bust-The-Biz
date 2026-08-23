/* =====================================================================
 * js/scenes/select.js — 关卡选择场景
 * ===================================================================== */
const store = require('../core/state.js');
const router = require('../core/router.js');
const gfx = require('../core/gfx.js');
const layout = require('../core/layout.js');
const C = gfx.C;

module.exports = {
  cards: [],
  devRect: null,
  toast: null,

  onEnter() {
    this.loadView();
  },

  loadView() {
    store.loadProgress();
    const completed = store.progress.completed || [];
    this.cards = store.LEVELS.map(lv => ({
      id: lv.id,
      icon: lv.icon,
      title: lv.title,
      subtitle: lv.subtitle,
      stars: '★'.repeat(lv.difficulty),
      locked: !store.isUnlocked(lv.id),
      cleared: completed.indexOf(lv.id) >= 0,
    }));
    const top = layout.topInset + 320;
    const cardW = 690, cardH = 190, gap = 20, cardX = 30;
    this.cards.forEach((c, i) => {
      c.rect = { x: cardX, y: top + i * (cardH + gap), w: cardW, h: cardH };
    });
    this.devRect = { x: cardX, y: top + this.cards.length * (cardH + gap) + 20, w: cardW, h: 56 };
    this.toast = null;
  },

  onTap(x, y) {
    if (this.devRect && gfx.hit(x, y, this.devRect)) {
      store.unlockAll();
      this.showToast('已解锁全部关卡');
      this.loadView();
      return;
    }
    for (const c of this.cards) {
      if (!gfx.hit(x, y, c.rect)) continue;
      if (c.locked) {
        this.showToast('未解锁：需先通关上一关');
        return;
      }
      store.start(c.id);
      router.switchScene('ask');
      return;
    }
  },

  update(dt, now) {
    if (this.toast && now > this.toast.until) this.toast = null;
  },

  render(ctx) {
    gfx.drawBg(ctx);
    const top = layout.topInset + 60;

    gfx.drawText(ctx, '🕵️', 375, top, { size: 96, align: 'center', baseline: 'top' });
    gfx.drawText(ctx, '餐饮大侦探', 375, top + 106, { size: 46, bold: true, align: 'center' });
    gfx.drawText(ctx, '模拟“创业避坑直播间” · 选择你要诊断的店铺', 375, top + 168, { size: 24, color: C.muted, align: 'center' });

    for (const c of this.cards) {
      const r = c.rect;
      gfx.card(ctx, r.x, r.y, r.w, r.h, 24, {
        fill: c.locked ? 'rgba(255,255,255,0.05)' : C.glass,
        border: c.cleared ? C.green : (c.locked ? 'rgba(255,255,255,0.08)' : C.glassBorder),
      });
      gfx.drawText(ctx, c.icon, r.x + 48, r.y + 44, { size: 64, align: 'center', baseline: 'middle' });
      gfx.drawText(ctx, c.title, r.x + 118, r.y + 30, { size: 32, bold: true });
      gfx.drawText(ctx, c.subtitle, r.x + 118, r.y + 78, { size: 24, color: C.muted });
      gfx.drawText(ctx, `难度 ${c.stars}`, r.x + 118, r.y + 124, { size: 22, color: c.locked ? C.muted : C.gold });
      // 右侧状态
      const status = c.cleared ? '✅' : (c.locked ? '🔒' : '▶');
      const sColor = c.cleared ? C.green : (c.locked ? C.muted : C.gold);
      gfx.drawText(ctx, status, r.x + r.w - 46, r.y + r.h / 2, { size: 38, align: 'center', baseline: 'middle', color: sColor });
    }

    gfx.drawText(ctx, '🎮 解锁全部关卡（试玩）', 375, this.devRect.y + this.devRect.h / 2, {
      size: 26, color: C.muted, align: 'center', baseline: 'middle',
    });
    gfx.drawText(ctx, '仅供玩法验证 · 数据与角色均为虚构', 375, layout.LOGICAL_H - layout.bottomInset - 30, {
      size: 20, color: 'rgba(154,160,184,0.6)', align: 'center', baseline: 'middle',
    });
    gfx.drawToast(ctx, this.toast, Date.now());
  },

  showToast(text) {
    this.toast = { text, until: Date.now() + 1600 };
  },
};