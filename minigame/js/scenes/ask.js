/* =====================================================================
 * js/scenes/ask.js — 连麦审问场景（v1.0 直播连麦挑刺版）
 * askStep：0 开场 → 1/2/3 挑刺连麦三问 → 4 老王电话 → 6 已验证
 * ---------------------------------------------------------------------
 * 流程：
 *  step0 开场：视频窗(矢量店主+bokeh+REC) + intro 打字机 + 开始连麦
 *  step1 挑刺：消息流逐条上浮店主的吹牛(vague)，点当前气泡=质疑 →
 *        侦探反问气泡 + 三张数据卡从右侧依次飞入 → 点卡作答（判定
 *        只走 store.answerQuestion）→ 盖章收卷 → 1s 后下一条
 *  step2 电话：老王电话卡(打字机 + reveal 高亮) → 去店里取证
 * 命中顺序：点赞钮 → 数据卡 → 店主气泡 → 按钮；所有 rect 边画边记。
 * ===================================================================== */
const store = require('../core/state.js');
const router = require('../core/router.js');
const gfx = require('../core/gfx.js');
const layout = require('../core/layout.js');
const fx = require('../core/fx.js');
const audio = require('../core/audio.js');
const live = require('../core/live.js');
const character = require('../core/character.js');
const C = gfx.C;

const MX = 35;
const CW = 750 - MX * 2;
const TYPE_MS = 12;          // 打字机速度
const BRAG_FIRST = 550;      // 首条吹牛延迟
const BRAG_GAP = 1400;       // 吹牛节奏
const CARD_STAGGER = 90;     // 数据卡依次飞入间隔
const CARD_FLY = 380;        // 飞卡动画时长
const NEXT_DELAY = 1000;     // 收卷后下一条
const MOOD_MS = 1200;        // 对错表情持续时间
const MAX_MSG = 6;           // 消息流缓存上限
const VISIBLE_MSG = 3;       // 最多留 3 条，旧条压缩淡出

const PRAISE_LINES = ['666666', '主播眼太毒了', '这波打脸舒服了', '教科书式盘问', '水友记大功', '老板哑口无言'];
const TAUNT_LINES = ['翻车了翻车了', '老板松了口气', '这都能答错？', '血压上来了', '水友们急了'];

