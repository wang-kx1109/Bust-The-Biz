/* =====================================================================
 * js/core/room.js — 矢量场景建模引擎（v0.4）
 * ---------------------------------------------------------------------
 * 把找茬阶段从"色块分区 + 文字标签 + ❓ 标记"升级为真实店铺内景：
 *  - 房间骨架：后墙双段渐变 + 踢脚线/墙角线 + 透视地砖（9 套 style）
 *  - 家具库：20 种矢量家具（圆角矩形/椭圆/线条/高光 + 投影椭圆）
 *  - 异常目录：39 个错误点 = 场景内可见异常插画（~70px 自包含，多数带动画）
 *  - hitTestRoom：fault(半径40) → inspect(隐藏点 zone) → item(家具) → null
 *
 * 坐标：750x750 场景坐标，调用方（find.js）负责 SX/SY/k 缩放平移后
 * 直接传逻辑坐标进来。只依赖 gfx + state（读 revealedZones），
 * 零外部图片资源（微信主包 4MB 限制）。
 * ===================================================================== */
const gfx = require('./gfx.js');
const store = require('./state.js');
const C = gfx.C;

const TAU = Math.PI * 2;
const W = 750, H = 750, WALL_H = 195;   // 后墙占上 1/4，地板下 3/4

/* ---------- 调色（上深下浅的后墙 + 地板基底） ---------- */
const WALL = {
  tea:      ['#3b2a40', '#4d3850'],
  bake:     ['#463626', '#5c4832'],
  hotpot:   ['#4a1f1f', '#632b26'],
  coffee:   ['#332a20', '#463a2b'],
  fastfood: ['#45262a', '#5c3438'],
  dumpling: ['#3d3527', '#524836'],
  bbq:      ['#33231c', '#463023'],
  sushi:    ['#27303f', '#36435a'],
  viral:    ['#381f4d', '#4d2c68'],
};
const FLOOR_BASE = {
  tea: '#e8dcc8', bake: '#6b4a2f', hotpot: '#7e2626', coffee: '#3d2b1f',
  fastfood: '#e8e0d0', dumpling: '#5f6a6a', bbq: '#2e2e33', sushi: '#e9e2d2', viral: '#43315c',
};

/* ---------- 小工具 ---------- */
function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function groundShadow(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry || Math.max(8, rx * 0.32), 0, 0, TAU);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fill();
}
function shade(hex, amt) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v) => Math.max(0, Math.min(255, v));
  return `rgb(${ch((n >> 16) + amt)},${ch(((n >> 8) & 255) + amt)},${ch((n & 255) + amt)})`;
}
// 纸张：红头 + 横线
function paperSheet(ctx, x, y, w, h, rot, headColor, nLines) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  gfx.fillRound(ctx, -w / 2, -h / 2, w, h, 2, '#f2ead8');
  if (headColor) { ctx.fillStyle = headColor; ctx.fillRect(-w / 2, -h / 2, w, h * 0.26); }
  ctx.strokeStyle = 'rgba(70,60,48,0.5)'; ctx.lineWidth = 1;
  for (let i = 0; i < (nLines || 3); i++) {
    const yy = -h / 2 + h * 0.26 + 6 + i * 7;
    line(ctx, -w / 2 + 4, yy, w / 2 - 4 - (i % 2) * 6, yy);
  }
  ctx.restore();
}
// 小人（圆头 + 围裙），y = 脚
function person(ctx, x, y, s, color, lean) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(lean || 0);
  gfx.fillRound(ctx, -s * 0.32, -s * 0.95, s * 0.64, s * 0.82, s * 0.22, color);
  gfx.fillRound(ctx, -s * 0.2, -s * 0.78, s * 0.4, s * 0.55, 3, 'rgba(255,255,255,0.72)');
  ctx.beginPath(); ctx.arc(0, -s * 1.14, s * 0.27, 0, TAU);
  ctx.fillStyle = '#f2c79a'; ctx.fill();
  ctx.restore();
}
function phoneRect(ctx, x, y, w, h, rot, screen) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
  gfx.fillRound(ctx, -w / 2, -h / 2, w, h, Math.min(5, w * 0.15), '#10121a');
  gfx.fillRound(ctx, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, Math.min(4, w * 0.12), screen || '#bfe3ff');
  ctx.restore();
}
// 纸箱
function carton(ctx, x, y, w, h, label, tape) {
  gfx.fillRound(ctx, x, y, w, h, 2, '#c8a06a');
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  ctx.fillRect(x, y + h * 0.44, w, h * 0.14);
  ctx.strokeStyle = 'rgba(90,60,30,0.55)'; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (tape) {
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x + w / 2 - 3, y, 6, h);
  }
  if (label) {
    gfx.drawText(ctx, label, x + w / 2, y + h * 0.38, {
      size: Math.max(9, Math.min(13, w / Math.max(2, label.length) * 1.5)),
      align: 'center', bold: true, color: '#7a2a1a',
    });
  }
}
// 价签（带挂绳）
function priceTag(ctx, x, y, text, rot, accent) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
  ctx.strokeStyle = 'rgba(60,50,40,0.8)'; ctx.lineWidth = 1.5;
  line(ctx, 0, -18, 0, -8);
  gfx.fillRound(ctx, -26, -8, 52, 26, 5, '#fff3d6');
  ctx.strokeStyle = accent || C.accent; ctx.lineWidth = 2;
  gfx.strokeRound(ctx, -26, -8, 52, 26, 5, accent || C.accent, 2);
  gfx.drawText(ctx, text, 0, 5, { size: 15, bold: true, color: '#b3382e', align: 'center', baseline: 'middle' });
  ctx.restore();
}
// 黑底标注牌（异常插画底部的可读性标签）
function caption(ctx, x, y, text, color) {
  const w = Math.max(64, text.length * 15 + 20);
  gfx.fillRound(ctx, x - w / 2, y - 13, w, 26, 13, 'rgba(12,12,20,0.68)');
  gfx.drawText(ctx, text, x, y, { size: 15, bold: true, color: color || '#ffd9de', align: 'center', baseline: 'middle' });
}
// 放射光芒
function rays(ctx, x, y, n, r0, r1, now, color) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(now * 0.0006);
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  const a = 0.25 + 0.2 * Math.sin(now * 0.004);
  ctx.globalAlpha = Math.max(0.08, a);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU;
    line(ctx, Math.cos(ang) * r0, Math.sin(ang) * r0, Math.cos(ang) * r1, Math.sin(ang) * r1);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
