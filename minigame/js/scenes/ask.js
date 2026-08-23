/* =====================================================================
 * js/scenes/ask.js — 连麦审问场景
 * askStep：0开场 → 1环视 → 2/3/4三连问 → 5老王 → 6进找茬
 *
 * 设计要点：render() 单次遍历即完成"测量 + 绘制 + 记录命中矩形"，
 * 按钮/卡片的 rect 每帧重建，onTap 用最新 rect 做命中 —— 视觉与命中永不漂移。
 * ===================================================================== */
const store = require('../core/state.js');
const router = require('../core/router.js');
const gfx = require('../core/gfx.js');
const layout = require('../core/layout.js');
const C = gfx.C;

const MX = 35;
const CW = 750 - MX * 2;

module.exports = {
  buttons: [],
  clueRects: [],
  optRects: [],
  feedback: null,
  optionCls: [],
  locked: false,
  toast: null,
  _timers: [],
  _now: 0,
  _lastStep: -1,

  /* ---------- 生命周期 ---------- */
  onEnter() {
    store.markStage('ask');
    this._timers = [];
    this.resetQState();
    if (!store.getLevel() || store.state.askStep > 6) {
      router.switchScene('select');
      return;
    }
  },
  onExit() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
  },
  update(dt, now) {
    this._now = now;
    if (this.toast && now > this.toast.until) this.toast = null;
  },
  resetQState() {
    this._lastStep = -1;
    this.locked = false;
    this.feedback = null;
    this.optionCls = [];
  },

  /* ---------- 交互 ---------- */
  onTap(x, y) {
    const step = store.state.askStep;
    if (step >= 2 && step <= 4 && !this.locked) {
      for (const o of this.optRects) {
        if (gfx.hit(x, y, o.rect)) { this.onAnswer(o.i); return; }
      }
    }
    if (step === 1) {
      for (const e of this.clueRects) {
        if (gfx.hit(x, y, e.rect)) { this.onClueTap(e.id); return; }
      }
    }
    for (const b of this.buttons) {
      if (b.enabled === false) continue;
      if (gfx.hit(x, y, b)) { b.action(); return; }
    }
  },

  onClueTap(id) {
    const r = store.toggleClue(id);
    if (r.full) {
      this.toast = { text: `最多收藏 ${store.getLevel().interview.maxClues} 条线索`, until: Date.now() + 1600 };
      return;
    }
    // 下一帧 render 会按 store.state.savedClues 重画，无需手动更新
  },

  onAnswer(i) {
    const lv = store.getLevel();
    const qslot = store.state.askStep - 2;
    const q = lv.interview.questions[qslot];
    const r = store.answerQuestion(qslot, i);

    const cls = q.options.map((o, idx) => {
      if (idx === i) return r.correct ? 'green' : 'red';
      if (!r.correct && o.correct) return 'green';
      return '';
    });
    this.optionCls = cls;
    this.locked = true;
    this.feedback = { type: r.correct ? 'ok' : 'no', text: r.reveal };

    this._timers.push(setTimeout(() => {
      if (r.failed) { router.switchScene('fail'); return; }
      store.advanceAsk();
      this.locked = false;
      this.feedback = null;
      this.optionCls = [];
    }, 900));
  },

  next() {
    store.advanceAsk();
    this.resetQState();
  },
  toPhone() {
    store.phoneVerified();
    router.switchScene('find');
  },

  /* ---------- 渲染 ---------- */
  render(ctx) {
    gfx.drawBg(ctx);
    const top = layout.topInset;
    gfx.drawHud(ctx, store.state.score, store.state.patience, 5);
    this.drawVideo(ctx);

    const contentTop = top + 84 + 6 + 330 + 16;
    const lv = store.getLevel();
    if (!lv) return;
    const owner = lv.interview.owner;
    const step = store.state.askStep;

    this.buttons = [];
    this.clueRects = [];
    this.optRects = [];

    let y = contentTop;

    if (step === 0) {
      y = this.drawBubble(ctx, y, `${owner.emoji} ${owner.name}`, owner.intro);
      this.addButton('📞 让店主拿手机转一圈看看', 'primary', y + 24, () => this.next());
    } else if (step === 1) {
      y = this.drawBubble(ctx, y, `${owner.emoji} ${owner.name}`, '好嘞！我给你转一圈啊，你看看我这地段，绝对黄金位置！');
      y += 36;
      gfx.drawText(ctx, `📸 点击卡片收藏线索（最多 ${lv.interview.maxClues} 条）`, 375, y, {
        size: 22, color: C.muted, align: 'center',
      });
      y += 40;
      const cw = (CW - 20) / 2, ch = 230;
      lv.interview.envClues.forEach((clue, i) => {
        const col = i % 2, row = (i / 2) | 0;
        const rect = { x: MX + col * (cw + 20), y: y + row * (ch + 20), w: cw, h: ch };
        const saved = store.state.savedClues.indexOf(clue.id) >= 0;
        this.clueRects.push({ id: clue.id, rect, saved });

        gfx.card(ctx, rect.x, rect.y, rect.w, rect.h, 20, {
          fill: saved ? 'rgba(22,199,154,0.12)' : C.glass,
          border: saved ? C.green : C.glassBorder,
        });
        gfx.drawText(ctx, clue.icon, rect.x + rect.w / 2, rect.y + 24, { size: 54, align: 'center' });
        gfx.drawText(ctx, clue.label, rect.x + rect.w / 2, rect.y + 92, { size: 28, bold: true, align: 'center' });
        gfx.drawWrapped(ctx, clue.desc, rect.x + rect.w / 2, rect.y + 132, rect.w - 40, 34, {
          size: 22, color: C.muted, align: 'center',
        });
        if (saved) {
          gfx.drawText(ctx, '✓ 已存', rect.x + rect.w - 34, rect.y + 10, { size: 20, color: C.green, align: 'center', bold: true });
        }
      });
      y += 2 * ch + 20;
      gfx.drawText(ctx, `已存 ${store.state.savedClues.length}/${lv.interview.maxClues}`, 375, y + 8, {
        size: 24, color: C.muted, align: 'center',
      });
      this.addButton('开始夺命三连问 →', 'primary', y + 40, () => this.next());
    } else if (step >= 2 && step <= 4) {
      // 进入新题时重置答题态
      if (this._lastStep !== step) {
        this._lastStep = step;
        this.locked = false;
        this.feedback = null;
        this.optionCls = [];
      }
      const q = lv.interview.questions[step - 2];
      y = this.drawBubble(ctx, y, `🕵️ 你（第 ${step - 1} 问）`, q.ask);
      y += 16;
      y = this.drawBubble(ctx, y, `${owner.emoji} ${owner.name}（含糊其辞）`, q.vague);
      y += 20;
      q.options.forEach((o, i) => {
        const rect = { x: MX, y, w: CW, h: 88 };
        this.optRects.push({ i, rect });
        const cls = this.optionCls[i];
        if (cls === 'green') gfx.fillRound(ctx, rect.x, rect.y, rect.w, rect.h, 18, 'rgba(22,199,154,0.22)');
        else if (cls === 'red') gfx.fillRound(ctx, rect.x, rect.y, rect.w, rect.h, 18, 'rgba(233,69,96,0.22)');
        else gfx.fillRound(ctx, rect.x, rect.y, rect.w, rect.h, 18, 'rgba(255,255,255,0.08)');
        gfx.strokeRound(ctx, rect.x, rect.y, rect.w, rect.h, 18,
          cls === 'green' ? C.green : (cls === 'red' ? C.accent : C.glassBorder), 2);
        gfx.drawText(ctx, o.label, rect.x + 28, rect.y + rect.h / 2, { size: 30, baseline: 'middle' });
        y += 88 + 16;
      });
      if (this.feedback) {
        gfx.drawText(ctx, this.feedback.text, MX + 20, y, {
          size: 28, bold: true, color: this.feedback.type === 'ok' ? C.green : C.lossText,
        });
      }
    } else if (step === 5) {
      const n = lv.interview.neighbor;
      y = this.drawBubble(ctx, y, '🕵️ 你', `我打个电话给隔壁${n.name}，交叉验证一下。`);
      y += 16;
      y = this.drawPhoneCard(ctx, n, y);
      this.addButton('🔍 进入找茬阶段 →', 'primary', y + 24, () => this.toPhone());
    } else if (step >= 6) {
      this.toPhone();
      return;
    }

    // 按钮（最后绘制，保证在最上层）
    for (const b of this.buttons) gfx.drawButton(ctx, b);
    gfx.drawToast(ctx, this.toast, Date.now());
  },

  addButton(label, theme, y, action, enabled) {
    const b = { x: MX, y, w: CW, h: 90, label, theme, action, enabled: enabled !== false };
    this.buttons.push(b);
    return y + 90;
  },

  /* ---------- 绘制原语 ---------- */
  drawBubble(ctx, top, who, text) {
    const pad = 26;
    const wp = CW - 56;
    const lines = gfx.wrapLines(ctx, text, wp, 28);
    const h = 30 + pad + lines.length * 42;
    gfx.fillRound(ctx, MX, top, CW, h, 18, C.bubble);
    gfx.strokeRound(ctx, MX, top, CW, h, 18, C.glassBorder, 1);
    if (who) gfx.drawText(ctx, who, MX + 24, top + 14, { size: 22, bold: true, color: C.gold });
    gfx.drawWrapped(ctx, text, MX + 24, top + 44, wp, 42, { size: 28 });
    return top + h;
  },

  drawPhoneCard(ctx, n, top) {
    const x = MX, w = CW;
    let lines = 0;
    (n.texts || []).forEach(t => { lines += gfx.wrapLines(ctx, t, w - 56, 26).length; });
    const h = 84 + lines * 38 + 40;
    gfx.fillRound(ctx, x, top, w, h, 18, C.bubble);
    gfx.strokeRound(ctx, x, top, w, h, 18, C.glassBorder, 1);
    gfx.drawText(ctx, `${n.emoji} ${n.title}`, x + 24, top + 18, { size: 26, bold: true, color: C.gold });
    let yy = top + 60;
    (n.texts || []).forEach(text => {
      yy = gfx.drawWrapped(ctx, text, x + 24, yy, w - 48, 38, { size: 26 });
    });
    gfx.fillRound(ctx, x + 24, yy + 8, w - 48, 40, 10, 'rgba(22,199,154,0.2)');
    gfx.drawText(ctx, n.reveal, x + 24, yy + 16, { size: 24, bold: true, color: C.green });
    return top + h;
  },

  drawVideo(ctx) {
    const x = MX, y = layout.topInset + 84 + 6, w = CW, h = 330;
    gfx.fillRound(ctx, x, y, w, h, 24, '#0f1630');
    gfx.strokeRound(ctx, x, y, w, h, 24, C.glassBorder, 2);
    const grad = ctx.createRadialGradient(x + w * 0.35, y + h * 0.38, 20, x + w * 0.5, y + h * 0.5, h * 0.7);
    grad.addColorStop(0, '#2c2c55');
    grad.addColorStop(1, '#14142b');
    ctx.fillStyle = grad;
    gfx.roundRectPath(ctx, x + 3, y + 3, w - 6, h - 6, 21);
    ctx.fill();

    const lv = store.getLevel();
    const owner = lv ? lv.interview.owner : null;
    const t = this._now * 0.0035;
    if (owner) {
      gfx.drawText(ctx, owner.emoji, x + w / 2 + Math.sin(t * 1.7) * 5, y + h / 2 + Math.cos(t * 2.3) * 5, {
        size: 168, align: 'center', baseline: 'middle',
      });
    }
    gfx.fillRound(ctx, x + 14, y + 14, 118, 40, 12, 'rgba(0,0,0,0.6)');
    gfx.drawText(ctx, '● REC 00:12', x + 26, y + 22, { size: 20, color: '#fff' });

    ctx.beginPath();
    ctx.arc(x + w - 68, y + h - 68, 34, 0, Math.PI * 2);
    ctx.fillStyle = C.accent;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    gfx.drawText(ctx, '🕵️', x + w - 68, y + h - 76, { size: 32, align: 'center' });
    gfx.drawText(ctx, owner ? owner.camHint : '店主正拿手机转圈…', x + w - 24, y + h - 100, {
      size: 20, color: C.muted, align: 'right',
    });
  },
};