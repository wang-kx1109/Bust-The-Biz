/* =====================================================================
 * js/core/gfx.js — Canvas 绘图工具库
 * 全部坐标使用"逻辑单位"（逻辑宽 750）。
 * 色板与小程序 app.wxss 一致（字面量颜色，不用 CSS 变量）。
 * ===================================================================== */
const layout = require('./layout.js');

const C = {
  bg: '#1a1a2e',
  bg2: '#16213e',
  accent: '#e94560',
  accentDark: '#c23152',
  green: '#16c79a',
  greenDark: '#0fa77f',
  gold: '#f5c518',
  amber: '#f5a623',
  text: '#eaeaf2',
  muted: '#9aa0b8',
  glass: 'rgba(255,255,255,0.08)',
  glassBorder: 'rgba(255,255,255,0.14)',
  bubble: '#242448',
  sceneBg: '#23233f',
  modalBg: '#22223f',
  overlay: 'rgba(0,0,0,0.7)',
  lossText: '#ff8598',
};

// 字体栈（含 emoji；canvas 上 emoji 在真机正常，Windows 模拟器可能黑白）
const FONT = '"PingFang SC","Microsoft YaHei","Segoe UI Emoji","Noto Color Emoji",sans-serif';

function fontStr(size, bold) {
  return `${bold ? 'bold ' : ''}${Math.round(size)}px ${FONT}`;
}

/* ---------- 圆角矩形 ---------- */
function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
function fillRound(ctx, x, y, w, h, r, color) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}
function strokeRound(ctx, x, y, w, h, r, color, lw) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw || 2;
  ctx.stroke();
}