// 烟/雾：上升循环
function smoke(ctx, x, y, now, color, scale) {
  const s = scale || 1;
  for (let i = 0; i < 3; i++) {
    const p = ((now * 0.0004 + i * 0.33) % 1);
    ctx.globalAlpha = (1 - p) * 0.32;
    ctx.beginPath();
    ctx.arc(x + Math.sin(p * 6 + i) * 8 * s, y - p * 66 * s, (7 + p * 13) * s, 0, TAU);
    ctx.fillStyle = color || 'rgba(200,200,205,1)';
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function dice(ctx, x, y, s, rot, pips) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
  gfx.fillRound(ctx, -s / 2, -s / 2, s, s, s * 0.2, '#f6f2ea');
  ctx.fillStyle = '#22242c';
  const o = s * 0.22;
  const spots = {
    1: [[0, 0]], 2: [[-o, -o], [o, o]], 3: [[-o, -o], [0, 0], [o, o]],
    4: [[-o, -o], [o, -o], [-o, o], [o, o]], 5: [[-o, -o], [o, -o], [0, 0], [-o, o], [o, o]],
  }[pips] || [[0, 0]];
  for (const [dx, dy] of spots) { ctx.beginPath(); ctx.arc(dx, dy, s * 0.08, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/* =====================================================================
 * 房间骨架
 * ===================================================================== */
// 透视网格：纵向透视线从墙脚张开 + 横向砖缝线越远越密
function drawFloor(ctx, style, accent, now) {
  const FH = H - WALL_H;
  if (style === 'viral') {
    const g = ctx.createLinearGradient(0, WALL_H, W, H);
    g.addColorStop(0, '#4a2f66'); g.addColorStop(0.55, '#5d3a72'); g.addColorStop(1, '#2f5b7a');
    ctx.fillStyle = g; ctx.fillRect(0, WALL_H, W, FH);
  } else {
    ctx.fillStyle = FLOOR_BASE[style] || '#3a3a55';
    ctx.fillRect(0, WALL_H, W, FH);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, WALL_H, W, 12); // 墙脚阴影

  const rows = { hotpot: 5, fastfood: 6, sushi: 6, tea: 8, dumpling: 8, coffee: 9, bbq: 13, bake: 11, viral: 7 }[style] || 8;
  const xb = style === 'fastfood'
    ? [-260, -130, 0, 130, 260, 390, 520, 650, 780, 910, 1040]
    : [-250, -100, 50, 200, 350, 500, 650, 800, 950, 1100];
  const yAt = (i) => WALL_H + FH * Math.pow(i / rows, 1.55); // 远密近疏
  const xAt = (bx, y) => 375 + (bx - 375) * ((y - WALL_H) / FH);

  const checker = { tea: '#d9c9ae', hotpot: '#93402a', fastfood: '#c23340', dumpling: '#565f61', sushi: '#ded4be' }[style];
  if (checker) {
    for (let r = 0; r < rows; r++) {
      const y0 = yAt(r), y1 = r + 1 === rows ? H : yAt(r + 1);
      const ym = (y0 + y1) / 2;
      for (let c = 0; c < xb.length - 1; c++) {
        if ((r + c) % 2 !== 0) continue;
        ctx.fillStyle = checker;
        ctx.beginPath();
        ctx.moveTo(xAt(xb[c], y0), y0); ctx.lineTo(xAt(xb[c + 1], y0), y0);
        ctx.lineTo(xAt(xb[c + 1], y1), y1); ctx.lineTo(xAt(xb[c], y1), y1);
        ctx.closePath(); ctx.fill();
      }
    }
  }
  if (style === 'viral') {
    // 亮面反射：横向光带 + 招牌倒影
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let i = 0; i < 4; i++) {
      const yy = WALL_H + 40 + i * ((FH - 60) / 3);
      ctx.fillRect(0, yy, W, 5 + i * 2);
    }
    const rg = ctx.createLinearGradient(0, WALL_H, 0, WALL_H + 240);
    rg.addColorStop(0, 'rgba(255,122,210,0.20)'); rg.addColorStop(1, 'rgba(255,122,210,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(300, WALL_H, 260, 240);
  }
  // 砖缝
  const seamColor = {
    tea: 'rgba(140,105,70,0.35)', bake: 'rgba(0,0,0,0.30)', hotpot: 'rgba(245,197,24,0.40)',
    coffee: 'rgba(255,255,255,0.05)', fastfood: 'rgba(150,30,45,0.35)', dumpling: 'rgba(0,0,0,0.30)',
    bbq: 'rgba(255,255,255,0.07)', sushi: 'rgba(180,165,130,0.45)', viral: 'rgba(255,255,255,0.10)',
  }[style] || 'rgba(0,0,0,0.2)';
  const hLines = style !== 'bake';
  ctx.strokeStyle = seamColor;
  ctx.lineWidth = style === 'hotpot' ? 3 : 2;
  if (hLines) {
    for (let i = 1; i < rows; i++) { const yy = yAt(i); line(ctx, 0, yy, W, yy); }
  } else {
    for (let i = 1; i < rows; i++) { const yy = WALL_H + (i / rows) * FH; line(ctx, 0, yy, W, yy); }
  }
  const vLines = style !== 'bake' && style !== 'bbq';
  if (vLines) {
    for (const bx of xb) { line(ctx, 375, WALL_H, bx, H); }
  } else if (style === 'bake' || style === 'bbq') {
    // 近处少量纵缝
    for (let i = 1; i < 6; i++) {
      const xx = (i / 6) * W;
      line(ctx, xx, WALL_H + FH * 0.55, xx + (xx - 375) * 0.1, H);
    }
  }
}

// 后墙：双段渐变 + 踢脚线 + 墙角线 + 黑板菜单 + 霓虹招牌
function drawWall(ctx, style, accent, theme, now) {
  const wc = WALL[style] || WALL.tea;
  const g = ctx.createLinearGradient(0, 0, 0, WALL_H);
  g.addColorStop(0, wc[0]); g.addColorStop(1, wc[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, WALL_H + 2);

  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3;
  line(ctx, 3, 0, 3, WALL_H); line(ctx, W - 3, 0, W - 3, WALL_H); // 墙角线
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(0, WALL_H - 12, W, 12); // 踢脚线
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, WALL_H - 2, W, 2);

  // 黑板菜单（左墙）
  const bx = 30, by = 46, bw = 215, bh = 126;
  gfx.fillRound(ctx, bx - 4, by - 4, bw + 8, bh + 8, 8, '#6b4f36');
  gfx.fillRound(ctx, bx, by, bw, bh, 5, '#20262b');
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
  [[16, 140], [38, 178], [60, 126], [82, 168], [104, 108]].forEach(([dy, len]) => {
    line(ctx, bx + 16, by + dy + 8, bx + 16 + len, by + dy + 8);
  });
  ctx.strokeStyle = 'rgba(233,69,96,0.85)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(bx + 88, by + 92, 54, 13, -0.04, 0, TAU); ctx.stroke();

  // 霓虹招牌（中右，sin 随机闪烁）
  const sign = (theme && theme.sign) || '深夜食堂';
  const size = sign.length > 10 ? 22 : 27;
  const tw = gfx.textWidth(ctx, sign, size, true);
  const sw = Math.min(465, Math.max(230, tw + 76));
  const sx = 266, sy = 42, sh2 = 76;
  gfx.fillRoundShadow(ctx, sx, sy, sw, sh2, 16, 'rgba(0,0,0,0.42)', { blur: 18, dy: 5 });
  gfx.strokeRound(ctx, sx, sy, sw, sh2, 16, accent, 2.5);
  const flick = 0.72 + 0.28 * Math.max(0, Math.sin(now * 0.004) * 0.7 + Math.sin(now * 0.017) * 0.3);
  ctx.globalAlpha = flick;
  gfx.neonText(ctx, sign, sx + sw / 2, sy + sh2 / 2 - size / 2 - 4, {
    size, bold: true, align: 'center', color: '#fff', glow: 20, glowColor: accent,
  });
  ctx.globalAlpha = 1;
}

// 光影：左上对角柔光 + 右下暗角（压在所有陈设之上）
function drawLight(ctx) {
  const g = ctx.createLinearGradient(0, 0, 520, 430);
  g.addColorStop(0, 'rgba(255,246,225,0.10)');
  g.addColorStop(1, 'rgba(255,246,225,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W * 0.74, H * 0.82, 120, W * 0.74, H * 0.82, 620);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.36)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

/* =====================================================================
 * 家具库：f(ctx, item, accent, now)，item = {x, y(基座中心), w, h, variant}
 * 每个家具带投影椭圆，5-10 个图元
 * ===================================================================== */
const FURN = {
  // 吧台 + 高脚凳
  counter(ctx, it, a) {
    const { x, y, w, h } = it;
    groundShadow(ctx, x, y + 8, w * 0.6, 15);
    for (let i = 0; i < 3; i++) {
      const sx = x - w / 2 + w * (0.18 + 0.32 * i);
      ctx.strokeStyle = '#2c2c34'; ctx.lineWidth = 4;
      line(ctx, sx, y + 30, sx, y + 8);
      ctx.beginPath(); ctx.ellipse(sx, y + 4, 15, 7, 0, 0, TAU);
      ctx.fillStyle = shade(a, -30); ctx.fill();
    }
    gfx.gradRound(ctx, x - w / 2, y - h, w, h, 10, '#5a4632', '#3a2c20', true);
    gfx.fillRound(ctx, x - w / 2 + 8, y - h + 16, w - 16, 6, 3, a);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
    for (let i = 1; i < 3; i++) {
      const px = x - w / 2 + (w / 3) * i;
      line(ctx, px, y - h + 30, px, y - 8);
    }
    gfx.gradRound(ctx, x - w / 2 - 7, y - h - 13, w + 14, 22, 8, '#96754f', '#6f5238', false);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(x - w / 2 - 2, y - h - 11, w + 4, 4);
  },
  // 收银台 + 小票
  cashDesk(ctx, it, a) {
    const { x, y, w, h } = it;
    groundShadow(ctx, x, y + 6, w * 0.6, 13);
    gfx.gradRound(ctx, x - w / 2, y - h, w, h, 8, '#5f4a34', '#40301f', true);
    gfx.fillRound(ctx, x - w / 2 + 8, y - h + 12, w - 16, 5, 2, a);
    gfx.gradRound(ctx, x - w / 2 - 5, y - h - 10, w + 10, 18, 7, '#8a6b4a', '#674d33', false);
    // 收银机
    gfx.fillRound(ctx, x - w * 0.18, y - h - 34, w * 0.34, 26, 4, '#2c2f38');
    gfx.fillRound(ctx, x - w * 0.14, y - h - 30, w * 0.18, 10, 2, '#9fe8c0');
    // 小票（卷曲）
    ctx.save();
    ctx.translate(x + w * 0.22, y - h - 12); ctx.rotate(0.5);
    gfx.fillRound(ctx, -7, -4, 14, 22, 2, '#f4f0e4');
    ctx.restore();
  },
  // 圆桌 + 2~4 椅
  tableSet(ctx, it, a) {
    const { x, y, w, h } = it;
    const n = it.variant || 2;
    groundShadow(ctx, x, y + 6, w * 0.62, 14);
    const chairs = n >= 4
      ? [[x - w * 0.58, y - 8], [x + w * 0.58, y - 8], [x - w * 0.3, y + 26], [x + w * 0.3, y + 26]]
      : n === 3
        ? [[x - w * 0.58, y - 8], [x + w * 0.58, y - 8], [x, y + 28]]
        : [[x - w * 0.58, y - 8], [x + w * 0.58, y - 8]];
    for (const [cx, cy] of chairs) {
      gfx.fillRound(ctx, cx - 14, cy - 32, 28, 14, 6, shade(a, -45));
      gfx.fillRound(ctx, cx - 16, cy - 20, 32, 13, 6, shade(a, 5));
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 3;
      line(ctx, cx - 10, cy - 8, cx - 10, cy + 8);
      line(ctx, cx + 10, cy - 8, cx + 10, cy + 8);
    }
    ctx.strokeStyle = '#3a2c20'; ctx.lineWidth = 7;
    line(ctx, x, y - h * 0.42, x, y);
    ctx.beginPath(); ctx.ellipse(x, y - 2, w * 0.2, 7, 0, 0, TAU);
    ctx.fillStyle = '#3a2c20'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y - h * 0.52, w * 0.42, w * 0.17, 0, 0, TAU);
    ctx.fillStyle = '#7a5a3c'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y - h * 0.56, w * 0.32, w * 0.11, 0, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
  },
  // 卡座沙发 + 前桌
  booth(ctx, it, a) {
    const { x, y, w, h } = it;
    groundShadow(ctx, x, y + 6, w * 0.62, 15);
    gfx.gradRound(ctx, x - w / 2, y - h, w, h * 0.62, 14, shade(a, -55), shade(a, -85), true);
    gfx.gradRound(ctx, x - w / 2 + 6, y - h * 0.42, w - 12, h * 0.3, 10, shade(a, -12), shade(a, -38), false);
    ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 2;
    line(ctx, x - w * 0.18, y - h + 10, x - w * 0.18, y - h * 0.46);
    line(ctx, x + w * 0.18, y - h + 10, x + w * 0.18, y - h * 0.46);
    const ty = y - h * 0.16;
    ctx.strokeStyle = '#3a2c20'; ctx.lineWidth = 5;
    line(ctx, x, ty + 4, x, y);
    ctx.beginPath(); ctx.ellipse(x, ty, w * 0.34, w * 0.13, 0, 0, TAU);
    ctx.fillStyle = '#6f5238'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.stroke();
  },
  // 立式冰箱
  fridge(ctx, it, a) {
    const { x, y, w, h } = it;
    groundShadow(ctx, x, y + 5, w * 0.55, 12);
    gfx.gradRound(ctx, x - w / 2, y - h, w, h, 8, '#dfe6ea', '#a9b6bf', true);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
    line(ctx, x - w / 2, y - h * 0.55, x + w / 2, y - h * 0.55);
    gfx.fillRound(ctx, x + w / 2 - 11, y - h * 0.5, 6, h * 0.3, 2, '#7c8890');
    gfx.fillRound(ctx, x - w / 2 + 8, y - h * 0.82, w * 0.3, h * 0.16, 3, a);
  },
  // 卧式冰柜
  freezer(ctx, it, a) {
    const { x, y, w, h } = it;
    groundShadow(ctx, x, y + 5, w * 0.58, 13);
    gfx.gradRound(ctx, x - w / 2, y - h, w, h, 10, '#cfd9de', '#93a4ad', true);
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 2;
    line(ctx, x - w / 2 + 4, y - h * 0.6, x + w / 2 - 4, y - h * 0.6);
    gfx.fillRound(ctx, x - w * 0.2, y - h * 0.62, w * 0.4, 7, 3, '#78858d');
    gfx.fillRound(ctx, x - w / 2 + 10, y - h * 0.4, w * 0.24, h * 0.2, 3, a);
  },
  // 烤炉
  oven(ctx, it, a, now) {
    const { x, y, w, h } = it;
    groundShadow(ctx, x, y + 5, w * 0.58, 13);
    gfx.gradRound(ctx, x - w / 2, y - h, w, h, 8, '#4a4038', '#2f2823', true);
    const glow = 0.5 + 0.3 * Math.sin(now * 0.005);
    gfx.fillRound(ctx, x - w / 2 + 12, y - h * 0.62, w - 24, h * 0.36, 5, '#1c130e');
    gfx.fillRound(ctx, x - w / 2 + 16, y - h * 0.58, w - 32, h * 0.28, 4, `rgba(255,120,40,${(0.35 + glow * 0.3).toFixed(3)})`);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(x - w * 0.2 + i * w * 0.2, y - h * 0.78, 5, 0, TAU);
      ctx.fillStyle = '#c9c2b8'; ctx.fill();
    }
    ctx.strokeStyle = `rgba(255,255,255,${(0.10 + glow * 0.08).toFixed(3)})`; ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const sx = x - w * 0.1 + i * w * 0.24;
      ctx.beginPath();
      ctx.moveTo(sx, y - h - 6);
      ctx.quadraticCurveTo(sx - 8, y - h - 18, sx, y - h - 30);
      ctx.stroke();
    }
  },
  // 蒸笼叠
  steamer(ctx, it, a, now) {
    const { x, y, w, h } = it;
    groundShadow(ctx, x, y + 5, w * 0.55, 12);
    const n = 3;
    for (let i = 0; i < n; i++) {
      const yy = y - i * (h / n);
      gfx.fillRound(ctx, x - w / 2, yy - h / n, w, h / n - 2, 4, i % 2 ? '#b98d55' : '#c8a06a');
      ctx.beginPath(); ctx.ellipse(x, yy - h / n, w / 2, 7, 0, 0, TAU);
      ctx.fillStyle = '#dcc09a'; ctx.fill();
      ctx.strokeStyle = 'rgba(90,60,30,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    }
    smoke(ctx, x, y - h - 4, now, 'rgba(235,235,238,1)', 0.8);
  },
  // 烤架 + 炭火微光
  grill(ctx, it, a, now) {
    const { x, y, w, h } = it;
    groundShadow(ctx, x, y + 6, w * 0.6, 14);
    gfx.gradRound(ctx, x - w / 2, y - h, w, h, 8, '#3c3a3c', '#232224', true);
    // 炭火
    const glow = 0.4 + 0.35 * Math.sin(now * 0.006);
    for (let i = 0; i < 6; i++) {
      const cx = x - w * 0.36 + i * w * 0.145;
      ctx.beginPath(); ctx.arc(cx, y - h * 0.42, 6, 0, TAU);
      ctx.fillStyle = '#3a1512'; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, y - h * 0.42, 3.4, 0, TAU);
      ctx.fillStyle = `rgba(255,110,40,${glow.toFixed(3)})`; ctx.fill();
    }
    // 烤网
    ctx.strokeStyle = '#141416'; ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const yy = y - h * 0.62 + i * h * 0.11;
      line(ctx, x - w / 2 + 8, yy, x + w / 2 - 8, yy);
    }
    // 几串烤肉
    for (let i = 0; i < 3; i++) {
      const sx = x - w * 0.28 + i * w * 0.26;
      ctx.strokeStyle = '#d8cfc0'; ctx.lineWidth = 2.5;
      line(ctx, sx - 16, y - h * 0.68, sx + 16, y - h * 0.68);
      ctx.fillStyle = '#8a4a2f';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.ellipse(sx - 10 + k * 10, y - h * 0.68, 5, 4, 0, 0, TAU); ctx.fill();
      }
    }
    smoke(ctx, x + w * 0.2, y - h, now, 'rgba(210,210,214,1)', 0.9);
  },
  // 板前长台 + 高凳
  sushiBar(ctx, it, a) {
    const { x, y, w, h } = it;
    groundShadow(ctx, x, y + 8, w * 0.55, 14);
    for (let i = 0; i < 4; i++) {
      const sx = x - w * 0.36 + i * w * 0.24;
      ctx.strokeStyle = '#26262c'; ctx.lineWidth = 4;
      line(ctx, sx, y + 26, sx, y + 6);
      ctx.beginPath(); ctx.ellipse(sx, y + 2, 13, 6, 0, 0, TAU);
      ctx.fillStyle = shade(a, -35); ctx.fill();
    }
    gfx.gradRound(ctx, x - w / 2, y - h, w, h, 8, '#6b543c', '#463723', true);
    gfx.gradRound(ctx, x - w / 2 - 5, y - h - 12, w + 10, 22, 7, '#a5825c', '#7d6040', false);
    // 台上餐盘
    for (let i = 0; i < 4; i++) {
      const px = x - w * 0.34 + i * w * 0.22;
      ctx.beginPath(); ctx.ellipse(px, y - h - 14, 12, 5, 0, 0, TAU);
      ctx.fillStyle = i % 2 ? '#e8e4da' : shade(a, 10); ctx.fill();
    }
  },
  // 玻璃展示柜
  displayCase(ctx, it, a) {
    const { x, y, w, h } = it;
    groundShadow(ctx, x, y + 6, w * 0.58, 13);
    gfx.gradRound(ctx, x - w / 2, y - h * 0.42, w, h * 0.42, 6, '#5a4632', '#3c2e20', true);
    const gh = h * 0.58, gy = y - h;
    gfx.fillRound(ctx, x - w / 2 + 4, gy, w - 8, gh, 6, 'rgba(190,225,235,0.22)');
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    gfx.strokeRound(ctx, x - w / 2 + 4, gy, w - 8, gh, 6, 'rgba(255,255,255,0.5)', 2);
    line(ctx, x - w / 2 + 8, gy + gh * 0.55, x + w / 2 - 8, gy + gh * 0.55);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.save();
    ctx.translate(x, gy + gh / 2); ctx.rotate(-0.3);
    ctx.fillRect(-w * 0.32, -6, w * 0.64, 12);
    ctx.restore();
    for (let i = 0; i < 4; i++) {
      const px = x - w * 0.33 + i * w * 0.22;
      ctx.beginPath(); ctx.ellipse(px, gy + gh * 0.72, 11, 6, 0, 0, TAU);
      ctx.fillStyle = '#d9a05f'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(px, gy + gh * 0.26, 10, 5, 0, 0, TAU);
      ctx.fillStyle = '#c98f6b'; ctx.fill();
    }
  },
  // 货架
  shelf(ctx, it, a) {
    const { x, y, w, h } = it;
    groundShadow(ctx, x, y + 5, w * 0.55, 12);
    ctx.strokeStyle = '#4a3a28'; ctx.lineWidth = 6;
    line(ctx, x - w / 2, y - h, x - w / 2, y);
    line(ctx, x + w / 2, y - h, x + w / 2, y);
    for (let i = 0; i < 3; i++) {
      const yy = y - h + (i / 3) * h;
      gfx.fillRound(ctx, x - w / 2 - 3, yy, w + 6, 8, 3, '#6b543c');
      for (let k = 0; k < 3; k++) {
        const px = x - w * 0.3 + k * w * 0.3;
        gfx.fillRound(ctx, px - 9, yy - 16 - (k % 2) * 4, 18, 16 + (k % 2) * 4, 2,
          k % 2 ? shade(a, -10) : '#b9a888');
      }
    }
  },
  // 绿植
  plant(ctx, it, a, now) {
    const { x, y, w, h } = it;
    groundShadow(ctx, x, y + 4, w * 0.5, 11);
    ctx.fillStyle = '#a3542f';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.26, y - h * 0.32); ctx.lineTo(x + w * 0.26, y - h * 0.32);
    ctx.lineTo(x + w * 0.18, y); ctx.lineTo(x - w * 0.18, y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a4527';
    ctx.fillRect(x - w * 0.28, y - h * 0.38, w * 0.56, 8);
    const greens = ['#3f7d44', '#5a9a54', '#2f6b38'];
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI / 2 + (i - 2) * 0.38 + Math.sin(now * 0.0012 + i) * 0.05;
      const len = h * (0.5 + (i % 2) * 0.16);
      ctx.save(); ctx.translate(x, y - h * 0.36); ctx.rotate(ang + Math.PI / 2);
      ctx.beginPath(); ctx.ellipse(0, -len / 2, w * 0.1, len / 2, 0, 0, TAU);
      ctx.fillStyle = greens[i % 3]; ctx.fill();
      ctx.restore();
    }
  },
  // 垃圾桶
  trashBin(ctx, it) {
    const { x, y, w, h } = it;
    groundShadow(ctx, x, y + 4, w * 0.5, 11);
    gfx.gradRound(ctx, x - w * 0.32, y - h, w * 0.64, h, 6, '#6a7a72', '#48564f', true);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
    line(ctx, x - w * 0.12, y - h + 8, x - w * 0.12, y - 6);
    line(ctx, x + w * 0.12, y - h + 8, x + w * 0.12, y - 6);
    ctx.beginPath(); ctx.ellipse(x, y - h, w * 0.34, 8, 0, 0, TAU);
    ctx.fillStyle = '#39443f'; ctx.fill();
    ctx.save();
    ctx.translate(x + w * 0.2, y - h - 2); ctx.rotate(-0.25);
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.3, 7, 0, 0, TAU);
    ctx.fillStyle = '#2f3a35'; ctx.fill();
    ctx.restore();
  },
  // 立式海报架
  poster(ctx, it, a) {
    const { x, y, w, h } = it;
    groundShadow(ctx, x, y + 4, w * 0.5, 10);
    ctx.strokeStyle = '#3c3c44'; ctx.lineWidth = 4;
    line(ctx, x - w * 0.4, y, x - w * 0.18, y - h * 0.72);
    line(ctx, x + w * 0.4, y, x + w * 0.18, y - h * 0.72);
    gfx.fillRound(ctx, x - w / 2, y - h, w, h * 0.78, 5, '#f4f0e6');
    gfx.strokeRound(ctx, x - w / 2, y - h, w, h * 0.78, 5, a, 3);
    gfx.fillRound(ctx, x - w / 2 + 7, y - h + 8, w - 14, h * 0.2, 3, shade(a, -20));
    ctx.strokeStyle = 'rgba(60,60,70,0.5)'; ctx.lineWidth = 2;
    line(ctx, x - w / 2 + 10, y - h * 0.5, x + w / 2 - 10, y - h * 0.5);
    line(ctx, x - w / 2 + 10, y - h * 0.36, x + w / 2 - 22, y - h * 0.36);
  },
  // 手机直播架 + 补光灯
  phoneStand(ctx, it, a, now) {
    const { x, y, w, h } = it;
    groundShadow(ctx, x, y + 4, w * 0.5, 11);
    ctx.strokeStyle = '#2c2c34'; ctx.lineWidth = 4;
    line(ctx, x, y - h * 0.55, x - w * 0.34, y);
    line(ctx, x, y - h * 0.55, x + w * 0.34, y);
    line(ctx, x, y - h * 0.55, x, y);
    line(ctx, x, y - h * 0.55, x, y - h * 0.8);
    const glow = 0.55 + 0.35 * Math.sin(now * 0.006);
    ctx.save();
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 14 * glow;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, y - h * 0.88, w * 0.26, 0, TAU); ctx.stroke();
    ctx.restore();
    phoneRect(ctx, x, y - h * 0.88, w * 0.2, h * 0.24, 0, '#ffd9ef');
  },
  // 挂历（墙挂）
  calendar(ctx, it, a) {
    const { x, y, w, h } = it;
    gfx.fillRound(ctx, x - w / 2, y - h / 2, w, h, 4, '#f2ead8');
    gfx.fillRound(ctx, x - w / 2, y - h / 2, w, h * 0.22, 4, a);
    ctx.strokeStyle = 'rgba(60,50,40,0.6)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.arc(x - w * 0.3 + k * w * 0.2, y - h * 0.1 + i * h * 0.2, 2, 0, TAU);
        ctx.stroke();
      }
    }
    gfx.drawText(ctx, '18', x + w * 0.24, y + h * 0.16, { size: 22, bold: true, color: '#c23', align: 'center' });
  },
  // 装饰灯串（墙挂）
  neonDeco(ctx, it, a, now) {
    const { x, y, w, h } = it;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.quadraticCurveTo(x, y + h * 0.9, x + w / 2, y);
    ctx.stroke();
    const colors = ['#ff6ac1', '#5db9ff', '#f5c518', '#16c79a'];
    for (let i = 0; i < 9; i++) {
      const t = (i + 0.5) / 9;
      const bx = x - w / 2 + t * w;
      const by = y + Math.sin(t * Math.PI) * h * 0.72 + 8;
      const glow = 0.5 + 0.5 * Math.sin(now * 0.004 + i * 1.3);
      ctx.save();
      ctx.shadowColor = colors[i % 4]; ctx.shadowBlur = 10 * glow;
      ctx.beginPath(); ctx.arc(bx, by, 5, 0, TAU);
      ctx.fillStyle = colors[i % 4]; ctx.fill();
      ctx.restore();
    }
  },
  // 隔离栏杆
  queueRail(ctx, it, a) {
    const { x, y, w } = it;
    groundShadow(ctx, x, y + 4, w * 0.55, 10);
    const x1 = x - w / 2, x2 = x + w / 2;
    for (const px of [x1, x2]) {
      ctx.beginPath(); ctx.ellipse(px, y, 16, 6, 0, 0, TAU);
      ctx.fillStyle = '#3a3a42'; ctx.fill();
      gfx.fillRound(ctx, px - 4, y - 52, 8, 52, 3, '#8a8f99');
      ctx.beginPath(); ctx.arc(px, y - 54, 7, 0, TAU);
      ctx.fillStyle = shade(a, -10); ctx.fill();
    }
    ctx.strokeStyle = shade(a, -30); ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x1, y - 44);
    ctx.quadraticCurveTo((x1 + x2) / 2, y - 30, x2, y - 44);
    ctx.stroke();
  },
  // 纸箱堆
  boxes(ctx, it) {
    const { x, y, w, h } = it;
    groundShadow(ctx, x, y + 4, w * 0.55, 12);
    const bw = w * 0.52, bh = h * 0.42;
    carton(ctx, x - bw * 0.55, y - bh, bw, bh, '', true);
    carton(ctx, x + bw * 0.02, y - bh, bw, bh, '', true);
    carton(ctx, x - bw * 0.3, y - bh * 2 - 2, bw, bh, '易碎', true);
    if (w > 80) carton(ctx, x - bw * 0.12, y - bh * 3 - 4, bw * 0.8, bh * 0.8, '', false);
  },
};

