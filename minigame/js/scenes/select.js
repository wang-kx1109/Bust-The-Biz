/* =====================================================================
 * js/scenes/select.js — 关卡选择场景（v0.3 门面版）
 * ---------------------------------------------------------------------
 * 章节分组 + 纵向 drag 滚动（惯性衰减）+ 总进度条 + 侦探币 + 图鉴入口。
 * 命中同源：卡片 rect 在 render 时按 (y - scrollY) 边画边记，
 * onTap 只记录按压点，onEnd 时未构成拖动才按最新 rect 命中；
 * 滚动内容区用 save/clip 裁剪，scrollY clamp [0, maxScroll]。
 * ===================================================================== */
const store = require('../core/state.js');
const router = require('../core/router.js');
const gfx = require('../core/gfx.js');
const layout = require('../core/layout.js');
const fx = require('../core/fx.js');
const audio = require('../core/audio.js');
const achieve = require('../core/achieve.js');
const ads = require('../core/ads.js');
const { track } = require('../core/track.js');
const C = gfx.C;

const MX = 30;
const CW = 750 - MX * 2;

const CHAPTERS = [
  { chapter: 1, title: '第一章 · 新手村', color: C.green },
  { chapter: 2, title: '第二章 · 进阶篇', color: C.accent },
];

function readCoins() {
  try {
    const s = achieve.stats();
    return (s && isFinite(s.coins)) ? Number(s.coins) : 0;
  } catch (e) { return 0; }
}

