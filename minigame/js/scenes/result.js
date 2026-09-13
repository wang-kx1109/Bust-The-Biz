/* =====================================================================
 * js/scenes/result.js — 结算 / 诊断报告场景
 * 分数滚动计数、成就徽章弹性入场、新成就横幅、亏损卡、
 * 图鉴收录提示、双倍侦探币（激励视频）、分享/重开/下一关。
 * ===================================================================== */
const store = require('../core/state.js');
const router = require('../core/router.js');
const gfx = require('../core/gfx.js');
const layout = require('../core/layout.js');
const audio = require('../core/audio.js');
const fx = require('../core/fx.js');
const ads = require('../core/ads.js');
const achieve = require('../core/achieve.js');
const { track } = require('../core/track.js');
const C = gfx.C;

const SCORE_DUR = 800;     // 分数滚动时长
const BADGE_DELAY = 200;   // 徽章入场错后 ms
const BADGE_DUR = 500;
const BANNER_DUR = 1600;   // 每条成就横幅停留
const BANNER_GAP = 400;    // 横幅间隔

module.exports = {
  report: null,
  stats: [],
  buttons: [],
  newAchievements: [],
  nextId: null,
  levelTitle: '',
  levelIcon: '',
  galleryNew: false,
  galleryNo: 0,
  enterT0: 0,
  doubleUsed: false,
  _doublePending: false,
  _floated: [],
  toast: null,

  onEnter() {
    store.markStage('result');
    const lv = store.getLevel();
    if (!lv) { router.switchScene('select'); return; }
    this.report = store.computeResult();
    // 图鉴卡是否本次新收录（onComplete 会写图鉴，先取旧状态）
    const before = achieve.cards().find(c => c.id === store.state.levelId);
    this.galleryNew = !(before && before.unlocked);
    this.galleryNo = store.LEVELS.findIndex(l => l.id === store.state.levelId) + 1;
    store.completeLevel(); // 写入解锁进度（幂等）
    this.newAchievements = achieve.onComplete(store.state.levelId, this.report, store.state);
    this.enterT0 = Date.now();
    this.doubleUsed = false;
    this._doublePending = false;
    this._floated = [];
    this.toast = null;
    this.nextId = store.nextLevelId();
    this.levelTitle = lv.title;
    this.levelIcon = lv.icon;
    this.stats = [
      { k: '🔍 找到错误', v: `${this.report.foundCount}/${lv.findFaults.faults.length}` },
      { k: '🔗 连线正确', v: `${this.report.linkCount}/${lv.connectPairs.length}` },
      { k: '🚑 急救判断', v: store.state.rescueCorrect ? '✅' : '❌' },
      { k: '🗣 审问答对', v: `${store.state.askCorrect}/${lv.interview.questions.length}` },
      { k: '❤️ 剩余耐心', v: `${store.state.patience}` },
    ];
    this.buttons = [];
    audio.play('fanfare');
    fx.setDanmakuPool(lv.interview.danmaku);
    track('level_complete', { id: store.state.levelId, score: this.report.score, loss: this.report.loss });
  },

  onTap(x, y) {
    for (const b of this.buttons) {
      if (b.enabled === false) continue;
      if (gfx.hit(x, y, b)) { b.action(); return; }
    }
  },

  onShare() {
    track('share_click', { from: 'result' });
    const r = this.report;
    try {
      wx.shareAppMessage({
        title: r.shareText,
        query: 'level=' + (store.state.levelId || ''),
      });
    } catch (e) { /* 兼容 */ }
  },
  onRestart() {
    store.start(store.state.levelId);
    router.switchScene('ask');
  },
  onNext() {
    if (!this.nextId) return;
    store.start(this.nextId);
    router.switchScene('ask');
  },
  onBack() {
    router.switchScene('select');
  },
  onDouble() {
    if (this.doubleUsed || this._doublePending || !this.report) return;
    this._doublePending = true;
    ads.show('double').then((ok) => {
      this._doublePending = false;
      if (ok) {
        this.doubleUsed = true;
        achieve.addCoins(this.report.score);
        this.toast = { text: `🪙 侦探币 +${this.report.score}`, until: Date.now() + 1800 };
        fx.burst(375, layout.LOGICAL_H * 0.55);
      } else {
        this.toast = { text: '看完广告才能领取双倍侦探币哦', until: Date.now() + 1600 };
      }
    });
  },

  /* ---------- 渲染 ---------- */
  render(ctx) {
    gfx.drawBg(ctx);
    if (!this.report) return;
    const now = Date.now();
    const r = this.report;
    const top = layout.topInset;

    // 头部
    gfx.drawText(ctx, `📋 诊断报告 · ${this.levelIcon} ${this.levelTitle}`, 375, top + 16, {
      size: 28, bold: true, align: 'center',
    });

    // 分数滚动计数（0 → score，800ms easeOutCubic）
    const rollT = gfx.clamp((now - this.enterT0) / SCORE_DUR, 0, 1);
    const shown = Math.round(gfx.easeOutCubic(rollT) * r.score);
    gfx.neonText(ctx, `${shown}`, 375, top + 56, {
      size: 96, bold: true, align: 'center', color: C.gold, glow: 18, glowColor: 'rgba(245,197,24,0.8)',
    });
    gfx.drawText(ctx, `诊断得分 / ${r.maxScore}`, 375, top + 168, { size: 22, color: C.muted, align: 'center' });

    // 成就徽章（错后 200ms，easeOutBack 弹性入场）
    const bT = gfx.clamp((now - this.enterT0 - BADGE_DELAY) / BADGE_DUR, 0, 1);
    const bS = gfx.easeOutBack(bT);
    const badgeY = top + 208;
    if (bS > 0.01) {
      const achW = gfx.textWidth(ctx, r.achievement, 26, true) + 64;
      ctx.save();
      ctx.translate(375, badgeY + 24);
      ctx.scale(Math.max(0.01, bS), Math.max(0.01, bS));
      gfx.fillRound(ctx, -achW / 2, -24, achW, 48, 24, C.gold);
      gfx.drawText(ctx, r.achievement, 0, 0, {
        size: 26, bold: true, align: 'center', baseline: 'middle', color: '#3a2a00',
      });
      ctx.restore();
    }

    // 统计 2 列网格（5 项）
    const gy = top + 276;
    const cellW = (702 - 16) / 2, cellH = 96, gap = 16;
    this.stats.forEach((s, i) => {
      const col = i % 2, row = (i / 2) | 0;
      const x = 24 + col * (cellW + gap), y = gy + row * (cellH + gap);
      gfx.fillRoundShadow(ctx, x, y, cellW, cellH, 16, C.glass, { blur: 14, dy: 5 });
      gfx.strokeRound(ctx, x, y, cellW, cellH, 16, C.glassBorder, 1.5);
      gfx.drawText(ctx, s.k, x + cellW / 2, y + 16, { size: 21, color: C.muted, align: 'center' });
      gfx.drawText(ctx, s.v, x + cellW / 2, y + 48, { size: 36, bold: true, align: 'center', color: C.text });
    });

    // 亏损卡
    const rows = Math.ceil(this.stats.length / 2);
    const ly = gy + rows * (cellH + gap) + 4;
    gfx.fillRoundShadow(ctx, 24, ly, 702, 148, 20, 'rgba(233,69,96,0.08)', { blur: 18, dy: 6 });
    gfx.strokeRound(ctx, 24, ly, 702, 148, 20, 'rgba(233,69,96,0.4)', 1.5);
    gfx.drawText(ctx, '若继续硬扛 · 预计亏损', 375, ly + 14, { size: 22, color: C.muted, align: 'center' });
    gfx.drawText(ctx, `${r.loss} 万`, 375, ly + 42, { size: 62, bold: true, align: 'center', color: C.accent });
    gfx.drawText(ctx, r.loss === 0 ? '你帮他完美止损，堪称人间清醒！' : `你帮他挽回了 ${r.recoveredTotal} 万潜在亏损`,
      375, ly + 116, { size: 23, align: 'center', color: '#cfd3e6' });

    // 本关新解锁图鉴卡提示条
    let by = ly + 148 + 14;
    if (this.galleryNew && this.galleryNo > 0) {
      gfx.fillRound(ctx, 24, by, 702, 52, 26, 'rgba(245,197,24,0.12)');
      gfx.strokeRound(ctx, 24, by, 702, 52, 26, 'rgba(245,197,24,0.45)', 1.5);
      gfx.drawText(ctx, `📖 图鉴已收录：第 ${this.galleryNo} 号骗局卡`, 375, by + 26, {
        size: 24, bold: true, align: 'center', baseline: 'middle', color: C.gold,
      });
      by += 52 + 14;
    }

    // 按钮区（render 里边画边记 rect，命中同源）
    this.buttons = [];
    // 双倍侦探币（每局限一次）
    if (!this.doubleUsed) {
      const dBtn = { id: 'double', x: 24, y: by, w: 702, h: 64, enabled: !this._doublePending, action: () => this.onDouble() };
      this.buttons.push(dBtn);
      gfx.gradRound(ctx, dBtn.x, dBtn.y, dBtn.w, dBtn.h, 32, C.amber, '#d9821f', false);
      gfx.drawText(ctx, this._doublePending ? '⏳ 广告播放中…' : '📺 双倍侦探币', 375, dBtn.y + dBtn.h / 2, {
        size: 25, bold: true, align: 'center', baseline: 'middle', color: '#3a2400',
      });
      by += 64 + 14;
    }
    // 分享（主按钮，加大，绿色渐变）
    const shareBtn = { id: 'share', x: 24, y: by, w: 702, h: 88, enabled: true, action: () => this.onShare() };
    this.buttons.push(shareBtn);
    gfx.gradRound(ctx, shareBtn.x, shareBtn.y, shareBtn.w, shareBtn.h, 24, C.green, C.greenDark, true);
    gfx.drawText(ctx, '📤 分享诊断结果', 375, shareBtn.y + shareBtn.h / 2, {
      size: 32, bold: true, align: 'center', baseline: 'middle', color: '#fff',
    });
    by += 88 + 14;

    // 其余按钮 2 列（奇数个时最后一个通栏）
    const acts = [
      { id: 'restart', label: '🔄 再开一局', theme: 'ghost', action: () => this.onRestart() },
    ];
    if (this.nextId) acts.push({ id: 'next', label: '⬇ 下一关已解锁', theme: 'primary', action: () => this.onNext() });
    acts.push({ id: 'back', label: '返回选关', theme: 'ghost', action: () => this.onBack() });
    const bw = (702 - 14) / 2, bh = 78;
    acts.forEach((a, i) => {
      const full = (i === acts.length - 1) && (acts.length % 2 === 1);
      const col = full ? 0 : i % 2;
      const row = (i / 2) | 0;
      const b = {
        id: a.id, x: 24 + col * (bw + 14), y: by + row * (bh + 14),
        w: full ? 702 : bw, h: bh, label: a.label, theme: a.theme, enabled: true, action: a.action,
      };
      this.buttons.push(b);
      gfx.drawButton(ctx, b);
    });

    // 新成就横幅（顶部依次浮出）
    this.renderBanners(ctx, now);

    gfx.drawToast(ctx, this.toast, now);
  },

  renderBanners(ctx, now) {
    if (!this.newAchievements || !this.newAchievements.length) return;
    this.newAchievements.forEach((title, i) => {
      const start = this.enterT0 + 300 + i * BANNER_GAP;
      const p = (now - start) / BANNER_DUR;
      if (p < 0 || p >= 1) return;
      const alpha = p < 0.12 ? p / 0.12 : p > 0.78 ? (1 - p) / 0.22 : 1;
      const slide = gfx.easeOutCubic(Math.min(1, p / 0.12));
      const bw = 560, bh = 60;
      const y = layout.topInset + 66 - (1 - slide) * 30;
      ctx.save();
      ctx.globalAlpha = gfx.clamp(alpha, 0, 1);
      gfx.fillRoundShadow(ctx, (750 - bw) / 2, y, bw, bh, 30, 'rgba(245,197,24,0.95)', { blur: 22, dy: 5 });
      gfx.strokeRound(ctx, (750 - bw) / 2, y, bw, bh, 30, '#fff7d6', 2);
      gfx.drawText(ctx, `🏆 解锁成就：${title}`, 375, y + bh / 2, {
        size: 26, bold: true, align: 'center', baseline: 'middle', color: '#3a2a00',
      });
      ctx.restore();
      if (!this._floated[i] && now >= start) {
        this._floated[i] = true;
        fx.floater(375, y + bh, '🏆', C.gold);
      }
    });
  },
};