/* =====================================================================
 * 布局模板：9 套 style 固定摆位（近处压远处，fault 锚点均已避开家具）
 * ===================================================================== */
const LAYOUTS = {
  tea: [
    { type: 'counter',   x: 88,  y: 350, w: 140, h: 95 },
    { type: 'cashDesk',  x: 450, y: 335, w: 150, h: 80 },
    { type: 'shelf',     x: 655, y: 330, w: 110, h: 120 },
    { type: 'tableSet',  x: 270, y: 555, w: 130, h: 90, variant: 2 },
    { type: 'tableSet',  x: 460, y: 615, w: 120, h: 85, variant: 2 },
    { type: 'queueRail', x: 640, y: 560, w: 110, h: 50 },
    { type: 'plant',     x: 75,  y: 660, w: 70,  h: 70 },
    { type: 'boxes',     x: 700, y: 690, w: 90,  h: 75 },
  ],
  bake: [
    { type: 'displayCase', x: 375, y: 330, w: 300, h: 110 },
    { type: 'oven',        x: 170, y: 500, w: 190, h: 130 },
    { type: 'tableSet',    x: 420, y: 560, w: 120, h: 85, variant: 2 },
    { type: 'shelf',       x: 665, y: 380, w: 100, h: 150 },
    { type: 'boxes',       x: 640, y: 570, w: 100, h: 75 },
    { type: 'trashBin',    x: 90,  y: 640, w: 70,  h: 60 },
    { type: 'cashDesk',    x: 170, y: 665, w: 150, h: 80 },
    { type: 'plant',       x: 712, y: 662, w: 60,  h: 62 },
  ],
  hotpot: [
    { type: 'steamer',   x: 80,  y: 330, w: 90,  h: 90 },
    { type: 'counter',   x: 375, y: 330, w: 320, h: 95 },
    { type: 'freezer',   x: 655, y: 400, w: 130, h: 110 },
    { type: 'booth',     x: 120, y: 470, w: 170, h: 120 },
    { type: 'tableSet',  x: 330, y: 520, w: 140, h: 95, variant: 4 },
    { type: 'tableSet',  x: 610, y: 600, w: 130, h: 90, variant: 4 },
    { type: 'plant',     x: 60,  y: 620, w: 70,  h: 70 },
    { type: 'queueRail', x: 300, y: 655, w: 110, h: 50 },
    { type: 'trashBin',  x: 700, y: 680, w: 70,  h: 60 },
  ],
  coffee: [
    { type: 'counter',     x: 230, y: 340, w: 300, h: 100 },
    { type: 'displayCase', x: 560, y: 330, w: 170, h: 100 },
    { type: 'booth',       x: 130, y: 550, w: 180, h: 120 },
    { type: 'tableSet',    x: 420, y: 570, w: 120, h: 85, variant: 2 },
    { type: 'plant',       x: 650, y: 560, w: 80,  h: 80 },
    { type: 'trashBin',    x: 80,  y: 690, w: 70,  h: 60 },
    { type: 'boxes',       x: 620, y: 680, w: 100, h: 75 },
    { type: 'poster',      x: 330, y: 470, w: 80,  h: 110 },
  ],
  fastfood: [
    { type: 'cashDesk', x: 150, y: 340, w: 150, h: 85 },
    { type: 'counter',  x: 420, y: 330, w: 340, h: 95 },
    { type: 'fridge',   x: 660, y: 420, w: 120, h: 140 },
    { type: 'tableSet', x: 560, y: 570, w: 130, h: 85, variant: 2 },
    { type: 'tableSet', x: 180, y: 580, w: 130, h: 85, variant: 2 },
    { type: 'queueRail',x: 375, y: 470, w: 110, h: 50 },
    { type: 'trashBin', x: 70,  y: 700, w: 70,  h: 60 },
    { type: 'boxes',    x: 640, y: 690, w: 100, h: 75 },
  ],
  dumpling: [
    { type: 'steamer',  x: 180, y: 330, w: 130, h: 100 },
    { type: 'counter',  x: 470, y: 350, w: 300, h: 95 },
    { type: 'freezer',  x: 650, y: 350, w: 120, h: 120 },
    { type: 'tableSet', x: 390, y: 500, w: 160, h: 100, variant: 4 },
    { type: 'tableSet', x: 600, y: 520, w: 130, h: 90, variant: 3 },
    { type: 'cashDesk', x: 560, y: 620, w: 160, h: 85 },
    { type: 'shelf',    x: 90,  y: 560, w: 110, h: 150 },
    { type: 'boxes',    x: 300, y: 650, w: 110, h: 75 },
    { type: 'plant',    x: 700, y: 640, w: 70,  h: 70 },
    { type: 'calendar', x: 95,  y: 118, w: 80,  h: 96, wall: true },
  ],
  bbq: [
    { type: 'fridge',   x: 90,  y: 350, w: 120, h: 130 },
    { type: 'grill',    x: 400, y: 350, w: 300, h: 110 },
    { type: 'tableSet', x: 170, y: 480, w: 140, h: 95, variant: 4 },
    { type: 'tableSet', x: 600, y: 545, w: 130, h: 90, variant: 4 },
    { type: 'boxes',    x: 660, y: 430, w: 100, h: 75 },
    { type: 'cashDesk', x: 140, y: 570, w: 150, h: 80 },
    { type: 'plant',    x: 60,  y: 660, w: 70,  h: 70 },
    { type: 'trashBin', x: 250, y: 660, w: 70,  h: 60 },
  ],
  sushi: [
    { type: 'sushiBar', x: 375, y: 345, w: 540, h: 100 },
    { type: 'tableSet', x: 200, y: 500, w: 130, h: 85, variant: 2 },
    { type: 'tableSet', x: 480, y: 560, w: 130, h: 85, variant: 2 },
    { type: 'shelf',    x: 640, y: 470, w: 110, h: 150 },
    { type: 'plant',    x: 60,  y: 620, w: 70,  h: 70 },
    { type: 'boxes',    x: 180, y: 680, w: 100, h: 75 },
    { type: 'trashBin', x: 330, y: 690, w: 70,  h: 60 },
  ],
  viral: [
    { type: 'phoneStand', x: 300, y: 350, w: 100, h: 120 },
    { type: 'counter',    x: 560, y: 340, w: 280, h: 95 },
    { type: 'tableSet',   x: 180, y: 540, w: 140, h: 90, variant: 2 },
    { type: 'tableSet',   x: 620, y: 550, w: 120, h: 85, variant: 2 },
    { type: 'queueRail',  x: 400, y: 470, w: 110, h: 50 },
    { type: 'plant',      x: 70,  y: 650, w: 70,  h: 70 },
    { type: 'trashBin',   x: 200, y: 680, w: 70,  h: 60 },
    { type: 'boxes',      x: 660, y: 660, w: 100, h: 75 },
    { type: 'neonDeco',   x: 430, y: 88,  w: 420, h: 60, wall: true },
  ],
};

