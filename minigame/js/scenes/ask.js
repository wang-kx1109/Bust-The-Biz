/* =====================================================================
 * js/scenes/ask.js — 连麦审问场景（v0.3 直播间主舞台版）
 * askStep：0开场 → 1环视 → 2/3/4三连问 → 5老王 → 6进找茬
 *
 * v0.3 新增：
 *  - 视频窗：emoji 呼吸浮动 + 手持抖动、REC 闪烁、信号格、表情气泡
 *  - 气泡打字机（18ms/字，高度按完整文本预测量 → 命中同源）
 *  - retryable 关卡追问：答错返回 retry:true 时选项保持可点，
 *    仅已选错项标记不可再选；非 retryable 维持 900ms 后推进
 * ===================================================================== */
const store = require('../core/state.js');
const router = require('../core/router.js');
const gfx = require('../core/gfx.js');
const layout = require('../core/layout.js');
const fx = require('../core/fx.js');
const audio = require('../core/audio.js');
const C = gfx.C;

const MX = 35;
const CW = 750 - MX * 2;
const TYPE_MS = 18;

// 答错时店主表情（按 persona.type 映射）
const FACE = {
  confused: '😵', stubborn: '😤', blamer: '🙄', influencer: '😎', broken: '😭',
  honest: '😟', arrogant: '😏', idealist: '🤔', gambler: '🤑', elder: '😮',
};

