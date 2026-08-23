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
};