/* =====================================================================
 * 异常可视化目录：39 个错误点 = 场景内可见异常（key = fault.id）
 * 每个 ~70px 自包含插画，画在 fault (x,y) 锚点，多数带 sin 动画
 * ===================================================================== */
const ANOM = {
  /* 1. 租金过高：墙上贴满催租单 */
  rent(ctx, x, y, now) {
    [[-48, -20, -0.1], [0, 16, 0.06], [44, -14, 0.12], [-4, 44, -0.05]].forEach(([dx, dy, rot], i) => {
      paperSheet(ctx, x + dx, y + dy, 36, 46, rot + Math.sin(now * 0.002 + i * 1.7) * 0.05, '#d33', 3);
    });
    caption(ctx, x, y + 72, '催租单贴满了', '#ffb3b3');
  },
  /* 2. 食材成本率超标：原料杯堆成山 + 价签摇摆 */
  food(ctx, x, y, now, a) {
    groundShadow(ctx, x, y + 8, 80, 16);
    const cup = (cx, cy, c) => {
      gfx.fillRound(ctx, cx - 14, cy - 26, 28, 30, 4, c);
      ctx.beginPath(); ctx.ellipse(cx, cy - 26, 14, 5, 0, 0, TAU);
      ctx.fillStyle = shade(c, 30); ctx.fill();
    };
    cup(x - 34, y + 4, '#e8c87a'); cup(x, y + 4, '#d98f6a'); cup(x + 34, y + 4, '#e8c87a');
    cup(x - 17, y - 26, '#c9d67a'); cup(x + 17, y - 26, '#d98f6a');
    cup(x, y - 52, '#e8c87a');
    priceTag(ctx, x + 52, y - 30, '¥18', Math.sin(now * 0.003) * 0.28, a);
    caption(ctx, x, y + 34, '原料堆成山', '#ffd9b3');
  },
  /* 3. 人工冗余：员工扎堆看手机 */
  labor(ctx, x, y, now) {
    groundShadow(ctx, x, y + 8, 66, 15);
    person(ctx, x - 46, y + 4, 40, '#5b7fb3', 0.12);
    person(ctx, x + 44, y + 6, 40, '#5b7fb3', -0.12);
    person(ctx, x - 6, y + 26, 40, '#5b7fb3', 0);
    person(ctx, x + 8, y - 26, 40, '#5b7fb3', 0);
    const glow = 0.45 + 0.4 * Math.sin(now * 0.006);
    phoneRect(ctx, x, y, 26, 40, 0.2, `rgba(160,215,255,${glow.toFixed(3)})`);
    caption(ctx, x, y + 56, '4个人围着1部手机', '#cfe3ff');
  },
  /* 4. 选址负一层：B1 指示牌 + 楼梯阴影 + 蜘蛛网 */
  location(ctx, x, y, now) {
    gfx.fillRound(ctx, x - 66, y - 48, 66, 34, 6, '#2b3a55');
    gfx.strokeRound(ctx, x - 66, y - 48, 66, 34, 6, '#7fa0d0', 2);
    gfx.drawText(ctx, 'B1 →', x - 33, y - 39, { size: 20, bold: true, color: '#cfe0ff', align: 'center' });
    // 向下楼梯阴影
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = `rgba(8,10,18,${(0.55 - i * 0.12).toFixed(3)})`;
      ctx.fillRect(x - 58 + i * 7, y - 8 + i * 12, 86 - i * 14, 10);
    }
    // 墙角蜘蛛网
    ctx.strokeStyle = 'rgba(230,235,245,0.5)'; ctx.lineWidth = 1.5;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath(); ctx.arc(x + 66, y - 46, i * 12, Math.PI * 0.5, Math.PI); ctx.stroke();
    }
    line(ctx, x + 66, y - 46, x + 30, y - 46);
    line(ctx, x + 66, y - 46, x + 66, y - 10);
    line(ctx, x + 66, y - 46, x + 42, y - 22);
    caption(ctx, x, y + 64, '负一层，鬼都不来', '#cfe0ff');
  },
  /* 5. 客单价过低：全场1折寒酸海报 */
  pricing(ctx, x, y, now, a) {
    groundShadow(ctx, x, y + 6, 56, 12);
    ctx.save();
    ctx.translate(x, y - 46); ctx.rotate(-0.06);
    gfx.fillRound(ctx, -46, -56, 92, 112, 5, '#f4ead2');
    gfx.strokeRound(ctx, -46, -56, 92, 112, 5, shade(a, -30), 3);
    gfx.drawText(ctx, '全场', 0, -44, { size: 22, bold: true, color: '#8a4a2f', align: 'center' });
    gfx.drawText(ctx, '1折', 0, -14, { size: 40, bold: true, color: '#d33', align: 'center' });
    ctx.strokeStyle = 'rgba(60,60,70,0.5)'; ctx.lineWidth = 2;
    line(ctx, -30, 26, 30, 26); line(ctx, -22, 38, 22, 38);
    // 胶带翘起
    const peel = Math.sin(now * 0.003) * 0.2;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.save(); ctx.translate(-46, -56); ctx.rotate(-0.4 - peel); ctx.fillRect(-4, -6, 26, 12); ctx.restore();
    ctx.save(); ctx.translate(46, -56); ctx.rotate(0.4 + peel); ctx.fillRect(-22, -6, 26, 12); ctx.restore();
    ctx.restore();
    caption(ctx, x, y + 36, '全场1折硬亏', '#ffd9b3');
  },
  /* 6. 面积冗余：积灰区域 + 虚线警戒带 */
  area(ctx, x, y, now) {
    const drift = 0.24 + 0.08 * Math.sin(now * 0.0016);
    ctx.beginPath(); ctx.ellipse(x, y, 96, 42, 0, 0, TAU);
    ctx.fillStyle = `rgba(130,150,175,${drift.toFixed(3)})`; ctx.fill();
    ctx.strokeStyle = 'rgba(160,175,195,0.5)'; ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.ellipse(x, y, 96, 42, 0, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    // 警戒带
    ctx.save();
    ctx.translate(x, y); ctx.rotate(-0.16);
    ctx.strokeStyle = '#e8c33a'; ctx.lineWidth = 9;
    ctx.setLineDash([16, 12]);
    line(ctx, -104, 0, 104, 0);
    ctx.strokeStyle = 'rgba(40,40,40,0.7)'; ctx.lineWidth = 9;
    ctx.setLineDash([8, 20]);
    ctx.lineDashOffset = 12;
    line(ctx, -104, 0, 104, 0);
    ctx.restore();
    ctx.setLineDash([]);
    caption(ctx, x, y + 62, '一半面积在积灰', '#dbe6f5');
  },
  /* 7. 报废率过高（hidden）：垃圾桶里堆满面包 */
  loss(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 52, 12);
    gfx.gradRound(ctx, x - 28, y - 46, 56, 50, 6, '#6a7a72', '#48564f', true);
    ctx.beginPath(); ctx.ellipse(x, y - 46, 30, 9, 0, 0, TAU);
    ctx.fillStyle = '#39443f'; ctx.fill();
    const breads = [[-16, -56, -0.3], [4, -60, 0.2], [18, -52, 0.5], [-4, -48, -0.1]];
    for (const [dx, dy, r] of breads) {
      ctx.save(); ctx.translate(x + dx, y + dy); ctx.rotate(r);
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, TAU);
      ctx.fillStyle = '#d9a05f'; ctx.fill();
      ctx.strokeStyle = 'rgba(120,70,30,0.6)'; ctx.lineWidth = 1;
      line(ctx, -6, -2, 6, -2); line(ctx, -4, 2, 4, 2);
      ctx.restore();
    }
    ctx.save(); ctx.translate(x - 40, y + 2); ctx.rotate(0.4);
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 7, 0, 0, TAU); ctx.fillStyle = '#c98f4f'; ctx.fill();
    ctx.restore();
    caption(ctx, x, y + 34, '每天扔一大半', '#ffe6c2');
  },
  /* 8. 食材成本失控：血红标签 + 堆高食材箱 */
  supply(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 70, 14);
    gfx.gradRound(ctx, x - 58, y - 62, 96, 66, 8, '#cfd9de', '#93a4ad', true);
    const pulse = 0.75 + 0.25 * Math.sin(now * 0.005);
    ctx.save();
    ctx.globalAlpha = pulse;
    gfx.fillRound(ctx, x - 46, y - 44, 72, 26, 4, '#c01818');
    gfx.drawText(ctx, '成本 52%', x - 10, y - 38, { size: 17, bold: true, color: '#fff', align: 'center' });
    ctx.restore();
    carton(ctx, x + 44, y - 34, 40, 32, '冻品', true);
    carton(ctx, x + 52, y - 62, 36, 28, '', true);
    carton(ctx, x + 40, y - 86, 34, 24, '', false);
    caption(ctx, x, y + 30, '成本率 52%', '#ffb3b3');
  },
  /* 9. 强制进货陷阱：成堆"总部专供"纸箱 */
  forced(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 74, 15);
    carton(ctx, x - 62, y - 32, 48, 32, '总部专供', true);
    carton(ctx, x - 12, y - 32, 48, 32, '总部专供', true);
    carton(ctx, x + 38, y - 32, 48, 32, '总部专供', true);
    carton(ctx, x - 38, y - 62, 48, 30, '强制采购', true);
    carton(ctx, x + 12, y - 62, 48, 30, '总部专供', true);
    carton(ctx, x - 12, y - 90, 48, 28, '', true);
    ctx.strokeStyle = '#c01818'; ctx.lineWidth = 3;
    line(ctx, x - 66, y - 12, x + 88, y - 52);
    caption(ctx, x, y + 28, '不进就罚款', '#ffb3b3');
  },
  /* 10. 员工流失严重：皱巴巴招聘启事 + 空衣架 */
  team(ctx, x, y, now, a) {
    groundShadow(ctx, x, y + 6, 62, 13);
    const sway = Math.sin(now * 0.0022) * 0.03;
    ctx.save();
    ctx.translate(x - 24, y - 58); ctx.rotate(0.07 + sway);
    gfx.fillRound(ctx, -38, -48, 76, 96, 3, '#efe6cc');
    gfx.fillRound(ctx, -38, -48, 76, 24, 3, shade(a, -30));
    gfx.drawText(ctx, '急招厨师', 0, -44, { size: 17, bold: true, color: '#fff', align: 'center' });
    gfx.drawText(ctx, '月薪面议', 0, -16, { size: 16, bold: true, color: '#8a4a2f', align: 'center' });
    ctx.strokeStyle = 'rgba(120,100,70,0.55)'; ctx.lineWidth = 1.5;
    line(ctx, -26, 4, 26, 4); line(ctx, -26, 16, 18, 16); line(ctx, -26, 28, 24, 28);
    ctx.restore();
    // 空衣架
    ctx.strokeStyle = '#9aa0aa'; ctx.lineWidth = 3;
    line(ctx, x + 42, y, x + 42, y - 84);
    line(ctx, x + 26, y, x + 58, y);
    for (let i = 0; i < 3; i++) {
      const hx = x + 30 + i * 12;
      ctx.beginPath(); ctx.arc(hx, y - 84, 6, Math.PI, 0); ctx.stroke();
    }
    caption(ctx, x, y + 30, '人都走光了', '#ffd9b3');
  },
  /* 11. 盲目坚持（hidden）：日历红叉连到 6 个月后 */
  denial(ctx, x, y, now) {
    ctx.save();
    ctx.translate(x - 8, y - 52); ctx.rotate(-0.03);
    gfx.fillRound(ctx, -52, -46, 104, 92, 5, '#f2ead8');
    gfx.fillRound(ctx, -52, -46, 104, 22, 5, '#c33');
    gfx.drawText(ctx, '12月', 0, -42, { size: 16, bold: true, color: '#fff', align: 'center' });
    ctx.strokeStyle = 'rgba(60,50,40,0.6)'; ctx.lineWidth = 2;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        const cx = -40 + c * 20, cy = -12 + r * 20;
        ctx.strokeRect(cx - 7, cy - 7, 14, 14);
        if ((r * 5 + c) % 2 === 0 || r === 2) {
          ctx.strokeStyle = '#d33'; ctx.lineWidth = 2.5;
          line(ctx, cx - 6, cy - 6, cx + 6, cy + 6);
          line(ctx, cx + 6, cy - 6, cx - 6, cy + 6);
          ctx.strokeStyle = 'rgba(60,50,40,0.6)'; ctx.lineWidth = 2;
        }
      }
    }
    // 红叉溢出到表格外（6 个月后）
    for (let i = 0; i < 3; i++) {
      const cx = 62 + i * 20, cy = 24 + i * 4;
      ctx.strokeStyle = '#d33'; ctx.lineWidth = 2.5;
      line(ctx, cx - 6, cy - 6, cx + 6, cy + 6);
      line(ctx, cx + 6, cy - 6, cx - 6, cy + 6);
    }
    ctx.restore();
    gfx.fillRound(ctx, x + 34, y - 6, 62, 26, 3, '#ffe98a');
    gfx.drawText(ctx, '再坚持一下', x + 65, y + 7, { size: 13, bold: true, color: '#8a6a1a', align: 'center', baseline: 'middle' });
    caption(ctx, x, y + 40, '连亏6个月还在撑', '#ffb3b3');
  },
  /* 12. 过度装修：水晶吊灯 + 金边柱 vs 空卡座 */
  decor(ctx, x, y, now) {
    // 金边装饰柱
    gfx.gradRound(ctx, x + 52, y - 40, 18, 96, 4, '#e8c96a', '#a8862f', true);
    gfx.fillRound(ctx, x + 48, y - 48, 26, 10, 3, '#f2dd8a');
    gfx.fillRound(ctx, x + 48, y + 52, 26, 10, 3, '#f2dd8a');
    // 吊灯
    ctx.strokeStyle = 'rgba(230,230,240,0.8)'; ctx.lineWidth = 2;
    line(ctx, x - 10, y - 96, x - 10, y - 46);
    const facet = (cx, cy, r, col) => {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = col; ctx.fillRect(-r / 1.6, -r / 1.6, r * 1.25, r * 1.25);
      ctx.restore();
    };
    for (let i = 0; i < 5; i++) facet(x - 10 + Math.cos(i / 5 * TAU) * 20, y - 44 + Math.sin(i / 5 * TAU) * 8, 10, i % 2 ? 'rgba(200,225,255,0.9)' : 'rgba(255,240,200,0.9)');
    for (let i = 0; i < 7; i++) facet(x - 10 + Math.cos(i / 7 * TAU) * 30, y - 26 + Math.sin(i / 7 * TAU) * 10, 8, i % 2 ? 'rgba(255,240,200,0.85)' : 'rgba(200,225,255,0.85)');
    const glint = 0.4 + 0.6 * Math.abs(Math.sin(now * 0.005));
    ctx.strokeStyle = `rgba(255,255,255,${glint.toFixed(3)})`; ctx.lineWidth = 2;
    line(ctx, x - 22, y - 58, x + 2, y - 58); line(ctx, x - 10, y - 66, x - 10, y - 50);
    // 空卡座（虚线轮廓）
    ctx.strokeStyle = 'rgba(200,205,220,0.5)'; ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    gfx.strokeRound(ctx, x - 96, y - 6, 72, 44, 8, 'rgba(200,205,220,0.5)', 2);
    ctx.setLineDash([]);
    caption(ctx, x, y + 76, '装修80万没人坐', '#ffe9ad');
  },
  /* 13. 定价过高：金光刺眼价目 */
  price(ctx, x, y, now) {
    gfx.fillRoundShadow(ctx, x - 62, y - 56, 124, 96, 8, '#171208', { blur: 14, dy: 4 });
    gfx.strokeRound(ctx, x - 62, y - 56, 124, 96, 8, '#e8c33a', 3);
    const shine = 0.5 + 0.3 * Math.sin(now * 0.004);
    ctx.save();
    ctx.shadowColor = '#f5c518'; ctx.shadowBlur = 12 * shine;
    gfx.drawText(ctx, '手冲 ¥88', x, y - 40, { size: 20, bold: true, color: '#f5c518', align: 'center' });
    gfx.drawText(ctx, '特调 ¥128', x, y - 10, { size: 22, bold: true, color: '#f5c518', align: 'center' });
    ctx.restore();
    gfx.fillRound(ctx, x + 18, y + 14, 66, 22, 3, '#f4ead2');
    gfx.drawText(ctx, '本店高端', x + 51, y + 25, { size: 13, bold: true, color: '#8a6a1a', align: 'center', baseline: 'middle' });
    caption(ctx, x, y + 66, '隔壁均价25', '#ffe9ad');
  },
  /* 14. 本末倒置：直播架占C位 + 吧台积灰 */
  focus(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 62, 13);
    // 积灰吧台角
    const dust = 0.3 + 0.1 * Math.sin(now * 0.0016);
    ctx.beginPath(); ctx.ellipse(x - 40, y + 10, 42, 16, 0, 0, TAU);
    ctx.fillStyle = `rgba(150,155,165,${dust.toFixed(3)})`; ctx.fill();
    gfx.fillRound(ctx, x - 58, y - 2, 26, 14, 5, '#9aa0aa'); // 抹布
    // 直播架 + 补光环
    ctx.strokeStyle = '#2c2c34'; ctx.lineWidth = 4;
    line(ctx, x + 18, y + 4, x + 2, y - 44);
    line(ctx, x + 18, y + 4, x + 34, y - 44);
    line(ctx, x + 18, y - 20, x + 18, y - 52);
    const glow = 0.6 + 0.35 * Math.sin(now * 0.006);
    ctx.save();
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 16 * glow;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x + 18, y - 62, 24, 0, TAU); ctx.stroke();
    ctx.restore();
    phoneRect(ctx, x + 18, y - 62, 16, 26, 0, '#ffd9ef');
    caption(ctx, x, y + 44, '拍视频4h 管店2h', '#ffd9ef');
  },
  /* 15. 流量幻觉（hidden）：500w 播放光芒四射，店空空 */
  vanity(ctx, x, y, now) {
    rays(ctx, x, y - 10, 12, 52, 96, now, '#e7c9ff');
    groundShadow(ctx, x, y + 8, 56, 13);
    phoneRect(ctx, x, y - 10, 52, 86, -0.08, '#3a1d5c');
    gfx.drawText(ctx, '播放量', x, y - 38, { size: 14, color: '#d9c2f5', align: 'center' });
    gfx.drawText(ctx, '500w', x, y - 20, { size: 24, bold: true, color: '#fff', align: 'center' });
    // 空荡荡的座位轮廓
    ctx.strokeStyle = 'rgba(190,195,210,0.55)'; ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    gfx.strokeRound(ctx, x - 84, y + 2, 30, 22, 5, 'rgba(190,195,210,0.55)', 2);
    gfx.strokeRound(ctx, x + 56, y + 2, 30, 22, 5, 'rgba(190,195,210,0.55)', 2);
    ctx.setLineDash([]);
    caption(ctx, x, y + 48, '播放≠到店', '#e7c9ff');
  },
  /* 16. 平台扣点吞噬利润：收银手机弹红色通知 */
  fee(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 56, 12);
    gfx.gradRound(ctx, x - 44, y - 24, 88, 28, 6, '#5f4a34', '#40301f', true);
    phoneRect(ctx, x - 8, y - 48, 30, 50, -0.1, '#cfe8ff');
    const bob = Math.sin(now * 0.004) * 4;
    gfx.fillRound(ctx, x - 2, y - 108 + bob, 108, 34, 17, '#e03131');
    ctx.beginPath(); ctx.arc(x - 2, y - 91 + bob, 4, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
    gfx.drawText(ctx, '平台扣点 23%', x + 54, y - 91 + bob, { size: 16, bold: true, color: '#fff', align: 'center', baseline: 'middle' });
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.007);
    gfx.drawText(ctx, '!', x - 8, y - 70, { size: 22, bold: true, color: `rgba(255,80,80,${pulse.toFixed(3)})`, align: 'center' });
    caption(ctx, x, y + 30, '每单先被切走23%', '#ffb3b3');
  },
  /* 17. 满减活动失控（hidden）：打印机狂吐小票 */
  promo(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 66, 14);
    gfx.fillRound(ctx, x - 34, y - 66, 68, 42, 6, '#3a3f4a');
    ctx.fillStyle = '#23262e'; ctx.fillRect(x - 26, y - 60, 52, 8);
    gfx.fillRound(ctx, x - 10, y - 30, 20, 8, 3, '#23262e');
    // 飞出的小票（下落循环）
    for (let i = 0; i < 3; i++) {
      const p = ((now * 0.0009 + i * 0.34) % 1);
      const px = x + 18 + i * 20 + p * 8;
      const py = y - 40 + p * p * 66;
      ctx.save(); ctx.translate(px, py); ctx.rotate(0.5 + p * 0.8);
      gfx.fillRound(ctx, -9, 0, 18, 26, 2, '#f4f0e4');
      ctx.strokeStyle = 'rgba(90,90,100,0.6)'; ctx.lineWidth = 1;
      line(ctx, -6, 6, 6, 6); line(ctx, -6, 11, 4, 11);
      ctx.restore();
    }
    // 堆积的小票
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(x + 30 + (i % 2) * 14, y - 4 - i * 6);
      ctx.rotate((i % 2 ? -1 : 1) * 0.14);
      gfx.fillRound(ctx, -16, -6, 32, 12, 2, '#efece0');
      ctx.restore();
    }
    gfx.drawText(ctx, '满30减15', x + 36, y - 34, { size: 13, bold: true, color: '#c01818', align: 'center' });
    caption(ctx, x, y + 32, '做一单亏一单', '#ffb3b3');
  },
  /* 18. 只看流水不看净利：流水喜报 vs 角落灰账本 */
  nomath(ctx, x, y, now) {
    ctx.save();
    ctx.translate(x, y - 44); ctx.rotate(0.04);
    gfx.fillRound(ctx, -70, -34, 140, 68, 4, '#f6ecd8');
    ctx.strokeStyle = '#c33'; ctx.lineWidth = 3;
    gfx.strokeRound(ctx, -70, -34, 140, 68, 4, '#c33', 3);
    gfx.drawText(ctx, '今日流水', 0, -26, { size: 19, bold: true, color: '#8a4a2f', align: 'center' });
    gfx.drawText(ctx, '¥2800', 0, 0, { size: 26, bold: true, color: '#d33', align: 'center' });
    ctx.restore();
    // 角落灰账本
    const dust = 0.3 + 0.1 * Math.sin(now * 0.0014);
    ctx.beginPath(); ctx.ellipse(x + 52, y + 34, 34, 12, 0, 0, TAU);
    ctx.fillStyle = `rgba(150,155,165,${dust.toFixed(3)})`; ctx.fill();
    ctx.save(); ctx.translate(x + 52, y + 26); ctx.rotate(-0.2);
    gfx.fillRound(ctx, -18, -10, 36, 20, 2, '#8a7a5c');
    ctx.strokeStyle = 'rgba(60,50,35,0.6)'; ctx.lineWidth = 1;
    line(ctx, 0, -10, 0, 10);
    ctx.restore();
    caption(ctx, x, y + 66, '账本吃灰中', '#dbe6f5');
  },
  /* 19. 堂食补贴外卖：空盘 vs 打包盒山 */
  cross(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 76, 15);
    // 堂食空盘
    ctx.beginPath(); ctx.ellipse(x - 44, y - 6, 34, 14, 0, 0, TAU);
    ctx.fillStyle = '#e8e4da'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x - 44, y - 6, 22, 9, 0, 0, TAU);
    ctx.fillStyle = '#d5d0c4'; ctx.fill();
    ctx.fillStyle = '#8a6a4a';
    ctx.beginPath(); ctx.arc(x - 52, y - 8, 2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 36, y - 4, 2, 0, TAU); ctx.fill();
    gfx.drawText(ctx, '堂食', x - 44, y + 16, { size: 13, bold: true, color: '#9aa0b8', align: 'center' });
    // 外卖盒山
    for (let i = 0; i < 3; i++) {
      const bw = 46 - i * 4;
      gfx.fillRound(ctx, x + 22 - bw / 2 + i * 2, y - 10 - i * 18, bw, 18, 3, '#f4f0e6');
      ctx.fillStyle = '#e63946';
      ctx.fillRect(x + 22 - bw / 2 + i * 2, y - 10 - i * 18 + 6, bw, 5);
    }
    gfx.drawText(ctx, '外卖', x + 24, y + 16, { size: 13, bold: true, color: '#e63946', align: 'center' });
    caption(ctx, x, y + 48, '赚钱的养亏钱的', '#ffd9b3');
  },
  /* 20. 员工懒散：倚柱嗑瓜子 */
  staff(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 66, 14);
    gfx.gradRound(ctx, x - 50, y - 90, 20, 96, 4, '#7a5a3c', '#54402a', true);
    person(ctx, x - 16, y + 4, 42, '#7a8aa0', 0.22);
    person(ctx, x + 18, y + 6, 42, '#7a8aa0', -0.24);
    // 瓜子 + 瓜子皮
    ctx.fillStyle = '#6a4a2a';
    ctx.beginPath(); ctx.ellipse(x + 2, y - 30, 8, 5, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const gx = x - 20 + (i * 13) % 48, gy = y + 12 + ((i * 7) % 14);
      const tw = 0.35 + 0.3 * Math.sin(now * 0.005 + i * 1.4);
      ctx.save();
      ctx.globalAlpha = Math.max(0.15, tw);
      ctx.fillStyle = '#d9c9a0';
      ctx.beginPath(); ctx.ellipse(gx, gy, 3.4, 1.8, i, 0, TAU); ctx.fill();
      ctx.restore();
    }
    caption(ctx, x, y + 46, '嗑瓜子比干活忙', '#ffd9b3');
  },
  /* 21. 接班瞎改革：新菜单覆盖老菜单一半 */
  succession(ctx, x, y, now, a) {
    ctx.save();
    ctx.translate(x - 22, y - 46); ctx.rotate(-0.04);
    gfx.fillRound(ctx, -46, -44, 92, 88, 4, '#d8c9a8');
    gfx.drawText(ctx, '老菜单', 0, -36, { size: 16, bold: true, color: '#6a4a2f', align: 'center' });
    ctx.strokeStyle = 'rgba(110,85,55,0.7)'; ctx.lineWidth = 2;
    ['猪肉白菜', '三鲜', '牛肉', '素馅'].forEach((t, i) => {
      gfx.drawText(ctx, t, -34, -12 + i * 15, { size: 12, color: '#7a5a3a' });
      line(ctx, 4, -6 + i * 15, 38, -6 + i * 15);
    });
    ctx.restore();
    // 新菜单（盖住右半，撕角下垂）
    const droop = 0.15 + Math.abs(Math.sin(now * 0.002)) * 0.25;
    ctx.save();
    ctx.translate(x + 16, y - 52); ctx.rotate(0.06);
    gfx.fillRound(ctx, -8, -40, 84, 84, 4, a);
    gfx.drawText(ctx, '网红', 34, -30, { size: 18, bold: true, color: '#fff', align: 'center' });
    gfx.drawText(ctx, '融合菜', 34, -8, { size: 18, bold: true, color: '#fff', align: 'center' });
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5;
    line(ctx, 4, 16, 64, 16); line(ctx, 12, 28, 60, 28);
    // 撕角
    ctx.fillStyle = shade(a, -40);
    ctx.save(); ctx.translate(68, 40); ctx.rotate(droop);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-16, 0); ctx.lineTo(0, 12); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
    caption(ctx, x, y + 52, '老客不认识了', '#ffd9b3');
  },
  /* 22. 账目对不上：两本账 + 差 3.2万？ */
  account(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 64, 13);
    const book = (bx, rot) => {
      ctx.save(); ctx.translate(bx, y - 18); ctx.rotate(rot);
      gfx.fillRound(ctx, -34, -20, 68, 40, 3, '#8a6a4a');
      gfx.fillRound(ctx, -30, -16, 60, 32, 2, '#f2ead8');
      ctx.strokeStyle = 'rgba(90,70,50,0.6)'; ctx.lineWidth = 1.5;
      line(ctx, 0, -16, 0, 16);
      for (let i = 0; i < 3; i++) { line(ctx, -24, -8 + i * 8, -6, -8 + i * 8); line(ctx, 6, -8 + i * 8, 24, -8 + i * 8); }
      ctx.restore();
    };
    book(x - 30, -0.08);
    book(x + 32, 0.1);
    const bob = Math.sin(now * 0.004) * 3;
    gfx.drawText(ctx, '差 3.2万？', x, y - 62 + bob, { size: 22, bold: true, color: '#ff6b6b', align: 'center' });
    ctx.beginPath(); ctx.arc(x + 62, y - 70 + bob, 14, 0, TAU);
    ctx.fillStyle = 'rgba(255,235,235,0.95)'; ctx.fill();
    ctx.strokeStyle = '#e03131'; ctx.lineWidth = 2; ctx.stroke();
    gfx.drawText(ctx, '?', x + 62, y - 70 + bob, { size: 20, bold: true, color: '#e03131', align: 'center', baseline: 'middle' });
    caption(ctx, x, y + 34, '两本账各说各话', '#ffb3b3');
  },
  /* 23. 采购回扣（hidden）：台账里夹着红包 */
  kickback(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 60, 13);
    gfx.fillRound(ctx, x - 44, y - 30, 88, 34, 4, '#5f4a34');
    ctx.save();
    ctx.translate(x - 6, y - 40); ctx.rotate(-0.1);
    gfx.fillRound(ctx, -36, -22, 72, 44, 3, '#f2ead8');
    ctx.strokeStyle = 'rgba(90,70,50,0.6)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) line(ctx, -26, -12 + i * 8, 26 - (i % 2) * 8, -12 + i * 8);
    gfx.drawText(ctx, '采购台账', 0, -34, { size: 14, bold: true, color: '#6a4a2f', align: 'center' });
    ctx.restore();
    // 红包半露
    ctx.save();
    ctx.translate(x + 34, y - 34); ctx.rotate(0.24);
    gfx.fillRound(ctx, -15, -22, 30, 44, 3, '#d93636');
    gfx.fillRound(ctx, -15, -22, 30, 10, 3, '#b32a2a');
    gfx.drawText(ctx, '福', 0, 4, { size: 16, bold: true, color: '#f5c518', align: 'center', baseline: 'middle' });
    ctx.restore();
    gfx.drawText(ctx, '好处费', x + 56, y - 56, { size: 13, bold: true, color: '#ff8a8a', align: 'center' });
    caption(ctx, x, y + 34, '进价高40%', '#ffb3b3');
  },
  /* 24. 盲目扩张：3店剪彩合影 vs 冷清店内 */
  expand(ctx, x, y, now) {
    ctx.save();
    ctx.translate(x, y - 52); ctx.rotate(0.03);
    gfx.fillRound(ctx, -76, -46, 152, 96, 6, '#4a3a28');
    gfx.fillRound(ctx, -70, -40, 140, 84, 4, '#e8dfc8');
    ctx.fillStyle = 'rgba(232,223,200,0.35)';
    ctx.fillRect(-70, -40, 140, 84);
    for (let i = 0; i < 3; i++) {
      const sx = -46 + i * 46;
      gfx.fillRound(ctx, sx - 15, -8, 30, 34, 2, i === 1 ? '#8a6a4a' : '#a3866a');
      ctx.fillStyle = i === 1 ? '#c2571a' : '#d9a441';
      ctx.beginPath(); ctx.moveTo(sx - 17, -8); ctx.lineTo(sx, -20); ctx.lineTo(sx + 17, -8); ctx.closePath(); ctx.fill();
    }
    gfx.drawText(ctx, '3店齐开 · 盛大剪彩', 0, 26, { size: 13, bold: true, color: '#8a4a2f', align: 'center' });
    // 褪色飘落彩带
    for (let i = 0; i < 3; i++) {
      const p = ((now * 0.0005 + i * 0.3) % 1);
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.translate(-50 + i * 44 + p * 10, 52 + p * 30);
      ctx.rotate(p * 2 + i);
      ctx.fillStyle = ['#d9564a', '#e8c33a', '#7fa0d0'][i];
      ctx.fillRect(-6, -2, 12, 4);
      ctx.restore();
    }
    ctx.restore();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(200,205,220,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y + 38, 60, 16, 0, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    caption(ctx, x, y + 66, '两家已在转让', '#ffd9b3');
  },
  /* 25. 品控崩塌：烤糊的串冒烟 + 差评纸条 */
  quality(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 62, 13);
    gfx.fillRound(ctx, x - 50, y - 22, 100, 24, 5, '#3c3a3c');
    ctx.strokeStyle = '#141416'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) line(ctx, x - 44, y - 18 + i * 5, x + 44, y - 18 + i * 5);
    for (let i = 0; i < 3; i++) {
      const sx = x - 26 + i * 26;
      ctx.strokeStyle = '#d8cfc0'; ctx.lineWidth = 2.5;
      line(ctx, sx - 14, y - 30, sx + 14, y - 30);
      ctx.fillStyle = '#1c1a1a';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.ellipse(sx - 8 + k * 8, y - 30, 5, 4, 0, 0, TAU); ctx.fill();
      }
    }
    smoke(ctx, x + 10, y - 40, now, 'rgba(90,90,95,1)', 0.9);
    paperSheet(ctx, x + 52, y - 58, 34, 40, 0.14, null, 2);
    gfx.drawText(ctx, '差评', x + 52, y - 60, { size: 13, bold: true, color: '#d33', align: 'center', baseline: 'middle' });
    gfx.drawText(ctx, '✗✗✗', x + 52, y - 46, { size: 11, bold: true, color: '#d33', align: 'center' });
    caption(ctx, x, y + 30, '投诉率 35%', '#ffb3b3');
  },
  /* 26. 资金链断裂：3张催款通知 + 计算器 -80,000 */
  debt(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 62, 13);
    gfx.gradRound(ctx, x - 50, y - 30, 100, 34, 5, '#5f4a34', '#40301f', true);
    // 墙上催款通知
    [[-58, -108, -0.08], [-10, -114, 0.05], [38, -106, -0.03]].forEach(([dx, dy, r], i) => {
      const flutter = Math.sin(now * 0.003 + i * 2) * 0.04;
      paperSheet(ctx, x + dx, y + dy + 62, 38, 48, r + flutter, '#c01818', 2);
      gfx.drawText(ctx, '催款', x + dx, y + dy + 56, { size: 12, bold: true, color: '#fff', align: 'center', baseline: 'middle' });
    });
    // 计算器
    gfx.fillRound(ctx, x + 6, y - 58, 52, 34, 4, '#2c2f38');
    gfx.fillRound(ctx, x + 10, y - 54, 44, 12, 2, '#0c1410');
    gfx.drawText(ctx, '-80,000', x + 32, y - 48, { size: 10, bold: true, color: '#ff6b6b', align: 'center', baseline: 'middle' });
    ctx.fillStyle = '#555a64';
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) ctx.fillRect(x + 12 + c * 10, y - 38 + r * 7, 7, 5);
    caption(ctx, x, y + 32, '负债滚到90万', '#ffb3b3');
  },
  /* 27. 雇排队托（hidden）：抽屉里"排队兼职"合同 */
  shills(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 62, 13);
    gfx.fillRound(ctx, x - 52, y - 46, 104, 52, 5, '#4a3a28');
    gfx.fillRound(ctx, x - 46, y - 40, 92, 40, 4, '#33271a');
    // 半开的抽屉 + 露出的合同纸角
    gfx.fillRound(ctx, x - 40, y - 12, 80, 20, 3, '#5a4632');
    gfx.fillRound(ctx, x - 40, y - 12, 80, 6, 3, '#6b543c');
    ctx.save();
    ctx.translate(x + 8, y - 18); ctx.rotate(0.18);
    gfx.fillRound(ctx, -24, -8, 48, 18, 2, '#f2ead8');
    ctx.strokeStyle = 'rgba(90,70,50,0.6)'; ctx.lineWidth = 1;
    line(ctx, -18, -2, 18, -2); line(ctx, -18, 3, 10, 3);
    ctx.restore();
    gfx.drawText(ctx, '排队兼职 · 日结150', x, y - 66, { size: 14, bold: true, color: '#ffd9b3', align: 'center' });
    ctx.strokeStyle = '#e03131'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x + 34, y - 66, 46, 11, -0.06, 0, TAU); ctx.stroke();
    caption(ctx, x, y + 34, '开业排队是买的', '#ffb3b3');
  },
  /* 28. 高端定位失误：锃亮人均500立牌 + 落叶 */
  position(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 54, 12);
    ctx.save();
    ctx.translate(x, y - 52); ctx.rotate(0.04);
    gfx.fillRound(ctx, -40, -58, 80, 116, 6, '#1c1a22');
    const gloss = ctx.createLinearGradient(-40, -58, 40, 58);
    gloss.addColorStop(0, 'rgba(255,255,255,0.30)');
    gloss.addColorStop(0.4, 'rgba(255,255,255,0.04)');
    gloss.addColorStop(1, 'rgba(255,255,255,0.14)');
    gfx.fillRound(ctx, -40, -58, 80, 116, 6, gloss);
    gfx.strokeRound(ctx, -40, -58, 80, 116, 6, '#e8c33a', 2.5);
    gfx.drawText(ctx, '人均', 0, -44, { size: 18, bold: true, color: '#f5e9c8', align: 'center' });
    gfx.drawText(ctx, '500', 0, -20, { size: 34, bold: true, color: '#f5c518', align: 'center' });
    ctx.strokeStyle = 'rgba(245,197,24,0.6)'; ctx.lineWidth = 1.5;
    line(ctx, -24, 16, 24, 16); line(ctx, -16, 28, 16, 28);
    ctx.restore();
    // 门口风扫落叶
    for (let i = 0; i < 3; i++) {
      const p = ((now * 0.0006 + i * 0.33) % 1);
      const lx = x - 60 + p * 130;
      const ly = y + 22 + Math.sin(p * 8 + i * 2) * 6 + p * 6;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.translate(lx, ly); ctx.rotate(p * 6 + i);
      ctx.fillStyle = ['#b3702f', '#8a6a2f', '#a3542f'][i];
      ctx.beginPath(); ctx.ellipse(0, 0, 6, 3, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    caption(ctx, x, y + 60, '门可罗雀', '#dbe6f5');
  },
  /* 29. 成本倒挂：空运食材 + 冰雾 + 398价签 */
  cost(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 66, 14);
    gfx.fillRound(ctx, x - 56, y - 26, 112, 28, 5, '#3c4a56');
    ctx.strokeStyle = 'rgba(190,225,235,0.6)'; ctx.lineWidth = 2;
    line(ctx, x - 50, y - 20, x + 50, y - 20);
    // 银亮的鱼 + 冰
    for (let i = 0; i < 2; i++) {
      const fx2 = x - 28 + i * 48;
      ctx.save(); ctx.translate(fx2, y - 34); ctx.rotate(-0.1 + i * 0.2);
      ctx.beginPath(); ctx.ellipse(0, 0, 20, 7, 0, 0, TAU);
      ctx.fillStyle = '#c8d8e2'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(26, -6); ctx.lineTo(26, 6); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    for (let i = 0; i < 4; i++) {
      const p = ((now * 0.001 + i * 0.25) % 1);
      ctx.globalAlpha = (1 - p) * 0.4;
      ctx.beginPath(); ctx.arc(x - 40 + i * 26, y - 40 - p * 22, 5 + p * 6, 0, TAU);
      ctx.fillStyle = '#cfe8f5'; ctx.fill();
    }
    ctx.globalAlpha = 1;
    priceTag(ctx, x + 48, y - 60, '¥398/份', Math.sin(now * 0.003) * 0.22, '#3d5a80');
    gfx.drawText(ctx, '空运直达', x, y - 66, { size: 13, bold: true, color: '#cfe8f5', align: 'center' });
    caption(ctx, x, y + 30, '成本先倒贴4万/月', '#cfe8f5');
  },
  /* 30. 复购率崩塌：散落会员卡 + 3% 红区饼图 */
  repeat(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 66, 14);
    gfx.fillRound(ctx, x - 58, y - 84, 116, 84, 6, '#26313f');
    gfx.drawText(ctx, '会员墙', x, y - 78, { size: 15, bold: true, color: '#9fb4cc', align: 'center' });
    // 空卡槽 + 滑落的卡
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const cx = x - 36 + c * 36, cy = y - 56 + r * 26;
        ctx.strokeStyle = 'rgba(160,180,200,0.4)'; ctx.lineWidth = 1.5;
        ctx.strokeRect(cx - 13, cy - 8, 26, 16);
      }
    }
    for (let i = 0; i < 2; i++) {
      const p = ((now * 0.0004 + i * 0.5) % 1);
      ctx.save();
      ctx.translate(x - 30 + i * 58, y - 48 + p * 46);
      ctx.rotate(0.3 - p * 0.5);
      gfx.fillRound(ctx, -13, -8, 26, 16, 2, '#d9e4ef');
      ctx.restore();
    }
    // 饼图：3% 红区
    const px = x + 40, py = y - 20, pr = 22;
    ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU);
    ctx.fillStyle = '#3a4a5c'; ctx.fill();
    const sweep = Math.min(1, ((now * 0.0012) % 2)) * 0.06 * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, pr, -Math.PI / 2, -Math.PI / 2 + Math.max(0.12, sweep)); ctx.closePath();
    ctx.fillStyle = '#e03131'; ctx.fill();
    ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU);
    ctx.strokeStyle = 'rgba(200,215,230,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    gfx.drawText(ctx, '回头客 3%', x - 8, y + 6, { size: 15, bold: true, color: '#ff9a9a', align: 'center' });
    caption(ctx, x, y + 34, '尝鲜客一去不返', '#cfe3ff');
  },
  /* 31. 需求幻觉（hidden）：平板调研 "周边人均 ¥120" 被圈出 */
  bubble(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 62, 13);
    gfx.fillRound(ctx, x - 8, y - 14, 16, 26, 3, '#3a3f4a');
    gfx.fillRound(ctx, x - 52, y - 78, 104, 64, 8, '#10141c');
    gfx.fillRound(ctx, x - 48, y - 74, 96, 56, 6, '#e8f0f5');
    gfx.drawText(ctx, '商圈调研', x, y - 70, { size: 12, bold: true, color: '#3a4a5c', align: 'center' });
    // 柱状图
    const bars = [16, 24, 38];
    bars.forEach((bh, i) => {
      ctx.fillStyle = i === 2 ? '#e8a13a' : '#8aa2b8';
      ctx.fillRect(x - 34 + i * 24, y - 22 - bh, 14, bh);
    });
    gfx.drawText(ctx, '周边人均 ¥120', x, y - 84, { size: 14, bold: true, color: '#fff', align: 'center' });
    const pulse = 0.6 + 0.4 * Math.sin(now * 0.005);
    ctx.strokeStyle = `rgba(224,49,49,${pulse.toFixed(3)})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x + 14, y - 40, 34, 15, -0.08, 0, TAU); ctx.stroke();
    caption(ctx, x, y + 30, '数据摆着却不看', '#ffb3b3');
  },
  /* 32. 流量泡沫：褪色的"排队3小时"易拉宝 */
  hype(ctx, x, y, now, a) {
    groundShadow(ctx, x, y + 6, 52, 12);
    ctx.save();
    ctx.translate(x, y - 56); ctx.rotate(-0.05);
    gfx.fillRound(ctx, -36, -58, 72, 112, 6, '#4d3a5c');
    ctx.globalAlpha = 0.75;
    gfx.fillRound(ctx, -30, -52, 60, 100, 4, shade(a, -30));
    ctx.globalAlpha = 1;
    gfx.drawText(ctx, '排队', 0, -42, { size: 20, bold: true, color: 'rgba(255,255,255,0.75)', align: 'center' });
    gfx.drawText(ctx, '3小时', 0, -16, { size: 22, bold: true, color: 'rgba(255,255,255,0.65)', align: 'center' });
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
    line(ctx, -20, 12, 20, 12); line(ctx, -14, 26, 14, 26);
    // 褪色裂纹
    ctx.strokeStyle = 'rgba(230,220,240,0.35)'; ctx.lineWidth = 1;
    line(ctx, -18, -30, 6, 8); line(ctx, 12, -20, 22, 20);
    ctx.restore();
    const dust = 0.26 + 0.1 * Math.sin(now * 0.0015);
    ctx.beginPath(); ctx.ellipse(x, y + 12, 46, 13, 0, 0, TAU);
    ctx.fillStyle = `rgba(150,150,165,${dust.toFixed(3)})`; ctx.fill();
    caption(ctx, x, y + 48, '热度90天退潮', '#e7c9ff');
  },
  /* 33. 产品撑不住：榴莲鸡 + "难吃"评论弹窗 */
  product(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 60, 13);
    ctx.beginPath(); ctx.ellipse(x - 12, y - 8, 40, 17, 0, 0, TAU);
    ctx.fillStyle = '#e8e4da'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.stroke();
    // 榴莲
    ctx.beginPath(); ctx.arc(x - 26, y - 18, 14, 0, TAU);
    ctx.fillStyle = '#8a9a4a'; ctx.fill();
    ctx.strokeStyle = '#5a6a2f'; ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * TAU;
      line(ctx, x - 26 + Math.cos(ang) * 12, y - 18 + Math.sin(ang) * 12, x - 26 + Math.cos(ang) * 17, y - 18 + Math.sin(ang) * 17);
    }
    // 鸡腿
    ctx.beginPath(); ctx.ellipse(x + 4, y - 14, 13, 9, 0.3, 0, TAU);
    ctx.fillStyle = '#d9a05f'; ctx.fill();
    ctx.strokeStyle = '#f2ead8'; ctx.lineWidth = 4;
    line(ctx, x + 14, y - 10, x + 24, y - 4);
    // 评论弹窗
    const bob = Math.sin(now * 0.004) * 3;
    gfx.fillRound(ctx, x + 4, y - 84 + bob, 78, 40, 8, 'rgba(255,255,255,0.95)');
    gfx.strokeRound(ctx, x + 4, y - 84 + bob, 78, 40, 8, '#e03131', 2);
    gfx.fillRound(ctx, x + 16, y - 46 + bob, 12, 10, 2, 'rgba(255,255,255,0.95)');
    gfx.drawText(ctx, '难吃', x + 18, y - 76 + bob, { size: 16, bold: true, color: '#e03131' });
    gfx.drawText(ctx, '★☆☆☆☆', x + 18, y - 56 + bob, { size: 13, bold: true, color: '#e8a13a' });
    caption(ctx, x, y + 36, '复购率仅5%', '#ffd9b3');
  },
  /* 34. 备货失控欠款：整墙榴莲库存 + 30万封条 */
  debt9(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 74, 15);
    const labels = ['榴莲', '榴莲', '榴莲'];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        carton(ctx, x - 66 + c * 46, y - 34 - r * 30, 42, 28, labels[(r + c) % 3], r % 2 === 0);
      }
    }
    ctx.save();
    ctx.translate(x, y - 58); ctx.rotate(-0.08);
    gfx.fillRound(ctx, -78, -12, 156, 24, 3, '#c01818');
    gfx.drawText(ctx, '30万货款未结', 0, 0, { size: 17, bold: true, color: '#fff', align: 'center', baseline: 'middle' });
    ctx.restore();
    caption(ctx, x, y + 30, '按爆款备的货全砸手里', '#ffb3b3');
  },
  /* 35. 花钱买爆款（hidden）：抽屉合同 + 鲜红印章 */
  mcn(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 62, 13);
    gfx.fillRound(ctx, x - 52, y - 44, 104, 50, 5, '#3a2c4d');
    gfx.fillRound(ctx, x - 44, y - 14, 88, 22, 3, '#2c2138');
    ctx.save();
    ctx.translate(x - 4, y - 30); ctx.rotate(-0.08);
    gfx.fillRound(ctx, -40, -26, 80, 52, 3, '#f2ead8');
    ctx.strokeStyle = 'rgba(90,70,50,0.6)'; ctx.lineWidth = 1.5;
    line(ctx, -30, -12, 30, -12); line(ctx, -30, -2, 22, -2); line(ctx, -30, 8, 26, 8);
    ctx.restore();
    gfx.drawText(ctx, 'MCN 推广 20万', x - 4, y - 62, { size: 15, bold: true, color: '#ffd9ef', align: 'center' });
    const glow = 0.7 + 0.3 * Math.sin(now * 0.005);
    ctx.save();
    ctx.globalAlpha = glow;
    ctx.strokeStyle = '#e03131'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x + 26, y - 26, 17, 0, TAU); ctx.stroke();
    gfx.drawText(ctx, '已付款', x + 26, y - 26, { size: 11, bold: true, color: '#e03131', align: 'center', baseline: 'middle' });
    ctx.restore();
    caption(ctx, x, y + 34, '500w播放是买的', '#e7c9ff');
  },
  /* 36. 客群重叠：两张地图红圈几乎重合 */
  overlap(ctx, x, y, now) {
    const sheet = (sx, sy, rot) => {
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(rot);
      gfx.fillRound(ctx, -48, -36, 96, 72, 3, '#e8e0c8');
      ctx.strokeStyle = 'rgba(120,130,110,0.7)'; ctx.lineWidth = 1.5;
      line(ctx, -34, -20, 20, -26); line(ctx, -30, 2, 34, -4); line(ctx, -20, 24, 30, 18);
      line(ctx, -10, -32, -16, 28); line(ctx, 12, -30, 6, 30);
      ctx.restore();
    };
    sheet(x - 26, y - 46, -0.06);
    sheet(x + 22, y - 38, 0.08);
    // 红圈1
    ctx.strokeStyle = '#e03131'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x - 16, y - 46, 26, 20, -0.1, 0, TAU); ctx.stroke();
    // 红圈2（动画重合闪烁）
    const pulse = 0.55 + 0.45 * Math.sin(now * 0.006);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#ff5050'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x - 4, y - 42, 26, 20, 0.14, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(224,49,49,0.18)';
    ctx.beginPath(); ctx.ellipse(x - 10, y - 44, 20, 15, 0, 0, TAU); ctx.fill();
    ctx.restore();
    gfx.drawText(ctx, '相距仅800米', x, y - 82, { size: 14, bold: true, color: '#ffb3b3', align: 'center' });
    caption(ctx, x, y + 14, '两店抢同一批客', '#ffb3b3');
  },
  /* 37. 赌徒心态："再来一家 一定回本" + 骰子 */
  gambler(ctx, x, y, now) {
    groundShadow(ctx, x, y + 6, 60, 13);
    gfx.fillRound(ctx, x - 46, y - 28, 92, 30, 5, '#5f4a34');
    ctx.save();
    ctx.translate(x - 8, y - 56); ctx.rotate(-0.07);
    gfx.fillRound(ctx, -44, -26, 88, 52, 3, '#f6ecd8');
    gfx.drawText(ctx, '再来一家', 0, -18, { size: 17, bold: true, color: '#4a3a28', align: 'center' });
    gfx.drawText(ctx, '一定回本！', 0, 4, { size: 17, bold: true, color: '#c01818', align: 'center' });
    ctx.strokeStyle = '#c01818'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-30, 18); ctx.quadraticCurveTo(0, 24, 30, 16); ctx.stroke();
    ctx.restore();
    dice(ctx, x + 34, y - 66, 22, Math.sin(now * 0.002) * 0.2, 5);
    dice(ctx, x + 52, y - 42, 20, -0.3 + Math.sin(now * 0.002 + 1) * 0.15, 3);
    caption(ctx, x, y + 32, '负债45万想翻本', '#ffb3b3');
  },
  /* 38. 资源摊薄：两杯奶茶一满一空 + 分裂箭头 */
  spread(ctx, x, y, now, a) {
    groundShadow(ctx, x, y + 6, 62, 13);
    // 满杯
    gfx.fillRound(ctx, x - 52, y - 52, 34, 56, 6, 'rgba(240,240,245,0.9)');
    const slosh = Math.sin(now * 0.003) * 2;
    gfx.fillRound(ctx, x - 49, y - 30 + slosh, 28, 31 - slosh, 4, '#8a5a3c');
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(x - 42 + i * 8, y - 8, 3, 0, TAU);
      ctx.fillStyle = '#3a2a20'; ctx.fill();
    }
    ctx.strokeStyle = '#d9d9e0'; ctx.lineWidth = 3;
    line(ctx, x - 42, y - 66, x - 34, y - 50);
    // 空杯
    gfx.fillRound(ctx, x + 20, y - 52, 34, 56, 6, 'rgba(240,240,245,0.45)');
    ctx.strokeStyle = 'rgba(120,120,135,0.6)'; ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    gfx.strokeRound(ctx, x + 20, y - 52, 34, 56, 6, 'rgba(120,120,135,0.6)', 2);
    ctx.setLineDash([]);
    gfx.drawText(ctx, '空', x + 37, y - 26, { size: 16, bold: true, color: '#9aa0b8', align: 'center' });
    // 分裂箭头
    ctx.strokeStyle = a; ctx.lineWidth = 3;
    line(ctx, x - 12, y - 24, x + 12, y - 40);
    line(ctx, x + 12, y - 40, x + 6, y - 40); line(ctx, x + 12, y - 40, x + 12, y - 34);
    line(ctx, x - 12, y - 24, x + 12, y - 8);
    line(ctx, x + 12, y - 8, x + 12, y - 14); line(ctx, x + 12, y - 8, x + 6, y - 8);
    gfx.drawText(ctx, '人力/物料拆半', x, y + 22, { size: 13, bold: true, color: '#ffd9e8', align: 'center' });
    caption(ctx, x, y + 48, '两家都半死不活', '#ffd9e8');
  },
  /* 39. 同一个坑摔两次（hidden）：旧报告红笔"勿选此处"压着新合同 */
  sameSpot(ctx, x, y, now) {
    ctx.save();
    ctx.translate(x - 14, y - 56); ctx.rotate(-0.08);
    gfx.fillRound(ctx, -44, -30, 88, 60, 3, '#e8e0c8');
    gfx.drawText(ctx, '选址报告', 0, -22, { size: 14, bold: true, color: '#5a5038', align: 'center' });
    ctx.strokeStyle = 'rgba(90,80,60,0.6)'; ctx.lineWidth = 1.5;
    line(ctx, -30, -6, 30, -6); line(ctx, -30, 6, 18, 6); line(ctx, -30, 18, 26, 18);
    ctx.restore();
    const pulse = 0.65 + 0.35 * Math.sin(now * 0.005);
    gfx.drawText(ctx, '勿选此处！', x - 14, y - 66, { size: 18, bold: true, color: `rgba(224,49,49,${pulse.toFixed(3)})`, align: 'center' });
    ctx.strokeStyle = `rgba(224,49,49,${pulse.toFixed(3)})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x - 16, y - 62, 46, 13, -0.08, 0, TAU); ctx.stroke();
    // 新合同（同一地址）
    ctx.save();
    ctx.translate(x + 12, y + 6); ctx.rotate(0.06);
    gfx.fillRound(ctx, -48, -20, 96, 40, 3, '#f6f2ea');
    gfx.drawText(ctx, '租赁合同（新签）', 0, -12, { size: 12, bold: true, color: '#4a3a28', align: 'center' });
    ctx.strokeStyle = 'rgba(90,80,60,0.6)'; ctx.lineWidth = 1.5;
    line(ctx, -36, 0, 36, 0); line(ctx, -36, 10, 22, 10);
    ctx.restore();
    ctx.strokeStyle = `rgba(224,49,49,${(pulse * 0.8).toFixed(3)})`; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 20, y - 50);
    ctx.quadraticCurveTo(x + 24, y - 34, x + 20, y - 14);
    ctx.stroke();
    caption(ctx, x, y + 46, '就是上次那个铺位', '#ffb3b3');
  },
};

