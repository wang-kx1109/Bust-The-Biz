/* =====================================================================
 * js/core/character.js — 矢量店主角色（v1.0：消灭 emoji 贴纸感）
 * ---------------------------------------------------------------------
 * drawShopkeeper(ctx, cx, cy, s, personaType, mood, now)
 *   头肩主播像：圆角肩身(衣服色) + 脖子 + 圆头(肤色) + 发型(4 种按
 *   personaType 轮换) + 眉(角度随 mood) + 眼(白底黑瞳, 2.8-4s 眨眼
 *   闭眼 120ms) + 嘴(5 种 mood) + 主播耳机(头带/耳罩/麦克杆)。
 *   mood: idle 微笑线 / talk 开口椭圆随 sin(now*0.02) 开合 /
 *         happy 大笑露牙 + 脸颊红晕 / sweat 哆嗦波浪嘴 + 汗珠下滑 /
 *         angry 下撇嘴 + 眉下压
 *   呼吸浮动 cy±4*s、talk 时左右轻摆；全部矢量图元，无 emoji。
 *   规范尺寸：头顶(含丸子)≈-238 ～ 肩底 124，约 362 单位高。
 * ===================================================================== */
const gfx = require('./gfx.js');

const PERSONA_TYPES = [
  'confused', 'stubborn', 'blamer', 'influencer', 'broken',
  'honest', 'arrogant', 'idealist', 'gambler', 'elder',
];

// 每种人格 {cloth 衣服, hair 发色, skin 肤色}
const PERSONA_COLORS = {
  confused:   { cloth: '#4f7fd9', hair: '#2e2a33', skin: '#f6d3b3' },
  stubborn:   { cloth: '#d8574f', hair: '#26222b', skin: '#eec39a' },
  blamer:     { cloth: '#7a5fa8', hair: '#3a2e28', skin: '#f2c9a4' },
  influencer: { cloth: '#ef7fae', hair: '#8a4b2d', skin: '#f8d8bc' },
  broken:     { cloth: '#5f8ea3', hair: '#4a4a55', skin: '#e8bf9e' },
  honest:     { cloth: '#3f9e7c', hair: '#2a2320', skin: '#d9a877' },
  arrogant:   { cloth: '#3d3d5c', hair: '#15151c', skin: '#f0cba8' },
  idealist:   { cloth: '#e0a23c', hair: '#6b3f1d', skin: '#f6d3b3' },
  gambler:    { cloth: '#2f7d5a', hair: '#2a2a30', skin: '#eac09b' },
  elder:      { cloth: '#8c6d4f', hair: '#b8b8c4', skin: '#eec9a2' },
};
const FALLBACK = { cloth: '#5b6ee1', hair: '#33333d', skin: '#f2cfae' };

const LIP = '#9c4f42';      // 嘴线
const MOUTH_DARK = '#6e303c'; // 口腔
const INK = '#2a2a33';      // 瞳/眉/耳机深色