module.exports = {
  buttons: [],
  clueRects: [],
  optRects: [],
  feedback: null,
  optionCls: [],
  deadOpts: [],      // 追问关卡中已选错、不可再选的选项 index
  optShake: [],      // 答错抖动起点 per index
  locked: false,
  face: null,        // {emoji, t0} 店主表情气泡
  toast: null,
  _timers: [],
  _now: 0,
  _lastStep: -1,
  _stepT0: 0,

  /* ---------- 生命周期 ---------- */
  onEnter() {
    store.markStage('ask');
    this._timers = [];
    this.resetQState();
    const lv = store.getLevel();
    if (!lv || store.state.askStep > 6) {
      router.switchScene('select');
      return;
    }
    fx.setDanmakuPool(lv.interview.danmaku);
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
    this.deadOpts = [];
    this.optShake = [];
    this.face = null;
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
    if (r.saved) audio.play('click');
  },

  onAnswer(i) {
    if (this.locked || this.deadOpts.indexOf(i) >= 0) return;
    const lv = store.getLevel();
    const qslot = store.state.askStep - 2;
    const r = store.answerQuestion(qslot, i);
    const hitRect = (this.optRects.find(o => o.i === i) || {}).rect;

    if (r.correct) {
      this.optionCls[i] = 'green';
      audio.play('correct');
      if (hitRect) fx.floater(hitRect.x + hitRect.w / 2, hitRect.y + hitRect.h / 2, '+1', C.gold);
      this.face = { emoji: '🥳', t0: Date.now() };
      this.locked = true;
      this.feedback = { type: 'ok', text: r.reveal };
      this._timers.push(setTimeout(() => {
        if (r.failed) { router.switchScene('fail'); return; }
        store.advanceAsk();
        this.locked = false;
        this.feedback = null;
        this.optionCls = [];
        this.deadOpts = [];
      }, 900));
      return;
    }

    // 答错：红描边 + 抖动 + 红闪 + 屏震 + 扣耐心音效
    this.optionCls[i] = 'red';
    this.optShake[i] = Date.now();
    audio.play('wrong');
    fx.flash();
    fx.shake(4);
    audio.play('heart');
    const persona = lv.persona || {};
    this.face = { emoji: FACE[persona.type] || '😀', t0: Date.now() };

    if (r.retry) {
      // 追问：本题保持可点，仅排除已选错项；reveal + 「再想想！」
      this.deadOpts.push(i);
      this.feedback = { type: 'retry', text: r.reveal };
      if (r.failed) {
        this.locked = true;
        this._timers.push(setTimeout(() => router.switchScene('fail'), 900));
      }
    } else {
      this.locked = true;
      this.feedback = { type: 'no', text: r.reveal };
      this._timers.push(setTimeout(() => {
        if (r.failed) { router.switchScene('fail'); return; }
        store.advanceAsk();
        this.locked = false;
        this.feedback = null;
        this.optionCls = [];
        this.deadOpts = [];
      }, 900));
    }
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
    const now = this._now || Date.now();
    gfx.drawBg(ctx);
    gfx.drawHud(ctx, store.state.score, store.state.patience, store.state.patienceMax);
    this.drawVideo(ctx, now);

    const lv = store.getLevel();
    if (!lv) return;
    const owner = lv.interview.owner;
    const step = store.state.askStep;

    this.buttons = [];
    this.clueRects = [];
    this.optRects = [];
    if (this._lastStep !== step) {
      this._lastStep = step;
      this._stepT0 = now;
      this.locked = false;
      this.feedback = null;
      this.optionCls = [];
      this.deadOpts = [];
      this.optShake = [];
    }

    let y = layout.topInset + 90 + 330 + 16;

    if (step === 0) {
      const chips = lv.persona
        ? [{ text: lv.persona.tag, gold: true }, { text: `“${lv.persona.catchphrase}”` }]
        : [];
      y = this.drawBubble(ctx, y, `${owner.emoji} ${owner.name}`, owner.intro, 0, chips, now);
      this.addButton('📞 让店主拿手机转一圈看看', 'primary', y + 24, () => this.next());
    } else if (step === 1) {
      y = this.drawBubble(ctx, y, `${owner.emoji} ${owner.name}`, '好嘞！我给你转一圈啊，你看看我这地段，绝对黄金位置！', 0, null, now);
      y += 30;
      gfx.drawText(ctx, `📸 点击卡片收藏线索（最多 ${lv.interview.maxClues} 条）`, 375, y, {
        size: 22, color: C.muted, align: 'center',
      });
      y += 40;
      const cw = (CW - 16) / 2, ch = 210;
      lv.interview.envClues.forEach((clue, i) => {
        const col = i % 2, row = (i / 2) | 0;
        const rect = { x: MX + col * (cw + 16), y: y + row * (ch + 16), w: cw, h: ch };
        const saved = store.state.savedClues.indexOf(clue.id) >= 0;
        this.clueRects.push({ id: clue.id, rect, saved });

        gfx.card(ctx, rect.x, rect.y, rect.w, rect.h, 20, {
          fill: saved ? 'rgba(22,199,154,0.12)' : C.glass,
          border: saved ? C.green : C.glassBorder,
        });
        gfx.drawText(ctx, clue.icon, rect.x + rect.w / 2, rect.y + 22, { size: 50, align: 'center' });
        gfx.drawText(ctx, clue.label, rect.x + rect.w / 2, rect.y + 86, { size: 28, bold: true, align: 'center' });
        gfx.drawWrapped(ctx, clue.desc, rect.x + rect.w / 2, rect.y + 126, rect.w - 40, 32, {
          size: 22, color: C.muted, align: 'center',
        });
        if (saved) {
          gfx.fillRound(ctx, rect.x + rect.w - 92, rect.y + 10, 82, 32, 16, 'rgba(22,199,154,0.2)');
          gfx.drawText(ctx, '✓ 已存', rect.x + rect.w - 51, rect.y + 26, {
            size: 20, color: C.green, align: 'center', baseline: 'middle', bold: true,
          });
        }
      });
      y += 2 * ch + 16;
      gfx.drawText(ctx, `已存 ${store.state.savedClues.length}/${lv.interview.maxClues}`, 375, y + 6, {
        size: 24, color: C.muted, align: 'center',
      });
      this.addButton('开始夺命三连问 →', 'primary', y + 38, () => this.next());
    } else if (step >= 2 && step <= 4) {
      const q = lv.interview.questions[step - 2];
      y = this.drawBubble(ctx, y, `🕵️ 你（第 ${step - 1} 问）`, q.ask, 0, null, now);
      const askLen = q.ask.length * TYPE_MS + 350;
      y = this.drawBubble(ctx, y, `${owner.emoji} ${owner.name}（含糊其辞）`, q.vague, askLen, null, now);
      y += 20;
      q.options.forEach((o, i) => {
        const rect = { x: MX, y, w: CW, h: 88 };
        this.optRects.push({ i, rect });
        const cls = this.optionCls[i];
        const dead = this.deadOpts.indexOf(i) >= 0;
        const sh = gfx.shakeXY(now, this.optShake[i], 9, 450);
        ctx.save();
        ctx.translate(sh.dx, 0);
        if (cls === 'green') gfx.fillRound(ctx, rect.x, rect.y, rect.w, rect.h, 18, 'rgba(22,199,154,0.22)');
        else if (cls === 'red') gfx.fillRound(ctx, rect.x, rect.y, rect.w, rect.h, 18, 'rgba(233,69,96,0.22)');
        else gfx.fillRound(ctx, rect.x, rect.y, rect.w, rect.h, 18, 'rgba(255,255,255,0.08)');
        gfx.strokeRound(ctx, rect.x, rect.y, rect.w, rect.h, 18,
          cls === 'green' ? C.green : (cls === 'red' ? C.accent : C.glassBorder),
          cls ? 3 : 2);
        gfx.drawText(ctx, o.label, rect.x + 28, rect.y + rect.h / 2, {
          size: 30, baseline: 'middle',
          color: dead ? 'rgba(234,234,242,0.4)' : C.text,
        });
        if (dead) {
          gfx.drawText(ctx, '✗', rect.x + rect.w - 40, rect.y + rect.h / 2, {
            size: 30, baseline: 'middle', align: 'center', color: C.accent, bold: true,
          });
        }
        ctx.restore();
        y += 88 + 16;
      });
      if (this.feedback) {
        const fb = this.feedback;
        const text = fb.type === 'retry' ? `${fb.text} —— 🤔 再想想！` : fb.text;
        const color = fb.type === 'ok' ? C.green : (fb.type === 'retry' ? C.amber : C.lossText);
        gfx.drawText(ctx, text, MX + 20, y + 4, { size: 28, bold: true, color });
      }
    } else if (step === 5) {
      const n = lv.interview.neighbor;
      y = this.drawBubble(ctx, y, '🕵️ 你', `我打个电话给隔壁${n.name}，交叉验证一下。`, 0, null, now);
      y += 16;
      y = this.drawPhoneCard(ctx, n, y);
      this.addButton('🔍 进入找茬阶段 →', 'primary', y + 24, () => this.toPhone());
    } else if (step >= 6) {
      this.toPhone();
      return;
    }

    for (const b of this.buttons) gfx.drawButton(ctx, b);
    gfx.drawToast(ctx, this.toast, now);
  },

  addButton(label, theme, y, action, enabled) {
    const b = { x: MX, y, w: CW, h: 90, label, theme, action, enabled: enabled !== false };
    this.buttons.push(b);
    return y + 90;
  },

  /* ---------- 绘制原语 ---------- */
  _typed(text, t0, now) {
    const n = Math.floor((now - t0) / TYPE_MS);
    if (n >= text.length) return text;
    return n <= 0 ? '' : text.slice(0, n);
  },

  // 打字机气泡：高度按完整文本预测量（布局稳定 → 命中同源）
  drawBubble(ctx, top, who, text, typeDelay, chips, now) {
    const pad = 26;
    const wp = CW - 56;
    const lines = gfx.wrapLines(ctx, text, wp, 28);
    const chipH = chips && chips.length ? 40 : 0;
    const h = 30 + pad + chipH + lines.length * 42;
    gfx.fillRound(ctx, MX, top, CW, h, 18, C.bubble);
    gfx.strokeRound(ctx, MX, top, CW, h, 18, C.glassBorder, 1);
    if (who) {
      gfx.drawText(ctx, who, MX + 24, top + 14, { size: 22, bold: true, color: C.gold });
      let cx = MX + 24 + gfx.textWidth(ctx, who, 22, true) + 18;
      for (const ch of (chips || [])) {
        const size = 20;
        const tw = gfx.textWidth(ctx, ch.text, size, ch.gold) + 26;
        if (cx + tw > MX + CW - 20) break;
        gfx.fillRound(ctx, cx, top + 10, tw, 30, 15, ch.gold ? 'rgba(245,197,24,0.14)' : 'rgba(255,255,255,0.06)');
        if (ch.gold) gfx.strokeRound(ctx, cx, top + 10, tw, 30, 15, 'rgba(245,197,24,0.55)', 1);
        gfx.drawText(ctx, ch.text, cx + tw / 2, top + 25, {
          size, bold: !!ch.gold, color: ch.gold ? C.gold : C.muted, align: 'center', baseline: 'middle',
        });
        cx += tw + 10;
      }
    }
    const shown = this._typed(text, this._stepT0 + typeDelay, now);
    gfx.drawWrapped(ctx, shown, MX + 24, top + 44 + chipH, wp, 42, { size: 28 });
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

  drawVideo(ctx, now) {
    const x = MX, y = layout.topInset + 90, w = CW, h = 330;
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
    if (owner) {
      const t = now * 0.001;
      const bx = Math.sin(t * 1.7) * 4 + Math.sin(t * 3.3) * 2;  // 手持抖动
      const by = Math.sin(t * 1.2) * 6 + Math.cos(t * 2.1) * 3;   // 呼吸浮动
      gfx.drawText(ctx, owner.emoji, x + w / 2 + bx, y + h / 2 + by, {
        size: 170, align: 'center', baseline: 'middle',
      });
    }

    // REC 红点闪烁（sin 控制 alpha）
    const blink = 0.45 + 0.45 * Math.sin(now * 0.007);
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.beginPath();
    ctx.arc(x + 34, y + 34, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4d5e';
    ctx.fill();
    ctx.restore();
    gfx.drawText(ctx, 'REC 00:12', x + 52, y + 25, { size: 20, color: '#fff', bold: true });

    // 信号格（右上）
    for (let i = 0; i < 4; i++) {
      const bh = 8 + i * 6;
      const bx2 = x + w - 30 - (3 - i) * 13;
      ctx.fillStyle = i < 3 ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.3)';
      ctx.fillRect(bx2, y + 40 - bh, 8, bh);
    }

    // 店主表情气泡（头像右上角弹出，1.2s 消）
    if (this.face && now - this.face.t0 < 1200) {
      const p = gfx.clamp((now - this.face.t0) / 260, 0, 1);
      const s = gfx.easeOutBack(p);
      ctx.save();
      ctx.translate(x + w / 2 + 100, y + h / 2 - 100);
      ctx.scale(s, s);
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 3;
      ctx.stroke();
      gfx.drawText(ctx, this.face.emoji, 0, 0, { size: 36, align: 'center', baseline: 'middle' });
      ctx.restore();
    }

    // 右下角侦探小窗
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
