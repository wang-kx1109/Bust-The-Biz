/* =====================================================================
 * js/scenes/collection.js — 成就 + 图鉴场景（v0.3 新增）
 * ---------------------------------------------------------------------
 * 两个 tab：成就（achieve.list）/ 图鉴（achieve.cards）。
 * 纯展示场景；onEnter 读取 achieve；内容超屏时支持 drag 滚动（惯性衰减）。
 * 命中同源：可点项 rect 边画边记；onTap 记按压点，onEnd 区分点按/拖动。
 * ===================================================================== */
const router = require('../core/router.js');
const gfx = require('../core/gfx.js');
const layout = require('../core/layout.js');
const audio = require('../core/audio.js');
const achieve = require('../core/achieve.js');
const LEVELS = require('../data/levels.js');
const C = gfx.C;

const MX = 30;
const CW = 750 - MX * 2;

function safeStats() {
  try {
    const s = achieve.stats() || {};
    return {
      unlocked: s.unlockedCount || 0,
      total: s.achievementTotal || 0,
      saved: s.totalSaved || 0,
      coins: isFinite(s.coins) ? Number(s.coins) : 0, // coins 字段由 achieve 侧补齐，读不到容错
    };
  } catch (e) {
    return { unlocked: 0, total: 0, saved: 0, coins: 0 };
  }
}

