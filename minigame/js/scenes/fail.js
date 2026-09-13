/* =====================================================================
 * js/scenes/fail.js — 诊断失败场景（心碎弹入 + 广告复活 + 求助分享）
 * 守卫：非 failed 状态弹回选关。
 * ===================================================================== */
const store = require('../core/state.js');
const router = require('../core/router.js');
const gfx = require('../core/gfx.js');
const layout = require('../core/layout.js');
const audio = require('../core/audio.js');
const fx = require('../core/fx.js');
const ads = require('../core/ads.js');
const { track } = require('../core/track.js');
const C = gfx.C;

module.exports = {
  buttons: [],
  toast: null,
  enterT0: 0,
  _now: 0,

  onEnter() {
    if (!store.state.failed || !store.state.levelId) {
      router.switchScene('select');
      return;
    }
    this.buttons = [];
    this.toast = null;
    this.enterT0 = Date.now();
    const lv = store.getLevel();
    if (lv) fx.setDanmakuPool(lv.interview.danmaku);
    fx.shake(8);
    fx.flash();
    audio.play('heart');
    track('level_fail', { id: store.state.levelId });
  },
  update(dt, now) {
    this._now = now;
    if (this.toast && now > this.toast.until) this.toast = null;
  },

  onTap(x, y) {
    for (const b of this.buttons) {
      if (gfx.hit(x, y, b)) { b.action(); return; }
    }
  },

  onRevive() {
    ads.show('revive').then((ok) => {
      if (!ok) {
        this.toast = { text: '看完广告才能复活哦', until: Date.now() + 1600 };
        return;
      }
      const r = store.revive();
      if (r.ok) router.switchScene(r.stage); // 回到失败时的阶段继续
    });
  },
  onHelpShare() {
    const idx = store.LEVELS.findIndex(l => l.id === store.state.levelId);
    try {
      wx.shareAppMessage({
        title: `第${idx + 1}关死活过不去！谁来救救这家店？`,
        query: 'level=' + (store.state.levelId || ''),
      });
    } catch (e) { /* 兼容 */ }
    track('share_click', { from: 'fail' });
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
    const now = this._now || Date.now();
    const top = layout.topInset + 60;

    // 💔 大图标从中心 0 → 1.4 → 1 弹入
    const p = gfx.clamp((now - this.enterT0) / 700, 0, 1);
    let s;
    if (p < 0.55) s = 1.4 * gfx.easeOutCubic(p / 0.55);
    else s = 1.4 - 0.4 * gfx.easeInOutQuad((p - 0.55) / 0.45);
    ctx.save();
    ctx.translate(375, top + 110);
    ctx.scale(Math.max(0.01, s), Math.max(0.01, s));
    gfx.drawText(ctx, '💔', 0, 0, { size: 150, align: 'center', baseline: 'middle' });
    ctx.restore();

    gfx.drawText(ctx, '耐心耗尽 · 诊断失败', 375, top + 210, { size: 40, bold: true, align: 'center', color: C.accent });
    gfx.drawText(ctx, '勇哥摔了耳机……"下一个！"', 375, top + 268, { size: 30, align: 'center' });
    gfx.drawText(ctx, '店主还在追问，你的诊断被愤怒地打断了', 375, top + 314, {
      size: 24, color: C.muted, align: 'center',
    });

    // 按钮（render 边画边记，命中同源）
    this.buttons = [];
    const canRevive = !store.state.revived; // 已复活过或复活后再败 → 隐藏
    let by = top + 390;
    const add = (id, label, theme, action) => {
      const b = { id, x: 100, y: by, w: 550, h: 92, label, theme, enabled: true, action };
      this.buttons.push(b);
      gfx.drawButton(ctx, b);
      by += 92 + 20;
    };
    if (canRevive) add('revive', '📺 复活续命 +2 ❤️', 'primary', () => this.onRevive());
    add('share', '📤 求助好友 帮我诊断', 'ghost', () => this.onHelpShare());
    add('retry', '🔄 重新诊断这家店', canRevive ? 'green' : 'primary', () => this.onRetry());
    add('back', '返回关卡选择', 'ghost', () => this.onBack());

    gfx.drawToast(ctx, this.toast, now);
  },
};