function circle(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

module.exports = {
  buttons: [],
  bubbleRects: [],   // 可质疑的店主气泡 [{qi, x,y,w,h}]
  cardRects: [],     // 数据卡 [{i, rect, active}]
  msgs: [],          // 直播消息流
  challenge: null,   // {qi, t0, dead[], cls[], resolved, shakeT0}
  feedback: null,
  live: null,
  toast: null,
  pendingQi: 0,
  _audIdx: 0,
  _audCount: 0,
  _mood: 'talk',
  _moodT0: 0,
  _wrongAlt: 0,
  _timers: [],
  _emitTimer: null,
  _now: 0,
  _lastStep: -1,
  _stepT0: 0,
  _lay: null,

  /* ---------- 生命周期 ---------- */
  onEnter() {
    store.markStage('ask');
    this.onExit();
    this.buttons = [];
    this.bubbleRects = [];
    this.cardRects = [];
    this.msgs = [];
    this.challenge = null;
    this.feedback = null;
    this.toast = null;
    this.pendingQi = 0;
    this._audIdx = 0;
    this._audCount = 0;
    this._mood = 'talk';
    this._moodT0 = 0;
    this._wrongAlt = 0;
    this._lastStep = -1;
    this._stepT0 = 0;
    const lv = store.getLevel();
    if (!lv) { router.switchScene('select'); return; }
    fx.setDanmakuPool(lv.interview.danmaku);
    this.live = live.createLive();
  },
  onExit() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
    this._clearEmit();
  },
  update(dt, now) {
    this._now = now;
    if (this.toast && now > this.toast.until) this.toast = null;
    if (this.live) live.updateLive(this.live, dt);
    const step = store.state.askStep;
    if (this._lastStep !== step) this._onStepChange(step, now);
  },

  _onStepChange(step, now) {
    this._lastStep = step;
    this._stepT0 = now;
    this.challenge = null;
    this.feedback = null;
    this._clearEmit();
    if (step === 1) { this.msgs = []; this._audCount = 0; }
    if (step >= 1 && step <= 3) {
      this.pendingQi = step - 1;
      this._emitTimer = setTimeout(() => this._tryEmit(), this.msgs.length ? 400 : BRAG_FIRST);
    } else if (step >= 6) {
      this._goPhoto();
    }
  },

  /* ---------- 消息流调度（单发射计时器，质疑进行中自动让路） ---------- */
  _clearEmit() {
    if (this._emitTimer) { clearTimeout(this._emitTimer); this._emitTimer = null; }
  },
  _tryEmit() {
    this._emitTimer = null;
    const step = store.state.askStep;
    if (step < 1 || step > 3) return;
    if (this.challenge) { this._emitTimer = setTimeout(() => this._tryEmit(), 400); return; }
    this._emitBrag();
    if (this.pendingQi <= 2) this._emitTimer = setTimeout(() => this._tryEmit(), BRAG_GAP);
  },
  _emitBrag() {
    const lv = store.getLevel();
    if (!lv) return;
    const qi = this.pendingQi;
    if (qi === undefined || qi > 2) return;
    if (this.msgs.some(m => m.kind === 'brag' && m.qi === qi)) { this.pendingQi = qi + 1; return; } // 防重
    const q = lv.interview.questions[qi];
    if (!q) return;
    this._pushMsg({ kind: 'brag', qi, who: `${lv.interview.owner.emoji} ${lv.interview.owner.name}`, text: q.vague });
    // 穿插 1-2 条观众弹幕气泡（弱化样式）
    const pool = lv.interview.danmaku;
    if (qi <= 1 && this._audCount < 2 && pool && pool.length) {
      this._pushMsg({ kind: 'aud', text: pool[this._audIdx % pool.length] });
      this._audIdx++;
      this._audCount++;
    }
    this.pendingQi = qi + 1;
  },
  _pushMsg(m) {
    m.t0 = this._now || Date.now();
    m.h = 0; // 首帧渲染时按完整文本预测量（布局稳定）
    this.msgs.push(m);
    if (this.msgs.length > MAX_MSG) this.msgs.shift();
  },

  /* ---------- 交互（命中顺序：点赞 → 数据卡 → 店主气泡 → 按钮） ---------- */
  onTap(x, y) {
    if (this.live && live.tapLike(this.live, x, y)) return;
    const step = store.state.askStep;
    if (step >= 1 && step <= 3) {
      for (const c of this.cardRects) {
        if (c.active && gfx.hit(x, y, c.rect)) { this._onCard(c.i); return; }
      }
      for (const b of this.bubbleRects) {
        if (gfx.hit(x, y, b)) { this._onChallenge(b.qi); return; }
      }
    }
    for (const b of this.buttons) {
      if (b.enabled === false) continue;
      if (gfx.hit(x, y, b)) { b.action(); return; }
    }
  },

  // 点店主气泡 = 质疑它
  _onChallenge(qi) {
    const step = store.state.askStep;
    if (this.challenge || step < 1 || step > 3) return;
    if (qi !== this.pendingQi - 1) return; // 只能质疑当前条
    const msg = this.msgs.find(m => m.kind === 'brag' && m.qi === qi && !m.resolved);
    if (!msg || msg.challenged) return;
    msg.challenged = true;
    const lv = store.getLevel();
    const q = lv.interview.questions[qi];
    this._pushMsg({ kind: 'ask', qi, who: '🕵️ 你', text: q.ask });
    this.challenge = { qi, t0: this._now || Date.now(), dead: [], cls: [], resolved: null, shakeT0: {} };
    audio.play('click');
  },

  // 点数据卡 = 作答（判定只走 store）
  _onCard(i) {
    const ch = this.challenge;
    if (!ch || ch.resolved || ch.dead.indexOf(i) >= 0) return;
    const r = store.answerQuestion(ch.qi, i);

    if (r.correct) {
      ch.cls[i] = 'ok';
      ch.resolved = 'ok';
      this._setMood('happy');
      audio.play('correct');
      const cr = this.cardRects.find(c => c.i === i);
      if (cr) fx.floater(cr.rect.x + cr.rect.w / 2, cr.rect.y + 10, '+1', C.gold);
      fx.say(PRAISE_LINES[Math.floor(Math.random() * PRAISE_LINES.length)]);
      const msg = this.msgs.find(m => m.kind === 'brag' && m.qi === ch.qi);
      if (msg) msg.resolved = 'ok';
      this.feedback = { type: 'ok', text: r.reveal, t0: Date.now() };
      this._timers.push(setTimeout(() => this._advance(), NEXT_DELAY));
      return;
    }

    // 答错
    ch.cls[i] = 'no';
    ch.dead.push(i);
    ch.shakeT0[i] = Date.now();
    this._setMood(this._wrongAlt % 2 === 0 ? 'sweat' : 'angry');
    this._wrongAlt++;
    audio.play('wrong');
    fx.flash();
    fx.shake(4);
    fx.say(TAUNT_LINES[Math.floor(Math.random() * TAUNT_LINES.length)]);
    this.feedback = { type: r.retry ? 'retry' : 'no', text: r.reveal, t0: Date.now() };

    if (r.failed) {
      ch.resolved = 'failed';
      this._timers.push(setTimeout(() => router.switchScene('fail'), 700));
      return;
    }
    if (r.retry) {
      // 追问：该卡标 ✗ 不可再点，气泡保持质疑中，换卡再答
      return;
    }
    ch.resolved = 'no';
    const msg = this.msgs.find(m => m.kind === 'brag' && m.qi === ch.qi);
    if (msg) msg.resolved = 'no';
    this._timers.push(setTimeout(() => this._advance(), NEXT_DELAY));
  },

  _advance() {
    store.advanceAsk(); // 1→2→3→4，render/update 检测步进
  },
  _setMood(m) {
    this._mood = m;
    this._moodT0 = Date.now();
  },
  _goPhoto() {
    store.phoneVerified();
    audio.play('click');
    const cb = () => router.switchScene('photo');
    if (typeof fx.transition === 'function') fx.transition(cb); else cb();
  },

  /* ---------- 布局（每帧计算，含矮屏收缩） ---------- */
  _layout(lv) {
    const H = layout.LOGICAL_H || 1334;
    const top = layout.topInset || 0;
    const bot = layout.bottomInset || 0;
    const vidY = top + 84;
    const likeTop = H - bot - 40 - 104; // 与 live.js 点赞钮几何一致
    const cardH = 112, feedH = 46;
    let cardsY = Math.min(H - bot - cardH - 8, likeTop - 12 - cardH);
    const feedY = cardsY - 8 - feedH;
    const streamBottom = feedY - 12;
    const maxVid = Math.max(240, streamBottom - 200 - vidY);
    const vidH = gfx.clamp(Math.round(H * 0.38), 280, maxVid);
    const chipsY = vidY + vidH + 12;
    return {
      H, vid: { x: MX, y: vidY, w: CW, h: vidH },
      chipsY,
      stream: { x: MX, y: chipsY + 48, w: CW, bottom: streamBottom },
      cards: { y: cardsY, h: cardH, w: (CW - 28) / 3, gap: 14 },
      feed: { y: feedY, h: feedH },
    };
  },

  /* ---------- 渲染 ---------- */
  render(ctx) {
    const now = this._now || Date.now();
    gfx.drawBg(ctx);
    gfx.drawHud(ctx, store.state.score, store.state.patience, store.state.patienceMax);
    const lv = store.getLevel();
    if (!lv) return;
    const step = store.state.askStep;
    if (step >= 6) return; // 已验证，待路由接管

    this._lay = this._layout(lv);

    // 表情时效回落 talk；电话环节店主老实待命
    let mood = this._mood;
    if (mood !== 'talk' && now - this._moodT0 > MOOD_MS) { this._mood = 'talk'; mood = 'talk'; }
    if (step === 4) mood = 'idle';

    this._drawVideo(ctx, lv, now, mood);
    let y = this._drawNameRow(ctx, lv, this._lay.chipsY);

    this.buttons = [];
    this.bubbleRects = [];
    this.cardRects = [];

    if (step === 0) {
      const owner = lv.interview.owner;
      const persona = lv.persona || {};
      const bub = this._drawSpeech(ctx, MX, y + 18, CW, `${owner.emoji} ${owner.name}`, owner.intro, this._stepT0, [
        { text: persona.tag, gold: true },
        { text: `“${persona.catchphrase}”`, gold: true },
      ], now);
      this._addButton('▶ 开始连麦', 'primary', bub.bottom + 26, () => {
        audio.play('click');
        store.advanceAsk();
      });
    } else if (step >= 1 && step <= 3) {
      this._renderStream(ctx, lv, now);
      this._renderFeed(ctx, now);
      this._renderCards(ctx, lv, now);
    } else if (step === 4) {
      const n = lv.interview.neighbor;
      const bub = this._drawSpeech(ctx, MX, y + 18, CW, '🕵️ 你', `我打个电话给隔壁${n.name}，交叉验证一下。`, this._stepT0, null, now);
      const card = this._drawPhoneCard(ctx, n, bub.bottom + 18, now);
      this._addButton('🚶 去店里取证 →', 'primary', card.bottom + 26, () => this._goPhoto());
    }

    for (const b of this.buttons) gfx.drawButton(ctx, b);
    gfx.drawToast(ctx, this.toast, now);
  },

  _addButton(label, theme, y, action) {
    this.buttons.push({ x: MX, y, w: CW, h: 90, label, theme, action, enabled: true });
  },

  /* ---------- 视频窗：深色渐变 + bokeh + 角色 + REC ---------- */
  _drawVideo(ctx, lv, now, mood) {
    const v = this._lay.vid;
    gfx.fillRound(ctx, v.x, v.y, v.w, v.h, 24, '#0f1630');
    gfx.strokeRound(ctx, v.x, v.y, v.w, v.h, 24, C.glassBorder, 2);

    ctx.save();
    gfx.roundRectPath(ctx, v.x + 3, v.y + 3, v.w - 6, v.h - 6, 21);
    ctx.clip();

    const grad = ctx.createLinearGradient(v.x, v.y, v.x, v.y + v.h);
    grad.addColorStop(0, '#232347');
    grad.addColorStop(1, '#101024');
    ctx.fillStyle = grad;
    ctx.fillRect(v.x, v.y, v.w, v.h);

    // 3-4 个缓慢漂移的 bokeh 光斑
    const bok = [
      { bx: 0.18, by: 0.28, r: 64, c: 'rgba(245,197,24,0.10)' },
      { bx: 0.82, by: 0.22, r: 52, c: 'rgba(233,69,96,0.12)' },
      { bx: 0.28, by: 0.78, r: 76, c: 'rgba(22,199,154,0.09)' },
      { bx: 0.68, by: 0.72, r: 46, c: 'rgba(120,140,255,0.11)' },
    ];
    bok.forEach((b, i) => {
      const dx = Math.sin(now * 0.00035 + i * 1.9) * 30;
      const dy2 = Math.cos(now * 0.00028 + i * 2.6) * 22;
      circle(ctx, v.x + b.bx * v.w + dx, v.y + b.by * v.h + dy2, b.r, b.c);
    });

    // 矢量店主（scale≈1.6，矮屏自动收缩；规范高约 362 单位）
    const persona = (lv.persona && lv.persona.type) || 'confused';
    const s = gfx.clamp((v.h - 16) / 362, 0.9, 1.6);
    character.drawShopkeeper(ctx, v.x + v.w / 2, v.y + v.h * 0.56, s, persona, mood, now);
    ctx.restore();

    // REC 红点闪烁（窗内右上）
    const blink = 0.45 + 0.45 * Math.sin(now * 0.007);
    ctx.save();
    ctx.globalAlpha = blink;
    circle(ctx, v.x + v.w - 96, v.y + 34, 7, '#ff4d5e');
    ctx.restore();
    gfx.drawText(ctx, 'REC', v.x + v.w - 82, v.y + 24, { size: 20, color: '#fff', bold: true });

    // 观众数 pill + 点赞钮（覆盖在视频上）
    live.drawLive(ctx, this.live, now);
  },

  // 窗下缘：店主名 + persona 金 chips（tag · “口头禅”）
  _drawNameRow(ctx, lv, y) {
    const owner = lv.interview.owner;
    const persona = lv.persona || {};
    gfx.drawText(ctx, `${owner.emoji} ${owner.name}`, MX, y, { size: 28, bold: true, color: C.text });
    let cx = MX + gfx.textWidth(ctx, `${owner.emoji} ${owner.name}`, 28, true) + 18;
    for (const text of [persona.tag, persona.catchphrase ? `“${persona.catchphrase}”` : null]) {
      if (!text) continue;
      const size = 20;
      const tw = gfx.textWidth(ctx, text, size, true) + 28;
      if (cx + tw > MX + CW) break;
      gfx.fillRound(ctx, cx, y + 2, tw, 30, 15, 'rgba(245,197,24,0.14)');
      gfx.strokeRound(ctx, cx, y + 2, tw, 30, 15, 'rgba(245,197,24,0.6)', 1.5);
      gfx.drawText(ctx, text, cx + tw / 2, y + 17, { size, bold: true, color: C.gold, align: 'center', baseline: 'middle' });
      cx += tw + 10;
    }
    return y + 44;
  },

  /* ---------- 直播消息流 ---------- */
  _measureMsg(ctx, m) {
    if (m.kind === 'aud') {
      m.w = Math.min(CW * 0.72, gfx.textWidth(ctx, '💬 ' + m.text, 22) + 44);
      return 42;
    }
    const lines = gfx.wrapLines(ctx, m.text, CW - 56, 26).length;
    return 20 + 26 + 8 + lines * 36 + 16;
  },
  _typed(text, t0, now) {
    const n = Math.floor((now - t0) / TYPE_MS);
    if (n >= text.length) return text;
    return n <= 0 ? '' : text.slice(0, n);
  },

  _renderStream(ctx, lv, now) {
    const area = this._lay.stream;
    const GAP = 10;
    let cursor = area.bottom;
    for (let k = this.msgs.length - 1; k >= 0; k--) {
      const m = this.msgs[k];
      if (!m.h) m.h = this._measureMsg(ctx, m);
      const top = cursor - m.h;
      if (top < area.y - 30) break; // 上方溢出：旧条不再绘制
      const age = this.msgs.length - 1 - k;
      const entryP = gfx.clamp((now - m.t0) / 280, 0, 1);
      const dy = (1 - gfx.easeOutCubic(entryP)) * 26;
      ctx.save();
      ctx.globalAlpha = (age >= VISIBLE_MSG - 1 ? 0.5 : 1) * (0.2 + 0.8 * entryP);
      this._drawMsg(ctx, m, top + dy, now);
      ctx.restore();
      cursor = top - GAP;
    }
  },

  _drawMsg(ctx, m, top, now) {
    if (m.kind === 'aud') {
      const x = MX + CW - m.w;
      gfx.fillRound(ctx, x, top, m.w, m.h, 18, 'rgba(255,255,255,0.05)');
      ctx.save();
      ctx.setLineDash([6, 6]);
      gfx.strokeRound(ctx, x, top, m.w, m.h, 18, 'rgba(154,160,184,0.4)', 1.5);
      ctx.restore();
      gfx.drawText(ctx, '💬 ' + m.text, x + m.w - 20, top + m.h / 2, {
        size: 22, color: C.muted, align: 'right', baseline: 'middle',
      });
      return;
    }

    const isAsk = m.kind === 'ask';
    const whoColor = isAsk ? C.accent : C.gold;
    const fill = isAsk ? 'rgba(233,69,96,0.13)' : C.bubble;
    gfx.fillRound(ctx, MX, top, CW, m.h, 18, fill);
    gfx.strokeRound(ctx, MX, top, CW, m.h, 18, isAsk ? C.accent : C.glassBorder, isAsk ? 2 : 1);

    // 当前可质疑条：金色描边柔和脉冲
    const challengeable = m.kind === 'brag' && !m.resolved && !m.challenged
      && m.qi === this.pendingQi - 1 && !this.challenge
      && store.state.askStep >= 1 && store.state.askStep <= 3;
    if (challengeable) {
      const pulse = 0.45 + 0.4 * Math.sin(now * 0.006);
      ctx.save();
      ctx.globalAlpha = pulse;
      gfx.strokeRound(ctx, MX, top, CW, m.h, 18, C.gold, 3);
      ctx.restore();
      if (m.qi === 0) {
        const label = '⚡ 点这条质疑';
        const lw = gfx.textWidth(ctx, label, 18, true) + 20;
        gfx.fillRound(ctx, MX + CW - lw - 10, top + 8, lw, 26, 13, 'rgba(245,197,24,0.16)');
        gfx.strokeRound(ctx, MX + CW - lw - 10, top + 8, lw, 26, 13, 'rgba(245,197,24,0.7)', 1.5);
        gfx.drawText(ctx, label, MX + CW - 20, top + 21, { size: 18, bold: true, color: C.gold, align: 'center', baseline: 'middle' });
      }
      this.bubbleRects.push({ x: MX, y: top, w: CW, h: m.h, qi: m.qi });
    }
    if (m.challenged && !m.resolved) {
      gfx.strokeRound(ctx, MX, top, CW, m.h, 18, C.amber, 2);
      gfx.drawText(ctx, '质疑中', MX + CW - 58, top + 21, { size: 18, bold: true, color: C.amber, align: 'center', baseline: 'middle' });
    }

    gfx.drawText(ctx, m.who, MX + 22, top + 12, { size: 22, bold: true, color: whoColor });
    const shown = this._typed(m.text, m.t0, now);
    gfx.drawWrapped(ctx, shown, MX + 22, top + 46, CW - 44, 36, { size: 26 });

    // 收卷盖章 ✓/✗
    if (m.resolved) {
      const ok = m.resolved === 'ok';
      ctx.save();
      ctx.translate(MX + CW - 30, top + m.h - 26);
      ctx.rotate(-0.18);
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fillStyle = ok ? C.green : C.accent;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      gfx.drawText(ctx, ok ? '✓' : '✗', 0, 1, { size: 24, bold: true, color: '#fff', align: 'center', baseline: 'middle' });
      ctx.restore();
    }
  },

  /* ---------- 反馈条（预留固定高度，布局稳定） ---------- */
  _renderFeed(ctx, now) {
    const f = this._lay.feed;
    gfx.fillRound(ctx, MX, f.y, CW, f.h, 14, 'rgba(0,0,0,0.26)');
    const fb = this.feedback;
    if (!fb) return;
    const alpha = gfx.clamp((now - fb.t0) / 200, 0, 1);
    const text = fb.type === 'retry' ? `${fb.text} —— 🤔 再想想！` : fb.text;
    const color = fb.type === 'ok' ? C.green : fb.type === 'retry' ? C.amber : C.lossText;
    let size = 22;
    while (gfx.textWidth(ctx, text, size, true) > CW - 60 && size > 16) size--;
    ctx.save();
    ctx.globalAlpha = alpha;
    gfx.drawText(ctx, text, MX + CW / 2, f.y + f.h / 2, { size, bold: true, color, align: 'center', baseline: 'middle' });
    ctx.restore();
  },

  /* ---------- 数据卡（右侧依次飞入，固定槽位横向排列） ---------- */
  _renderCards(ctx, lv, now) {
    const slot = this._lay.cards;
    const ch = this.challenge;
    // 空槽位示意
    if (!ch) {
      for (let i = 0; i < 3; i++) {
        const x = MX + i * (slot.w + slot.gap);
        ctx.save();
        ctx.setLineDash([8, 8]);
        gfx.strokeRound(ctx, x, slot.y, slot.w, slot.h, 16, 'rgba(154,160,184,0.25)', 1.5);
        ctx.restore();
        gfx.drawText(ctx, '数据卡', x + slot.w / 2, slot.y + slot.h / 2, {
          size: 20, color: 'rgba(154,160,184,0.3)', align: 'center', baseline: 'middle', bold: true,
        });
      }
      return;
    }
    const q = lv.interview.questions[ch.qi];
    for (let i = 0; i < q.options.length; i++) {
      const x0 = MX + i * (slot.w + slot.gap);
      const rect = { x: x0, y: slot.y, w: slot.w, h: slot.h };
      const p = gfx.clamp((now - (ch.t0 + i * CARD_STAGGER)) / CARD_FLY, 0, 1);
      const e = gfx.easeOutBack(p);
      const flyX = 750 + 30 - (750 + 30 - x0) * e;
      const dead = ch.dead.indexOf(i) >= 0;
      const cls = ch.cls[i];

      const active = p >= 1 && !ch.resolved && !dead;
      this.cardRects.push({ i, rect, active });

      const sh = gfx.shakeXY(now, ch.shakeT0[i], 8, 450);
      const faded = (ch.resolved === 'ok' && cls !== 'ok') || (ch.resolved === 'no' && cls !== 'no');
      ctx.save();
      ctx.globalAlpha = (dead ? 0.45 : 1) * (faded ? 0.22 : 1) * Math.min(1, p * 1.4);
      ctx.translate(sh.dx, 0);
      const fill = cls === 'ok' ? '#e9faf2' : cls === 'no' ? '#fdeef0' : '#fbfaf4';
      gfx.fillRoundShadow(ctx, flyX, rect.y, rect.w, rect.h, 16, fill, { blur: 14, dy: 5 });
      gfx.strokeRound(ctx, flyX, rect.y, rect.w, rect.h, 16,
        cls === 'ok' ? C.green : cls === 'no' ? C.accent : 'rgba(0,0,0,0.12)', cls ? 2.5 : 1.5);
      // 数据卡角标
      gfx.fillRound(ctx, flyX + 12, rect.y + 10, 56, 24, 12, 'rgba(0,0,0,0.08)');
      gfx.drawText(ctx, '数据 ' + 'ABC'[i], flyX + 40, rect.y + 22, {
        size: 16, bold: true, color: '#8a90a8', align: 'center', baseline: 'middle',
      });
      gfx.drawText(ctx, q.options[i].label, flyX + rect.w / 2, rect.y + rect.h / 2 + 8, {
        size: 27, bold: true, color: '#2a2a3a', align: 'center', baseline: 'middle',
      });
      if (active) {
        gfx.drawText(ctx, '点击出示', flyX + rect.w / 2, rect.y + rect.h - 18, {
          size: 16, color: '#9aa0b8', align: 'center', baseline: 'middle',
        });
      }
      if (dead) {
        gfx.drawText(ctx, '✗', flyX + rect.w - 22, rect.y + 22, { size: 26, bold: true, color: C.accent, align: 'center', baseline: 'middle' });
      }
      ctx.restore();
    }
  },

  /* ---------- 通用气泡（高度按完整文本预测量） ---------- */
  _drawSpeech(ctx, x, top, w, who, text, t0, chips, now) {
    const lines = gfx.wrapLines(ctx, text, w - 56, 28).length;
    const chipH = chips && chips.length ? 38 : 0;
    const h = 28 + 26 + 8 + chipH + lines * 42 + 18;
    gfx.fillRound(ctx, x, top, w, h, 18, C.bubble);
    gfx.strokeRound(ctx, x, top, w, h, 18, C.glassBorder, 1);
    gfx.drawText(ctx, who, x + 24, top + 14, { size: 22, bold: true, color: C.gold });
    let cx = x + 24 + gfx.textWidth(ctx, who, 22, true) + 16;
    for (const ch of (chips || [])) {
      const size = 20;
      const tw = gfx.textWidth(ctx, ch.text, size, true) + 26;
      if (cx + tw > x + w - 20) break;
      gfx.fillRound(ctx, cx, top + 10, tw, 30, 15, 'rgba(245,197,24,0.14)');
      gfx.strokeRound(ctx, cx, top + 10, tw, 30, 15, 'rgba(245,197,24,0.55)', 1);
      gfx.drawText(ctx, ch.text, cx + tw / 2, top + 25, { size, bold: true, color: C.gold, align: 'center', baseline: 'middle' });
      cx += tw + 10;
    }
    const shown = this._typed(text, t0, now);
    gfx.drawWrapped(ctx, shown, x + 24, top + 48 + chipH, w - 48, 42, { size: 28 });
    return { bottom: top + h };
  },

  /* ---------- 老王电话卡 ---------- */
  _drawPhoneCard(ctx, n, top, now) {
    const x = MX, w = CW;
    const texts = n.texts || [];
    const lineList = texts.map(t => gfx.wrapLines(ctx, t, w - 56, 26).length);
    const h = 66 + lineList.reduce((a, b) => a + b, 0) * 38 + 18 + 46;
    gfx.fillRound(ctx, x, top, w, h, 18, C.bubble);
    gfx.strokeRound(ctx, x, top, w, h, 18, C.glassBorder, 1);
    gfx.drawText(ctx, `📞 ${n.title} · ${n.name}`, x + 24, top + 16, { size: 26, bold: true, color: C.gold });
    let yy = top + 58;
    let start = this._stepT0;
    texts.forEach((t, i) => {
      const shown = this._typed(t, start, now);
      yy = gfx.drawWrapped(ctx, shown, x + 24, yy, w - 48, 38, { size: 26 });
      start += t.length * TYPE_MS + 320;
    });
    gfx.fillRound(ctx, x + 24, top + h - 52, w - 48, 40, 10, 'rgba(22,199,154,0.2)');
    gfx.drawText(ctx, n.reveal, x + w / 2, top + h - 32, { size: 24, bold: true, color: C.green, align: 'center', baseline: 'middle' });
    return { bottom: top + h };
  },
};
