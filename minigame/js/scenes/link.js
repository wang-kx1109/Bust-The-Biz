/* =====================================================================
 * js/scenes/link.js — 连线场景
 * 左列 = connectPairs 原顺序；右列 = store.rightOrder（洗牌）。
 * 卡片按 pair index 匹配（index-vs-index）。全 canvas，无需 DOM 测量。
 * ===================================================================== */
const store = require('../core/state.js');
const router = require('../core/router.js');
const gfx = require('../core/gfx.js');
const layout = require('../core/layout.js');
const C = gfx.C;

module.exports = {
  leftCards: [],     // [{i, rect, label}]
  rightCards: [],    // [{pairIndex, rect, label}]
  flash: null,       // {fromIdx, toIdx, until}
  toast: null,
  _timers: [],

  onEnter() {
    store.markStage('link');
    this._timers = [];
    if (!store.getLevel()) { router.switchScene('select'); return; }
    this.buildLayout();
  },
  onExit() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
  },
  update(dt, now) {
    if (this.flash && now > this.flash.until) this.flash = null;
    if (this.toast && now > this.toast.until) this.toast = null;
  },

  buildLayout() {
    const lv = store.getLevel();
    const n = lv.connectPairs.length;
    const top = layout.topInset + 84 + 130; // 头部下方
    const bottom = layout.LOGICAL_H - layout.bottomInset - 130;
    const areaH = bottom - top;
    const gap = 18;
    const colW = 325;
    const cardH = (areaH - gap * (n - 1)) / n;
    const leftX = 40, rightX = 750 - 40 - colW;

    this.leftCards = lv.connectPairs.map((p, i) => ({
      i, label: p.left,
      rect: { x: leftX, y: top + i * (cardH + gap), w: colW, h: cardH },
    }));
    this.rightCards = store.state.rightOrder.map((pi, idx) => ({
      pairIndex: pi,
      label: lv.connectPairs[pi].right,
      rect: { x: rightX, y: top + idx * (cardH + gap), w: colW, h: cardH },
    }));
  },

  /* ---------- 交互 ---------- */
  onTap(x, y) {
    if (this.continueBtn && gfx.hit(x, y, this.continueBtn) && store.allConnected()) {
      router.switchScene('rescue');
      return;
    }
    // 左列
    for (const c of this.leftCards) {
      if (gfx.hit(x, y, c.rect)) { this.onLeftTap(c.i); return; }
    }
    // 右列
    for (const c of this.rightCards) {
      if (gfx.hit(x, y, c.rect)) { this.onRightTap(c.pairIndex); return; }
    }
  },

  onLeftTap(i) {
    store.selectLeft(i);
  },

  onRightTap(pi) {
    const r = store.selectRight(pi);
    if (r.needLeft) {
      this.toast = { text: '先点左侧的「错误原因」', until: Date.now() + 1400 };
      return;
    }
    if (r.locked) return;
    if (r.correct) {
      // 锁定，下一帧画绿线
    } else if (r.pairIndex !== null) {
      this.flash = { fromIdx: r.pairIndex, toIdx: r.wrongRight, until: Date.now() + 600 };
      if (r.failed) {
        this._timers.push(setTimeout(() => router.switchScene('fail'), 700));
      }
    }
  },

  /* ---------- 渲染 ---------- */
  render(ctx) {
    gfx.drawBg(ctx);
    const now = Date.now();
    gfx.drawHud(ctx, store.state.score, store.state.patience, 5);
    const lv = store.getLevel();

    // 头部
    const top = layout.topInset + 84 + 10;
    gfx.drawText(ctx, '🔗 连线 · 错误配对', 375, top, { size: 32, bold: true, align: 'center' });
    gfx.drawText(ctx, '先点左边「原因」，再点右边「后果」', 375, top + 40, { size: 22, color: C.muted, align: 'center' });
    const connected = Object.keys(store.state.connected).length;
    gfx.drawText(ctx, `已配对 ${connected}/${lv.connectPairs.length}`, 375, top + 72, {
      size: 24, bold: true, color: C.gold, align: 'center',
    });

    // 卡片
    this.renderCard(ctx, this.leftCards, true);
    this.renderCard(ctx, this.rightCards, false);

    // 线（卡片上方）
    this.drawLines(ctx, now);

    // 底部继续
    const btnY = layout.LOGICAL_H - layout.bottomInset - 96;
    this.continueBtn = { x: 40, y: btnY, w: 750 - 80, h: 90, label: '进入急救阶段 →', theme: 'primary', enabled: store.allConnected() };
    gfx.drawButton(ctx, this.continueBtn);

    gfx.drawToast(ctx, this.toast, now);
  },

  renderCard(ctx, cards, isLeft) {
    for (const c of cards) {
      const r = c.rect;
      const lv = store.getLevel();
      const connected = store.state.connected;
      const locked = isLeft ? connected[c.i] : connected[c.pairIndex];
      const selected = isLeft && store.state.selectedLeft === c.i;

      if (locked) {
        gfx.fillRound(ctx, r.x, r.y, r.w, r.h, 18, 'rgba(22,199,154,0.15)');
        gfx.strokeRound(ctx, r.x, r.y, r.w, r.h, 18, C.green, 2);
      } else if (selected) {
        gfx.fillRound(ctx, r.x, r.y, r.w, r.h, 18, 'rgba(245,197,24,0.1)');
        gfx.strokeRound(ctx, r.x, r.y, r.w, r.h, 18, C.gold, 3);
      } else {
        gfx.card(ctx, r.x, r.y, r.w, r.h, 18);
      }
      // 文字（右列可能较长，居中换行）
      ctx.save();
      ctx.beginPath();
      gfx.roundRectPath(ctx, r.x, r.y, r.w, r.h, 18);
      ctx.clip();
      const size = r.h > 150 ? 26 : 23;
      gfx.drawWrapped(ctx, c.label, r.x + r.w / 2, r.y + r.h / 2 - ((gfx.wrapLines(ctx, c.label, r.w - 30, size).length - 1) * (size * 1.4) / 2), r.w - 30, size * 1.5, {
        size, align: 'center', color: locked ? C.green : C.text, bold: true,
      });
      ctx.restore();
    }
  },

  center(c) {
    return { x: c.rect.x + c.rect.w / 2, y: c.rect.y + c.rect.h / 2 };
  },
  rightCardOf(pairIndex) {
    return this.rightCards.find(c => c.pairIndex === pairIndex);
  },

  drawLines(ctx, now) {
    const lv = store.getLevel();
    const n = lv.connectPairs.length;
    // 正确连线（绿）
    for (let i = 0; i < n; i++) {
      if (!store.state.connected[i]) continue;
      const rc = this.rightCardOf(i);
      if (!rc) continue;
      this.line(ctx, this.center(this.leftCards[i]), this.center(rc), C.green, now);
    }
    // 错误闪线（红）
    if (this.flash && now < this.flash.until) {
      const rc = this.rightCardOf(this.flash.toIdx);
      const lc = this.leftCards[this.flash.fromIdx];
      if (rc && lc) this.line(ctx, this.center(lc), this.center(rc), C.accent, now);
    }
  },

  line(ctx, p1, p2, color) {
    const mx = (p1.x + p2.x) / 2;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(mx, p1.y - 30, p2.x, p2.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
  },
};