/* ---------- 文字 ---------- */
function drawText(ctx, text, x, y, opts) {
  const o = opts || {};
  ctx.font = fontStr(o.size || 28, o.bold);
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.baseline || 'top';
  ctx.fillStyle = o.color || C.text;
  ctx.fillText(text, x, y);
}
function textWidth(ctx, text, size, bold) {
  ctx.font = fontStr(size, bold);
  return ctx.measureText(text).width;
}
// CJK 按字符断行
function wrapLines(ctx, text, maxW, size, bold) {
  const lines = [];
  let cur = '';
  ctx.font = fontStr(size, bold);
  for (const ch of String(text)) {
    const test = cur + ch;
    if (cur && ctx.measureText(test).width > maxW) {
      lines.push(cur);
      cur = ch;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawWrapped(ctx, text, x, y, maxW, lineH, opts) {
  const o = opts || {};
  const lines = wrapLines(ctx, text, maxW, o.size || 28, o.bold);
  let yy = y;
  for (const ln of lines) {
    drawText(ctx, ln, x, yy, o);
    yy += (lineH || (o.size || 28) * 1.5);
  }
  return yy; // 返回文本块底部
}

/* ---------- 按钮 ---------- */
function buttonTheme(name) {
  if (name === 'green') return { fill: C.green, dark: C.greenDark, text: '#fff' };
  if (name === 'ghost') return { fill: 'rgba(255,255,255,0.05)', dark: C.glassBorder, text: C.text, border: C.glassBorder };
  return { fill: C.accent, dark: C.accentDark, text: '#fff' }; // primary
}
function drawButton(ctx, b) {
  const t = buttonTheme(b.theme || 'primary');
  const disabled = b.enabled === false;
  if (disabled) {
    fillRound(ctx, b.x, b.y, b.w, b.h, b.r || 20, 'rgba(255,255,255,0.06)');
    drawText(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2, {
      size: b.fontSize || 30, color: 'rgba(154,160,184,0.6)', align: 'center', baseline: 'middle', bold: true,
    });
    return;
  }
  // 渐变主色
  const grad = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
  grad.addColorStop(0, t.fill);
  grad.addColorStop(1, t.dark);
  fillRound(ctx, b.x, b.y, b.w, b.h, b.r || 20, grad);
  if (t.border) strokeRound(ctx, b.x, b.y, b.w, b.h, b.r || 20, t.border, 1);
  drawText(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2, {
    size: b.fontSize || 30, color: t.text, align: 'center', baseline: 'middle', bold: true,
  });
}

/* ---------- 命中检测 ---------- */
function hit(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/* ---------- 卡片/气泡 ---------- */
function card(ctx, x, y, w, h, r, opts) {
  const o = opts || {};
  fillRound(ctx, x, y, w, h, r || 20, o.fill || C.glass);
  strokeRound(ctx, x, y, w, h, r || 20, o.border || C.glassBorder, o.lw || 2);
}

/* ---------- 顶部 HUD ---------- */
function drawHud(ctx, score, hearts, maxHearts) {
  const y = layout.topInset + 12;
  // LIVE 标签
  const liveW = 110;
  fillRound(ctx, 24, y, liveW, 44, 22, C.accent);
  ctx.beginPath();
  ctx.arc(42, y + 22, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  drawText(ctx, 'LIVE', 56, y + 11, { size: 22, bold: true, color: '#fff' });
  // 得分
  drawText(ctx, `得分 ${score}`, 150, y + 10, { size: 24, color: C.muted, bold: true });
  // 耐心
  let hx = 750 - 30;
  const hs = 30;
  for (let i = maxHearts - 1; i >= 0; i--) {
    const filled = i < hearts;
    drawText(ctx, filled ? '❤️' : '🤍', hx - hs, y + hs * 0.15, { size: 30 });
    hx -= hs;
  }
  return y + 60; // 返回 HUD 底部
}

/* ---------- 顶部轻提示（toast） ---------- */
function drawToast(ctx, toast, h) {
  if (!toast || toast.until < h) return;
  const t = toast.text;
  const size = 26;
  const padX = 32, padY = 18;
  const w = textWidth(ctx, t, size) + padX * 2;
  const x = (layout.LOGICAL_W - w) / 2;
  const y = layout.topInset + 160;
  fillRound(ctx, x, y, w, 60, 30, 'rgba(0,0,0,0.78)');
  drawText(ctx, t, x + padX, y + padY + 2, { size, color: '#fff', align: 'left' });
}

/* ---------- 场景背景 ---------- */
function drawBg(ctx) {
  const H = layout.LOGICAL_H;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#23234a');
  grad.addColorStop(0.5, '#1a1a2e');
  grad.addColorStop(1, '#14142b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, layout.LOGICAL_W, H);
}

/* ---------- 缓动 / 数学 ---------- */
function clamp(v, a, b) {
  return v < a ? a : (v > b ? b : v);
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function easeOutCubic(t) {
  t = clamp(t, 0, 1);
  const u = 1 - t;
  return 1 - u * u * u;
}
function easeOutBack(t) {
  t = clamp(t, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}
function easeInOutQuad(t) {
  t = clamp(t, 0, 1);
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/* ---------- 阴影卡片 / 渐变 ---------- */
// 圆角矩形 + 柔和投影（内部 save/restore，opts: {blur, color, dy}）
function fillRoundShadow(ctx, x, y, w, h, r, fill, opts) {
  const o = opts || {};
  ctx.save();
  ctx.shadowColor = o.color || 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = o.blur === undefined ? 24 : o.blur;
  ctx.shadowOffsetY = o.dy === undefined ? 8 : o.dy;
  fillRound(ctx, x, y, w, h, r, fill);
  ctx.restore();
}
// 双色渐变圆角填充（vertical=true 纵向，否则横向）
function gradRound(ctx, x, y, w, h, r, c1, c2, vertical) {
  const grad = vertical
    ? ctx.createLinearGradient(x, y, x, y + h)
    : ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  fillRound(ctx, x, y, w, h, r, grad);
}

/* ---------- 发光文字 ---------- */
// opts 同 drawText，外加 glow（发光半径）/ glowColor
function neonText(ctx, text, x, y, opts) {
  const o = opts || {};
  ctx.save();
  ctx.font = fontStr(o.size || 28, o.bold);
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.baseline || 'top';
  ctx.shadowColor = o.glowColor || o.color || C.accent;
  ctx.shadowBlur = o.glow === undefined ? 16 : o.glow;
  ctx.fillStyle = o.color || C.text;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.fillText(text, x, y); // 再叠一层实心，字形更亮
  ctx.restore();
}

/* ---------- 粒子（纯数据入池，不带 ctx 可在 node 测） ---------- */
// opts: {x, y, count, colors[], speed, spread, angle, shape:'rect'|'circle', size, life, gravity}
function spawnBurst(pool, opts) {
  const o = opts || {};
  const count = Math.max(1, o.count || 14);
  const colors = (o.colors && o.colors.length) ? o.colors : [C.gold];
  const speed = o.speed || 340;
  const spread = o.spread === undefined ? Math.PI * 2 : o.spread;
  const base = o.angle === undefined ? -Math.PI / 2 : o.angle;
  const size = o.size || 10;
  const life = o.life || 800;
  const gravity = o.gravity || 0;
  const shape = o.shape === 'circle' ? 'circle' : 'rect';
  const now = Date.now();
  const made = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (i / (count - 1)) - 0.5; // -0.5..0.5 均匀铺开
    const ang = base + t * spread + (Math.random() - 0.5) * (spread / count);
    const sp = speed * (0.6 + Math.random() * 0.7);
    const p = {
      x: o.x || 0,
      y: o.y || 0,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      t0: now,
      life: life * (0.7 + Math.random() * 0.6),
      size: size * (0.6 + Math.random() * 0.8),
      rot: (i * 0.9) % Math.PI,
      spin: 3 + (i % 5),
      color: colors[i % colors.length],
      shape,
      gravity,
    };
    pool.push(p);
    made.push(p);
  }
  return made;
}

// 按 life 进度绘制并就地清除死粒子（t0 来自未来的粒子先跳过，防止时钟漂移误杀）
function drawParticles(ctx, pool, now) {
  if (!pool || !pool.length) return;
  for (let i = pool.length - 1; i >= 0; i--) {
    const p = pool[i];
    const t = (now - p.t0) / p.life;
    if (t >= 1) { pool.splice(i, 1); continue; }
    if (t < 0) continue;
    const s = (now - p.t0) / 1000;
    const x = p.x + p.vx * s;
    const y = p.y + p.vy * s + 0.5 * (p.gravity || 0) * s * s;
    const alpha = t < 0.8 ? 1 : (1 - t) / 0.2;
    const sz = p.size * (1 - t * 0.6);
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.fillStyle = p.color;
    if (p.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.5, sz / 2), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.rot + p.spin * s);
      ctx.fillRect(-sz / 2, -sz / 2 * 0.7, sz, sz * 0.7);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

/* ---------- 飘字（+1 / -1 等） ---------- */
function addFloater(pool, x, y, text, color) {
  const f = { text, x, y, t0: Date.now(), life: 1200, color: color || C.gold };
  pool.push(f);
  return f;
}
function drawFloaters(ctx, pool, now) {
  if (!pool || !pool.length) return;
  for (let i = pool.length - 1; i >= 0; i--) {
    const f = pool[i];
    const t = (now - f.t0) / f.life;
    if (t >= 1) { pool.splice(i, 1); continue; }
    if (t < 0) continue;
    const yy = f.y - easeOutCubic(t) * 72;
    ctx.globalAlpha = clamp(1 - t * t, 0, 1);
    drawText(ctx, f.text, f.x, yy, {
      size: f.size || 30, bold: true, color: f.color, align: 'center', baseline: 'middle',
    });
    ctx.globalAlpha = 1;
  }
}

/* ---------- 弹幕 ---------- */
function createDanmaku(lanes) {
  return { lanes: lanes || 4, items: [] };
}
// opts: {areaH 区域高, speed, lane}；从右侧驶入，未指定 lane 则随机车道
function pushDanmaku(dm, text, now, opts) {
  const o = opts || {};
  const areaH = o.areaH || 200;
  const lane = o.lane !== undefined ? o.lane : Math.floor(Math.random() * dm.lanes);
  const item = {
    text: String(text),
    lane: clamp(lane, 0, dm.lanes - 1),
    x: (layout.LOGICAL_W || 750) + 12,
    w: 0, // 首次绘制时按字体实测
    speed: o.speed || 140,
    size: 24,
    t0: now,
  };
  dm.items.push(item);
  return item;
}
// 右→左滚动，出界清除；半透明底条 + 圆角
function drawDanmaku(ctx, dm, now, areaTop, areaH) {
  if (!dm || !dm.items.length) return;
  const laneH = areaH / dm.lanes;
  for (let i = dm.items.length - 1; i >= 0; i--) {
    const it = dm.items[i];
    const x = it.x - ((now - it.t0) / 1000) * it.speed;
    if (!it.w) {
      ctx.font = fontStr(it.size);
      it.w = ctx.measureText(it.text).width + 36;
    }
    if (x + it.w < -24) { dm.items.splice(i, 1); continue; }
    if (x > (layout.LOGICAL_W || 750) + 24) continue; // 尚未入屏
    const y = areaTop + it.lane * laneH + laneH / 2;
    ctx.globalAlpha = 0.9;
    fillRound(ctx, x - 14, y - 19, it.w, 38, 19, 'rgba(0,0,0,0.35)');
    ctx.globalAlpha = 1;
    drawText(ctx, it.text, x, y, {
      size: it.size, color: '#e6e9ff', baseline: 'middle',
    });
  }
}

/* ---------- 警示红闪（0..1 alpha 的红色边缘渐晕） ---------- */
function drawFlash(ctx, alpha) {
  alpha = clamp(alpha, 0, 1);
  if (alpha <= 0) return;
  const W = layout.LOGICAL_W || 750;
  const H = layout.LOGICAL_H || 1334;
  const r = Math.max(W, H) * 0.78;
  const g = ctx.createRadialGradient(W / 2, H / 2, r * 0.42, W / 2, H / 2, r);
  g.addColorStop(0, 'rgba(233,69,96,0)');
  g.addColorStop(1, `rgba(233,69,96,${(0.55 * alpha).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/* ---------- 屏震抖动（t0<=0 或超时返回 {0,0}） ---------- */
function shakeXY(now, t0, mag, dur) {
  if (!t0 || t0 <= 0) return { dx: 0, dy: 0 };
  const p = (now - t0) / (dur || 400);
  if (p < 0 || p >= 1) return { dx: 0, dy: 0 };
  const m = (mag || 12) * (1 - p) * (1 - p);
  const t = now * 0.045;
  return { dx: Math.sin(t * 1.31) * m, dy: Math.cos(t * 1.73) * m };
}

module.exports = {
  C,
  FONT,
  fontStr,
  roundRectPath,
  fillRound,
  strokeRound,
  drawText,
  textWidth,
  wrapLines,
  drawWrapped,
  drawButton,
  buttonTheme,
  hit,
  card,
  drawHud,
  drawToast,
  drawBg,
  clamp,
  lerp,
  easeOutCubic,
  easeOutBack,
  easeInOutQuad,
  fillRoundShadow,
  gradRound,
  neonText,
  spawnBurst,
  drawParticles,
  addFloater,
  drawFloaters,
  createDanmaku,
  pushDanmaku,
  drawDanmaku,
  drawFlash,
  shakeXY,
};