function circle(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/* ---------- 发型（4 种，按 personaType 轮换） ---------- */
// 基础盖顶：沿头顶的扇形，弦收在太阳穴一线
function hairCap(ctx, cy, r, color) {
  ctx.beginPath();
  ctx.arc(0, cy, r, Math.PI * 1.03, Math.PI * 1.97);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawHair(ctx, style, color) {
  if (style === 0) {
    // 平头短发：规整盖顶 + 额前平线
    hairCap(ctx, -124, 84, color);
    gfx.fillRound(ctx, -78, -128, 156, 14, 7, color);
  } else if (style === 1) {
    // 侧分斜刘海：盖顶 + 大片斜向刘海
    hairCap(ctx, -124, 84, color);
    ctx.save();
    ctx.translate(-26, -152);
    ctx.rotate(-0.42);
    ctx.beginPath();
    ctx.ellipse(0, 0, 62, 22, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  } else if (style === 2) {
    // 背头：高发量盖顶 + 头顶隆起 + 两鬓
    hairCap(ctx, -132, 86, color);
    ctx.beginPath();
    ctx.ellipse(0, -198, 62, 24, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    gfx.fillRound(ctx, -80, -146, 14, 40, 7, color);
    gfx.fillRound(ctx, 66, -146, 14, 40, 7, color);
  } else {
    // 丸子头：盖顶 + 头顶发髻
    hairCap(ctx, -124, 84, color);
    circle(ctx, 30, -206, 23, color);
    ctx.beginPath();
    ctx.arc(30, -206, 23, Math.PI * 0.15, Math.PI * 0.85);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

/* ---------- 眉毛（角度随 mood；happy 弯眉用弧线） ---------- */
function drawBrow(ctx, side, mood) {
  const cx = 36 * side; // 眉心 x（左 -36 / 右 +36）
  const y = -146;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (mood === 'happy') {
    // 弯眉：向上拱的小弧
    ctx.moveTo(cx - 15 * side, y + 3);
    ctx.quadraticCurveTo(cx, y - 9, cx + 15 * side, y + 3);
  } else {
    let dyIn = 0, dyOut = 0, lift = 0;
    if (mood === 'angry') { dyIn = 10; lift = 2; }        // 内端下压
    else if (mood === 'sweat') { dyOut = -9; lift = -9; } // 整体上挑
    // 左眉内端在右、右眉内端在左
    ctx.moveTo(cx - 15 * side, y + dyOut + lift);
    ctx.lineTo(cx + 15 * side, y + dyIn + lift);
  }
  ctx.stroke();
}

/* ---------- 眼睛（白底黑瞳 + 眨眼） ---------- */
function drawEye(ctx, side, closed) {
  const x = 33 * side, y = -122;
  if (closed) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 13, y);
    ctx.lineTo(x + 13, y);
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  ctx.ellipse(x, y, 14, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  circle(ctx, x, y + 1, 5.5, INK);
  circle(ctx, x - 1.5, y - 1, 1.8, '#ffffff');
}

/* ---------- 嘴（5 种 mood） ---------- */
function drawMouth(ctx, mood, now) {
  ctx.lineCap = 'round';
  if (mood === 'talk') {
    // 开口椭圆：随 sin(now*0.02) 开合
    const ry = 4 + 10 * Math.abs(Math.sin(now * 0.02));
    ctx.beginPath();
    ctx.ellipse(0, -76, 15, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = MOUTH_DARK;
    ctx.fill();
    return;
  }
  if (mood === 'happy') {
    // 大笑：深口腔 + 上排白牙
    ctx.beginPath();
    ctx.moveTo(-30, -82);
    ctx.quadraticCurveTo(0, -50, 30, -82);
    ctx.quadraticCurveTo(0, -96, -30, -82);
    ctx.closePath();
    ctx.fillStyle = MOUTH_DARK;
    ctx.fill();
    gfx.fillRound(ctx, -23, -84, 46, 13, 6, '#ffffff');
    return;
  }
  if (mood === 'sweat') {
    // 哆嗦波浪线
    ctx.strokeStyle = '#7a6a70';
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const x = -20 + i * 10;
      const y = -76 + Math.sin(now * 0.045 + i * 1.8) * 3.5;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    return;
  }
  if (mood === 'angry') {
    // 下撇
    ctx.strokeStyle = LIP;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-20, -72);
    ctx.quadraticCurveTo(0, -88, 20, -72);
    ctx.stroke();
    return;
  }
  // idle：微笑线
  ctx.strokeStyle = LIP;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-20, -80);
  ctx.quadraticCurveTo(0, -64, 20, -80);
  ctx.stroke();
}

/* ---------- 汗珠（sweat：1-2 滴缓慢下滑） ---------- */
function drawSweat(ctx, now) {
  for (let i = 0; i < 2; i++) {
    const bx = 62 + i * 26, by = -150 + i * 34;
    const drop = ((now * 0.025) + i * 48) % 54;
    const y = by + drop;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.9 - drop / 70);
    circle(ctx, bx, y, 7, '#79c4f2');
    ctx.beginPath();
    ctx.moveTo(bx - 5, y - 4);
    ctx.lineTo(bx + 5, y - 4);
    ctx.lineTo(bx, y - 17);
    ctx.closePath();
    ctx.fillStyle = '#79c4f2';
    ctx.fill();
    circle(ctx, bx - 2, y - 2, 2, 'rgba(255,255,255,0.85)');
    ctx.restore();
  }
}

/* ---------- 主播耳机：头带 + 耳罩 + 麦克杆 ---------- */
function drawHeadset(ctx) {
  // 头带（压在头发上）
  ctx.strokeStyle = INK;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, -124, 96, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  // 两侧耳罩
  gfx.fillRound(ctx, -114, -148, 28, 50, 12, INK);
  gfx.fillRound(ctx, 86, -148, 28, 50, 12, INK);
  // 耳罩上的直播小红点
  circle(ctx, -100, -122, 5, '#e94560');
  // 麦克杆：左耳罩 → 嘴边
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-102, -108);
  ctx.quadraticCurveTo(-80, -84, -42, -78);
  ctx.stroke();
  circle(ctx, -39, -77, 9, INK);
}

function drawShopkeeper(ctx, cx, cy, s, personaType, mood, now) {
  const pal = PERSONA_COLORS[personaType] || FALLBACK;
  const idx = PERSONA_TYPES.indexOf(personaType);
  const style = idx >= 0 ? idx % 4 : (String(personaType).length % 4);
  const m = mood || 'idle';
  const t = now || 0;

  // 呼吸浮动 + talk 时左右轻摆
  const by = Math.sin(t * 0.003) * 4 * s;
  const bx = (m === 'talk') ? Math.sin(t * 0.005) * 3 * s : 0;

  ctx.save();
  ctx.translate(cx + bx, cy + by);
  ctx.scale(s, s);

  // 落地阴影
  ctx.beginPath();
  ctx.ellipse(0, 132, 148, 18, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fill();

  // 肩身（衣服）+ 领口小 V
  gfx.fillRound(ctx, -125, -26, 250, 150, 55, pal.cloth);
  ctx.beginPath();
  ctx.moveTo(-26, -26);
  ctx.lineTo(0, 14);
  ctx.lineTo(26, -26);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fill();

  // 脖子 + 耳朵 + 头
  gfx.fillRound(ctx, -22, -68, 44, 54, 14, pal.skin);
  circle(ctx, -78, -124, 14, pal.skin);
  circle(ctx, 78, -124, 14, pal.skin);
  circle(ctx, 0, -124, 80, pal.skin);

  // 发型
  drawHair(ctx, style, pal.hair);

  // 耳机（带/罩在头发之上）
  drawHeadset(ctx);

  // 眉 + 眼
  drawBrow(ctx, -1, m);
  drawBrow(ctx, 1, m);
  const period = 2800 + (style * 2 + (idx >= 0 ? idx : 0)) % 5 * 250; // 2.8-4s
  const closed = ((t + (idx >= 0 ? idx : 0) * 613) % period) < 120;
  drawEye(ctx, -1, closed);
  drawEye(ctx, 1, closed);

  // 鼻（ subtle ）
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -112);
  ctx.quadraticCurveTo(5, -104, 1, -99);
  ctx.stroke();

  // 嘴
  drawMouth(ctx, m, t);

  // mood 附属：汗珠 / 红晕
  if (m === 'sweat') drawSweat(ctx, t);
  if (m === 'happy') {
    ctx.save();
    ctx.globalAlpha = 0.32;
    circle(ctx, -50, -100, 15, '#ff768e');
    circle(ctx, 50, -100, 15, '#ff768e');
    ctx.restore();
  }

  ctx.restore();
}

module.exports = { drawShopkeeper, PERSONA_COLORS, PERSONA_TYPES };