module.exports = {
  tab: 'ach',
  backRect: null,
  tabRects: [],
  contentRect: null,
  scrollY: 0,
  maxScroll: 0,
  // 拖动/惯性状态
  _press: null,
  _moved: false,
  _lastY: 0,
  _vel: 0,
  _fling: 0,

  onEnter() {
    this.tab = 'ach';
    this.scrollY = 0;
    this._fling = 0;
    this.rebuild();
  },

  rebuild() {
    const top = layout.topInset;
    this.backRect = { x: MX, y: top + 22, w: 132, h: 56, label: '← 返回', theme: 'ghost', enabled: true };
    const tabY = top + 100;
    this.tabRects = [
      { key: 'ach', x: MX, y: tabY, w: CW / 2 - 8, h: 60, label: '🏅 成就', theme: this.tab === 'ach' ? 'primary' : 'ghost', enabled: true },
      { key: 'gal', x: MX + CW / 2 + 8, y: tabY, w: CW / 2 - 8, h: 60, label: '🖼️ 图鉴', theme: this.tab === 'gal' ? 'primary' : 'ghost', enabled: true },
    ];

    const headH = 100 + 60 + 14;
    const footH = 70;
    this.contentRect = { x: 0, y: top + headH, w: 750, h: layout.LOGICAL_H - layout.bottomInset - footH - top - headH };

    this.achList = achieve.list();
    this.stats = safeStats();
    this.cards = achieve.cards().map(c => {
      const lv = LEVELS.find(l => l.id === c.id) || {};
      return Object.assign({}, c, { desc: lv.subtitle || '' });
    });
    this.galCount = this.cards.filter(c => c.unlocked).length;

    let h = 0;
    if (this.tab === 'ach') {
      h += 92; // 统计条
      h += this.achList.length * 104;
    } else {
      h += 56; // 集齐进度
      const cols = 2;
      const rows = Math.ceil(this.cards.length / cols);
      h += rows * 236 + (rows - 1) * 18;
    }
    this.contentH = h + 20;
    this.maxScroll = Math.max(0, this.contentH - this.contentRect.h);
  },

  /* ---------- 交互（与 select 相同的按压/拖动分流） ---------- */
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
      this._fling = this._vel;
    } else if (this._press) {
      this.handleTap(this._press.x, this._press.y);
    }
    this._press = null;
    this._moved = false;
  },

  handleTap(x, y) {
    if (gfx.hit(x, y, this.backRect)) {
      audio.play('click');
      router.switchScene('select');
      return;
    }
    for (const t of this.tabRects) {
      if (gfx.hit(x, y, t)) {
        if (this.tab !== t.key) {
          this.tab = t.key;
          this.scrollY = 0;
          this._fling = 0;
          audio.play('click');
          this.rebuild();
        }
        return;
      }
    }
  },

  update(dt, now) {
    if (this._fling) {
      const step = this._fling * (dt / 16);
      this.scrollY = gfx.clamp(this.scrollY - step, 0, this.maxScroll);
      this._fling *= Math.pow(0.93, dt / 16);
      if (Math.abs(this._fling) < 0.4) this._fling = 0;
      if (this.scrollY <= 0 || this.scrollY >= this.maxScroll) this._fling = 0;
    }
  },

  /* ---------- 渲染 ---------- */
  render(ctx) {
    gfx.drawBg(ctx);
    const top = layout.topInset;

    gfx.drawText(ctx, '🏆', 375, top + 14, { size: 44, align: 'center', baseline: 'top' });
    gfx.neonText(ctx, '侦探成就室', 375, top + 62, {
      size: 36, bold: true, align: 'center', color: '#fff', glow: 14, glowColor: C.gold,
    });
    gfx.drawButton(ctx, this.backRect);
    for (const t of this.tabRects) gfx.drawButton(ctx, t);

    ctx.save();
    ctx.beginPath();
    ctx.rect(this.contentRect.x, this.contentRect.y, this.contentRect.w, this.contentRect.h);
    ctx.clip();
    const sy = this.scrollY;
    const y0 = this.contentRect.y - sy;
    if (this.tab === 'ach') this.renderAchievements(ctx, y0);
    else this.renderGallery(ctx, y0);
    ctx.restore();
  },

  renderAchievements(ctx, y0) {
    // 统计条：已解锁 / 累计止损 / 侦探币
    gfx.fillRound(ctx, MX, y0, CW, 76, 18, 'rgba(255,255,255,0.05)');
    gfx.strokeRound(ctx, MX, y0, CW, 76, 18, C.glassBorder, 1);
    const cells = [
      `已解锁 ${this.stats.unlocked}/${this.stats.total || this.achList.length}`,
      `累计止损 ${this.stats.saved} 万`,
      `🪙 ${this.stats.coins}`,
    ];
    cells.forEach((t, i) => {
      gfx.drawText(ctx, t, MX + CW / 6 + i * (CW / 3), y0 + 38, {
        size: 24, bold: true, align: 'center', baseline: 'middle',
        color: i === 2 ? C.gold : C.text,
      });
    });

    let y = y0 + 92;
    for (const a of this.achList) {
      const ry = y;
      if (ry + 104 > this.contentRect.y && ry < this.contentRect.y + this.contentRect.h) {
        gfx.card(ctx, MX, ry, CW, 92, 18, a.unlocked
          ? { fill: C.glass, border: C.glassBorder }
          : { fill: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.07)' });
        ctx.save();
        ctx.globalAlpha = a.unlocked ? 1 : 0.45;
        gfx.drawText(ctx, a.icon, MX + 52, ry + 46, { size: 44, align: 'center', baseline: 'middle' });
        gfx.drawText(ctx, a.title, MX + 104, ry + 16, { size: 28, bold: true });
        gfx.drawText(ctx, a.desc, MX + 104, ry + 54, { size: 22, color: C.muted });
        ctx.restore();
        if (a.unlocked) {
          gfx.drawText(ctx, '✓', MX + CW - 34, ry + 46, { size: 30, bold: true, color: C.green, align: 'center', baseline: 'middle' });
        } else {
          gfx.drawText(ctx, '🔒', MX + CW - 40, ry + 46, { size: 26, align: 'center', baseline: 'middle' });
        }
      }
      y += 104;
    }
  },

  renderGallery(ctx, y0) {
    gfx.drawText(ctx, `骗局卡集齐进度 ${this.galCount}/${this.cards.length}`, 375, y0 + 8, {
      size: 26, bold: true, align: 'center',
    });
    let y = y0 + 56;
    const cw = (CW - 18) / 2, chh = 236;
    this.cards.forEach((c, i) => {
      const col = i % 2, row = (i / 2) | 0;
      const x = MX + col * (cw + 18);
      const ry = y + row * (chh + 18);
      if (ry + chh < this.contentRect.y || ry > this.contentRect.y + this.contentRect.h) return;
      if (c.unlocked) {
        gfx.card(ctx, x, ry, cw, chh, 20, { fill: C.glass, border: 'rgba(245,197,24,0.45)' });
        gfx.drawText(ctx, c.icon, x + cw / 2, ry + 56, { size: 62, align: 'center', baseline: 'middle' });
        gfx.drawText(ctx, c.title, x + cw / 2, ry + 116, { size: 26, bold: true, align: 'center' });
        gfx.drawWrapped(ctx, c.desc || '', x + cw / 2, ry + 152, cw - 40, 30, {
          size: 20, color: C.muted, align: 'center',
        });
      } else {
        gfx.card(ctx, x, ry, cw, chh, 20, { fill: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)' });
        gfx.drawText(ctx, '🔒', x + cw / 2, ry + 84, { size: 44, align: 'center', baseline: 'middle' });
        gfx.drawText(ctx, '? ? ?', x + cw / 2, ry + 148, { size: 28, bold: true, align: 'center', color: 'rgba(154,160,184,0.5)' });
        gfx.drawText(ctx, '通关本关解锁', x + cw / 2, ry + 186, { size: 20, align: 'center', color: 'rgba(154,160,184,0.4)' });
      }
    });
  },
};