/* =====================================================================
 * 状态覆盖层：已找到 / 线索金色高亮 / 提示脉冲
 * ===================================================================== */
function drawFoundMark(ctx, x, y) {
  const r = 64;
  ctx.strokeStyle = C.green; ctx.lineWidth = 5;
  const L = 20;
  const corners = [
    [x - r, y - r, 1, 1], [x + r, y - r, -1, 1],
    [x - r, y + r, 1, -1], [x + r, y + r, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    line(ctx, cx, cy, cx + L * sx, cy);
    line(ctx, cx, cy, cx, cy + L * sy);
  }
  ctx.beginPath(); ctx.arc(x + r - 8, y - r + 8, 15, 0, TAU);
  ctx.fillStyle = C.green; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  gfx.drawText(ctx, '✓', x + r - 8, y - r + 9, { size: 18, bold: true, color: '#fff', align: 'center', baseline: 'middle' });
}
function drawGlowRing(ctx, x, y, now) {
  ctx.save();
  ctx.strokeStyle = C.gold; ctx.lineWidth = 3;
  ctx.setLineDash([13, 10]);
  ctx.lineDashOffset = -now * 0.02;
  ctx.beginPath(); ctx.arc(x, y, 68, 0, TAU); ctx.stroke();
  ctx.lineDashOffset = now * 0.016;
  ctx.beginPath(); ctx.arc(x, y, 80, 0, TAU); ctx.stroke();
  ctx.restore();
}
function drawHintPulse(ctx, f, t0, now) {
  const p = (now - t0) / 3000;
  for (let k = 0; k < 3; k++) {
    const pk = gfx.clamp(p * 1.3 - k * 0.15, 0, 1);
    if (pk <= 0 || pk >= 1) continue;
    ctx.globalAlpha = 1 - pk;
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 6 * (1 - pk) + 2;
    ctx.beginPath(); ctx.arc(f.x, f.y, 28 + pk * 120, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/* =====================================================================
 * 公开 API
 * ===================================================================== */
// 渲染整个房间：地板 → 墙 → 家具(按 y 排序) → 异常 → 光影 → 提示脉冲
function renderRoom(ctx, lv, now, opts) {
  const o = opts || {};
  const ff = lv.findFaults || {};
  const theme = ff.sceneTheme || {};
  const style = theme.style || 'tea';
  const accent = theme.accent || C.accent;

  drawFloor(ctx, style, accent, now);
  drawWall(ctx, style, accent, theme, now);

  const layout = (LAYOUTS[style] || LAYOUTS.tea).slice().sort((a, b) => a.y - b.y);
  for (const it of layout) {
    const fn = FURN[it.type];
    if (fn) fn(ctx, it, accent, now);
  }

  // 异常插画（hidden 未解锁不画；revealedPop 弹跳进场）
  const revealed = store.state.revealedZones;
  const foundIds = o.foundIds || [];
  const glowIds = o.glowIds || [];
  for (const f of ff.faults || []) {
    if (f.hidden && !revealed[f.unlockBy]) continue;
    const fn = ANOM[f.id];
    if (!fn) continue;
    const isFound = foundIds.indexOf(f.id) >= 0;
    const isPop = o.revealedPop && o.revealedPop.id === f.id;
    ctx.save();
    if (isPop) {
      const p = gfx.clamp((now - o.revealedPop.t0) / 450, 0, 1);
      const s = Math.max(0.01, gfx.easeOutBack(p));
      ctx.translate(f.x, f.y);
      ctx.scale(s, s);
      ctx.translate(-f.x, -f.y);
    }
    fn(ctx, f.x, f.y, now, accent);
    if (isFound) drawFoundMark(ctx, f.x, f.y);
    else if (glowIds.indexOf(f.id) >= 0) drawGlowRing(ctx, f.x, f.y, now);
    ctx.restore();
  }

  drawLight(ctx);

  if (o.hintedId) {
    const f = (ff.faults || []).find(x => x.id === o.hintedId);
    if (f && now - (o.hintedT0 || now) < 3000) drawHintPulse(ctx, f, o.hintedT0 || now, now);
  }
}

// 命中测试：fault(半径40) → inspect(带 reveal 的隐藏点 zone) → item(家具) → null
function hitTestRoom(lv, lx, ly) {
  const ff = lv && lv.findFaults;
  if (!ff) return null;
  const revealed = store.state.revealedZones;
  for (const f of ff.faults || []) {
    if (f.hidden && !revealed[f.unlockBy]) continue;
    const dx = lx - f.x, dy = ly - f.y;
    if (dx * dx + dy * dy <= 40 * 40) return { kind: 'fault', id: f.id };
  }
  for (const z of ff.zones || []) {
    if (!z.reveal) continue;
    if (lx >= z.x && lx <= z.x + z.w && ly >= z.y && ly <= z.y + z.h) {
      return { kind: 'inspect', zoneId: z.id };
    }
  }
  const style = (ff.sceneTheme && ff.sceneTheme.style) || 'tea';
  const layout = LAYOUTS[style] || LAYOUTS.tea;
  for (const it of layout) {
    const rx = it.x - it.w / 2;
    const ry = it.wall ? it.y - it.h / 2 : it.y - it.h;
    if (lx >= rx && lx <= rx + it.w && ly >= ry && ly <= ry + it.h) {
      return { kind: 'item', itemType: it.type };
    }
  }
  return null;
}

// 普通家具 flavor 文案（排查吐槽）
const FLAVOR = {
  counter: '吧台擦得挺亮，可惜擦不出利润。',
  cashDesk: '收银台没毛病——钱没少收，是花出去的太多。',
  tableSet: '桌椅摆得挺整齐，就是没几个人坐。',
  booth: '卡座沙发挺舒服，空着也是白搭租金。',
  fridge: '冰箱嗡嗡运转正常，里面的库存可就难说了。',
  freezer: '冰柜制冷没问题，问题是里面的成本率。',
  oven: '烤炉温度正常——问题从来不在炉子上。',
  steamer: '蒸笼摞得挺高，出笼的卖不卖得动另说。',
  grill: '炭火正旺，可惜旺不了账本。',
  sushiBar: '板前擦得锃亮，师傅比客人多就不对了。',
  displayCase: '展示柜挺精致，东西卖不动就是摆设。',
  shelf: '货架码得挺整齐，库存周转才是命门。',
  plant: '绿植养得不错，店里最有生气的就它了。',
  trashBin: '垃圾桶挺干净——今天扔的报废品在别处。',
  poster: '海报贴得挺正，就是没人看。',
  phoneStand: '直播架调试得很专业，有这功夫不如擦擦桌子。',
  calendar: '日历翻到了今天，日子可不等人。',
  neonDeco: '灯串挺浪漫，电费也是钱。',
  queueRail: '栏杆排得挺规范，就是没人排队。',
  boxes: '箱子码得挺齐——压在里面的全是成本。',
};
function itemFlavor(itemType) {
  return FLAVOR[itemType] || '这里看起来没什么问题。';
}

module.exports = { renderRoom, hitTestRoom, itemFlavor };
