/* =====================================================================
 * js/scenes/link.js — 连线场景（点选 + 手指拖动连线）
 * 左列 = connectPairs 原顺序；右列 = store.rightOrder（洗牌）。
 * 配对语义不变：store.selectLeft / store.selectRight（index-vs-index）。
 * 拖动：选中左卡后 onMove 记录触点，render 画实时金线；
 *       onEnd 落在右卡 rect 内视同点该右卡，落空白则取消选择。
 * ===================================================================== */
const store = require('../core/state.js');
const router = require('../core/router.js');
const gfx = require('../core/gfx.js');
const layout = require('../core/layout.js');
const audio = require('../core/audio.js');
const fx = require('../core/fx.js');
const { track } = require('../core/track.js');
const C = gfx.C;

module.exports = {
  leftCards: [],      // [{i, rect, label}]
  rightCards: [],     // [{pairIndex, rect, label}]
  flash: null,        // {fromIdx, toIdx, until} 错配红线
  toast: null,
  dragPt: null,       // 拖动中手指位置 {x, y}
  continueBtn: null,
  _timers: [],

  onEnter() {
    store.markStage('link');
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
    this.flash = null;
    this.toast = null;
    this.dragPt = null;
    this.continueBtn = null;
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
  // store 没有取消选择的 API，选中态是场景内交互态，直接复位该字段
  deselect() {
    store.state.selectedLeft = null;
    this.dragPt = null;
  },

  onTap(x, y) {
    if (this.continueBtn && gfx.hit(x, y, this.continueBtn)) {
      if (store.allConnected()) {
        const lv = store.getLevel();
        track('link_done', { count: lv.connectPairs.length });
        router.switchScene('rescue');
      }
      return;
    }
    // 左列（再点已选中的原卡 = 取消）
    for (const c of this.leftCards) {
      if (gfx.hit(x, y, c.rect)) {
        if (store.state.selectedLeft === c.i) this.deselect();
        else store.selectLeft(c.i);
        return;
      }
    }
    // 右列
    for (const c of this.rightCards) {
      if (gfx.hit(x, y, c.rect)) { this.onRightTap(c.pairIndex); return; }
    }
    // 点空白取消选择
    if (store.state.selectedLeft !== null) this.deselect();
  },

  onMove(x, y) {
    if (store.state.selectedLeft === null) return;
    this.dragPt = { x, y };
  },

  onEnd(x, y) {
    if (!this.dragPt) return; // 普通点击已走 onTap，无需处理
    this.dragPt = null;
    if (store.state.selectedLeft === null) return; // onTap 里已判定完
    for (const c of this.rightCards) {
      if (gfx.hit(x, y, c.rect)) { this.onRightTap(c.pairIndex); return; }
    }
    this.deselect(); // 松手落在空白 = 取消选择
  },

  onRightTap(pi) {
    const r = store.selectRight(pi);
    this.dragPt = null;
    if (r.needLeft) {
      this.toast = { text: '先点左侧的「错误原因」', until: Date.now() + 1400 };
      return;
    }
    if (r.locked) return;
    if (r.correct) {
      const rc = this.rightCardOf(pi);
      if (rc) {
        const c = this.center(rc);
        fx.sparks(c.x, c.y, C.green);
        fx.floater(c.x, c.y - 12, '+1', C.green);
      }
      const lc = this.leftCards[r.pairIndex];
      if (lc) {
        const c = this.center(lc);
        fx.floater(c.x, c.y - 12, '+1', C.green);
      }
      audio.play('correct');
    } else if (r.pairIndex !== null) {
      this.flash = { fromIdx: r.pairIndex, toIdx: r.wrongRight, until: Date.now() + 600 };
      fx.flash();
      fx.shake(4);
      audio.play('wrong');
      if (r.failed) {
        this._timers.push(setTimeout(() => router.switchScene('fail'), 700));
      }
    }
  },

  /* ---------- 渲染 ---------- */
  render(ctx) {
    gfx.drawBg(ctx);
    const now = Date.now();
    gfx.drawHud(ctx, store.state.score, store.state.patience, store.state.patienceMax);
    const lv = store.getLevel();
    if (!lv) return;

    // 头部
    const top = layout.topInset + 84 + 10;
    gfx.drawText(ctx, '🔗 连线 · 错误配对', 375, top, { size: 32, bold: true, align: 'center' });
    gfx.drawText(ctx, '点左卡再点右卡，或按住左卡直接拖到右卡上', 375, top + 40, {
      size: 22, color: C.muted, align: 'center',
    });
    const connected = Object.keys(store.state.connected).length;
    gfx.drawText(ctx, `已配对 ${connected}/${lv.connectPairs.length}`, 375, top + 74, {
      size: 24, bold: true, color: C.gold, align: 'center',
    });

    // 卡片 + 线
    this.renderCards(ctx);
    this.drawLines(ctx, now);

    // 底部继续
    const btnY = layout.LOGICAL_H - layout.bottomInset - 96;
    const done = store.allConnected();
    this.continueBtn = {
      x: 40, y: btnY, w: 750 - 80, h: 90,
      label: done ? '全部配对 · 进入急救阶段 →' : '连对所有配对后继续',
      theme: 'primary', enabled: done,
    };
    gfx.drawButton(ctx, this.continueBtn);

    gfx.drawToast(ctx, this.toast, now);
  },

  renderCards(ctx) {
    const connected = store.state.connected;
    // 左列（选中浮起 y-6）
    for (const c of this.leftCards) {
      const r = c.rect;
      const locked = !!connected[c.i];
      const selected = !locked && store.state.selectedLeft === c.i;
      const dy = selected ? -6 : 0;
      const fill = locked ? 'rgba(22,199,154,0.16)' : selected ? 'rgba(245,197,24,0.12)' : C.glass;
      gfx.fillRoundShadow(ctx, r.x, r.y + dy, r.w, r.h, 18, fill, { blur: selected ? 30 : 22 });
      gfx.strokeRound(ctx, r.x, r.y + dy, r.w, r.h, 18,
        locked ? C.green : selected ? C.gold : C.glassBorder, selected ? 3.5 : 2);
      this.cardText(ctx, c, r.y + dy, locked);
      if (locked) this.checkBadge(ctx, r.x + r.w - 26, r.y + dy + 26);
    }
    // 右列
    for (const c of this.rightCards) {
      const r = c.rect;
      const locked = !!connected[c.pairIndex];
      const fill = locked ? 'rgba(22,199,154,0.16)' : C.glass;
      gfx.fillRoundShadow(ctx, r.x, r.y, r.w, r.h, 18, fill, { blur: 22 });
      gfx.strokeRound(ctx, r.x, r.y, r.w, r.h, 18, locked ? C.green : C.glassBorder, 2);
      this.cardText(ctx, c, r.y, locked);
      if (locked) this.checkBadge(ctx, r.x + 26, r.y + 26);
    }
  },

  cardText(ctx, c, topY, locked) {
    const r = c.rect;
    ctx.save();
    ctx.beginPath();
    gfx.roundRectPath(ctx, r.x, topY, r.w, r.h, 18);
    ctx.clip();
    const size = r.h > 150 ? 26 : 23;
    const lines = gfx.wrapLines(ctx, c.label, r.w - 30, size);
    gfx.drawWrapped(ctx, c.label, r.x + r.w / 2, topY + r.h / 2 - ((lines.length - 1) * (size * 1.4)) / 2,
      r.w - 30, size * 1.5, {
        size, align: 'center', color: locked ? C.green : C.text, bold: true,
      });
    ctx.restore();
  },

  checkBadge(ctx, bx, by) {
    ctx.beginPath();
    ctx.arc(bx, by, 15, 0, Math.PI * 2);
    ctx.fillStyle = C.green;
    ctx.fill();
    gfx.drawText(ctx, '✓', bx, by, { size: 20, bold: true, color: '#fff', align: 'center', baseline: 'middle' });
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
    // 正确连线（绿，发光）
    for (let i = 0; i < n; i++) {
      if (!store.state.connected[i]) continue;
      const rc = this.rightCardOf(i);
      if (!rc) continue;
      this.curve(ctx, this.center(this.leftCards[i]), this.center(rc), C.green, 4, 12);
    }
    // 错配闪线（红，600ms）
    if (this.flash && now < this.flash.until) {
      const rc = this.rightCardOf(this.flash.toIdx);
      const lc = this.leftCards[this.flash.fromIdx];
      if (rc && lc) this.curve(ctx, this.center(lc), this.center(rc), C.accent, 4, 12);
    }
    // 拖动中的实时金线（左卡中心 → 触点）
    const sel = store.state.selectedLeft;
    if (sel !== null && this.dragPt && !store.state.connected[sel]) {
      const lc = this.leftCards[sel];
      if (lc) {
        const from = this.center(lc);
        from.y -= 6; // 选中浮起，线头跟着抬
        this.curve(ctx, from, this.dragPt, C.gold, 4, 10);
        ctx.beginPath();
        ctx.arc(this.dragPt.x, this.dragPt.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = C.gold;
        ctx.fill();
      }
    }
  },

  curve(ctx, p1, p2, color, lw, blur) {
    const mx = (p1.x + p2.x) / 2;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(mx, Math.min(p1.y, p2.y) - 26, p2.x, p2.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw || 4;
    if (blur) {
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
    }
    ctx.stroke();
    ctx.restore();
  },
};