module.exports = {
  cards: [],
  diagCount: 0,
  coins: 0,
  collRect: null,
  devRect: null,
  contentRect: null,
  contentH: 0,
  scrollY: 0,
  maxScroll: 0,
  toast: null,
  // 拖动/惯性状态
  _press: null,
  _moved: false,
  _lastY: 0,
  _vel: 0,
  _fling: 0,

  onEnter() {
    fx.setDanmakuPool([]); // 空数组 → 回退内置通用弹幕池
    store.loadProgress();
    ads.showBanner(); // Banner 广告位占位（无真实单元 ID 时静默跳过）
    this.scrollY = 0;
    this._fling = 0;
    this.rebuild();
  },

  rebuild() {
    const completed = store.progress.completed || [];
    this.diagCount = store.LEVELS.filter(lv => completed.indexOf(lv.id) >= 0).length;
    this.coins = readCoins();

    const top = layout.topInset + 16;
    this.headBottom = top + 148;
    const footTop = layout.LOGICAL_H - layout.bottomInset - 100;
    this.contentRect = { x: 0, y: this.headBottom, w: 750, h: footTop - this.headBottom };

    // 纵向内容：章节头 + 关卡卡
    this.cards = [];
    let y = 6;
    for (const ch of CHAPTERS) {
      const levels = store.LEVELS.filter(lv => lv.chapter === ch.chapter);
      if (!levels.length) continue;
      this.cards.push({ type: 'chapter', chapter: ch, y, h: 76, rect: null });
      y += 76 + 8;
      for (const lv of levels) {
        this.cards.push({
          type: 'level',
          lv,
          y,
          h: 208,
          rect: null,
          locked: !store.isUnlocked(lv.id),
          cleared: completed.indexOf(lv.id) >= 0,
        });
        y += 208 + 18;
      }
      y += 6;
    }
    this.contentH = y;
    this.maxScroll = Math.max(0, this.contentH - this.contentRect.h);

    const fy = layout.LOGICAL_H - layout.bottomInset - 88;
    this.collRect = { x: MX, y: fy, w: 436, h: 76, label: '🏆 成就图鉴', theme: 'green', enabled: true };
    this.devRect = { x: MX + 456, y: fy, w: CW - 456, h: 76, label: '解锁全部', theme: 'ghost', enabled: true };
    this.toast = null;
  },

  /* ---------- 交互（onTap 记按压点，onEnd 区分点按/拖动） ---------- */
  onTap(x, y) {
    this._press = { x, y };
    this._moved = false;
    this._lastY = y;
    this._vel = 0;
    this._fling = 0;
  },

  onMove(x, y) {
    if (!this._press) return;
    if (!this._moved && Math.abs(y - this._press.y) > 10) this._moved = true;
    if (this._moved) {
      const delta = y - this._lastY;
      this._lastY = y;
      this.scrollY = gfx.clamp(this.scrollY - delta, 0, this.maxScroll);
      this._vel = delta;
    }
  },

  onEnd() {
    if (this._moved) {
      this._fling = this._vel; // 简单惯性：末速度衰减
    } else if (this._press) {
      this.handleTap(this._press.x, this._press.y);
    }
    this._press = null;
    this._moved = false;
  },

  handleTap(x, y) {
    if (gfx.hit(x, y, this.collRect)) {
      audio.play('click');
      router.switchScene('collection');
      return;
    }
    if (gfx.hit(x, y, this.devRect)) {
      store.unlockAll();
      this.showToast('已解锁全部关卡');
      this.rebuild();
      return;
    }
    if (y < this.contentRect.y || y > this.contentRect.y + this.contentRect.h) return;
    for (const c of this.cards) {
      if (c.type !== 'level' || !c.rect) continue;
      if (!gfx.hit(x, y, c.rect)) continue;
      if (c.locked) {
        this.showToast('通关上一关解锁');
        fx.shake(2);
        return;
      }
      audio.play('click');
      store.start(c.lv.id);
      track('level_start', { id: c.lv.id });
      router.switchScene('ask');
      return;
    }
  },

  update(dt, now) {
    if (this.toast && now > this.toast.until) this.toast = null;
    if (this._fling) {
      const step = this._fling * (dt / 16);
      this.scrollY = gfx.clamp(this.scrollY - step, 0, this.maxScroll);
      this._fling *= Math.pow(0.93, dt / 16);
      if (Math.abs(this._fling) < 0.4) this._fling = 0;
      if (this.scrollY <= 0 || this.scrollY >= this.maxScroll) this._fling = 0;
    }
  },

  showToast(text) {
    this.toast = { text, until: Date.now() + 1600 };
  },

  /* ---------- 渲染 ---------- */
  render(ctx) {
    const now = Date.now();
    gfx.drawBg(ctx);
    this.drawHeader(ctx);

    ctx.save();
    ctx.beginPath();
    ctx.rect(this.contentRect.x, this.contentRect.y, this.contentRect.w, this.contentRect.h);
    ctx.clip();
    const sy = this.scrollY;
    for (const c of this.cards) {
      c.rect = null;
      const ry = c.y - sy;
      if (ry + c.h < this.contentRect.y || ry > this.contentRect.y + this.contentRect.h) continue;
      if (c.type === 'chapter') this.drawChapterHead(ctx, c, ry);
      else this.drawLevelCard(ctx, c, ry);
    }
    ctx.restore();

    gfx.drawButton(ctx, this.collRect);
    gfx.drawButton(ctx, this.devRect);
    gfx.drawText(ctx, '仅供玩法验证 · 数据与角色均为虚构', 375, layout.LOGICAL_H - layout.bottomInset - 6, {
      size: 18, color: 'rgba(154,160,184,0.55)', align: 'center', baseline: 'bottom',
    });
    gfx.drawToast(ctx, this.toast, now);
  },

  drawHeader(ctx) {
    const top = layout.topInset + 16;
    gfx.drawText(ctx, '🕵️', MX, top - 2, { size: 62, baseline: 'top' });
    gfx.neonText(ctx, '餐饮大侦探', MX + 78, top, { size: 42, bold: true, color: '#fff', glow: 16, glowColor: C.accent });
    gfx.drawText(ctx, '模拟“创业避坑直播间” · 选择你要诊断的店铺', MX + 80, top + 56, {
      size: 22, color: C.muted,
    });
    // 侦探币（字段由 achieve 侧补齐，读不到容错为 0）
    const coinW = 128;
    const cx = 750 - 30 - coinW;
    gfx.fillRound(ctx, cx, top + 4, coinW, 48, 24, 'rgba(245,197,24,0.12)');
    gfx.strokeRound(ctx, cx, top + 4, coinW, 48, 24, 'rgba(245,197,24,0.5)', 2);
    gfx.drawText(ctx, `🪙 ${this.coins}`, cx + coinW / 2, top + 28, {
      size: 26, bold: true, color: C.gold, align: 'center', baseline: 'middle',
    });
    // 总进度
    const py = top + 108;
    gfx.drawText(ctx, `已诊断 ${this.diagCount}/${store.LEVELS.length}`, MX, py + 1, { size: 24, bold: true });
    const bx = MX + 216, bw = 750 - 30 - bx;
    gfx.fillRound(ctx, bx, py, bw, 26, 13, 'rgba(255,255,255,0.08)');
    gfx.strokeRound(ctx, bx, py, bw, 26, 13, C.glassBorder, 1);
    const ratio = this.diagCount / store.LEVELS.length;
    if (ratio > 0) {
      gfx.gradRound(ctx, bx, py, Math.max(26, bw * ratio), 26, 13, C.gold, C.amber);
    }
  },

  drawChapterHead(ctx, c, ry) {
    gfx.neonText(ctx, c.chapter.title, 375, ry + 6, {
      size: 30, bold: true, align: 'center', color: c.chapter.color, glow: 10, glowColor: c.chapter.color,
    });
    gfx.gradRound(ctx, MX, ry + 52, CW, 3, 1.5, 'rgba(255,255,255,0.18)', c.chapter.color);
  },

  drawLevelCard(ctx, c, ry) {
    const lv = c.lv;
    const r = { x: MX, y: ry, w: CW, h: c.h };
    c.rect = r;
    const dim = c.locked ? 0.55 : 1;

    gfx.fillRoundShadow(ctx, r.x, r.y, r.w, r.h, 24, c.locked ? 'rgba(255,255,255,0.04)' : C.glass, { blur: 18, dy: 6 });
    gfx.strokeRound(ctx, r.x, r.y, r.w, r.h, 24,
      c.cleared ? C.green : (c.locked ? 'rgba(255,255,255,0.08)' : C.glassBorder), c.cleared ? 3 : 2);

    // 店铺 icon（圆形底）
    const icx = r.x + 68, icy = r.y + r.h / 2;
    ctx.save();
    ctx.globalAlpha = dim;
    ctx.beginPath();
    ctx.arc(icx, icy, 46, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fill();
    ctx.strokeStyle = (lv.findFaults && lv.findFaults.sceneTheme && lv.findFaults.sceneTheme.accent) || C.accent;
    ctx.lineWidth = 2;
    ctx.globalAlpha = c.locked ? 0.35 : 0.8;
    ctx.stroke();
    ctx.restore();
    gfx.drawText(ctx, lv.icon, icx, icy, { size: 56, align: 'center', baseline: 'middle' });

    const tx = r.x + 134;
    ctx.save();
    ctx.globalAlpha = dim;
    gfx.drawText(ctx, lv.title, tx, r.y + 22, { size: 32, bold: true });
    gfx.drawText(ctx, lv.subtitle, tx, r.y + 64, { size: 22, color: C.muted });
    ctx.restore();

    // persona 标签 chips + 口头禅副行
    let cx = tx;
    if (lv.persona && lv.persona.tag) {
      const tag = lv.persona.tag;
      const tw = gfx.textWidth(ctx, tag, 20, true) + 28;
      gfx.fillRound(ctx, cx, r.y + 100, tw, 32, 16, 'rgba(245,197,24,0.14)');
      gfx.strokeRound(ctx, cx, r.y + 100, tw, 32, 16, 'rgba(245,197,24,0.55)', 1);
      gfx.drawText(ctx, tag, cx + tw / 2, r.y + 116, { size: 20, bold: true, color: C.gold, align: 'center', baseline: 'middle' });
      cx += tw + 12;
    }
    if (lv.persona && lv.persona.catchphrase) {
      gfx.drawText(ctx, `“${lv.persona.catchphrase}”`, cx, r.y + 104, {
        size: 20, color: 'rgba(154,160,184,0.85)',
      });
    }

    // 难度星
    const stars = '★'.repeat(lv.difficulty) + '☆'.repeat(Math.max(0, 3 - lv.difficulty));
    gfx.drawText(ctx, stars, tx, r.y + 146, {
      size: 22, color: c.locked ? 'rgba(245,197,24,0.35)' : C.gold,
    });

    // 右侧状态
    const status = c.cleared ? '✅' : (c.locked ? '🔒' : '▶');
    const sColor = c.cleared ? C.green : (c.locked ? C.muted : C.gold);
    gfx.drawText(ctx, status, r.x + r.w - 48, r.y + r.h / 2 + (c.cleared ? 14 : 0), {
      size: 38, align: 'center', baseline: 'middle', color: sColor,
    });

    // 已通关角标
    if (c.cleared) {
      const bw = 112, bh = 32;
      gfx.fillRound(ctx, r.x + r.w - bw - 14, r.y + 12, bw, bh, 16, 'rgba(22,199,154,0.16)');
      gfx.strokeRound(ctx, r.x + r.w - bw - 14, r.y + 12, bw, bh, 16, 'rgba(22,199,154,0.6)', 1);
      gfx.drawText(ctx, '已诊断', r.x + r.w - 14 - bw / 2, r.y + 12 + bh / 2, {
        size: 20, bold: true, color: C.green, align: 'center', baseline: 'middle',
      });
    }
  },
};
