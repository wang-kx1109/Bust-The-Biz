#!/usr/bin/env node
/* =====================================================================
 * scripts/make-avatar.js — 生成小程序头像（纯 node，无第三方依赖）
 * ---------------------------------------------------------------------
 * 设计：深蓝直播间底色 + 红色放大镜 + 金色"?"（呼应游戏找茬 ❓ 排查点）
 * 输出：docs/avatar.png（144x144 PNG，微信头像要求 jpg/png、建议 ≥144px）
 *
 * 用法：node scripts/make-avatar.js
 * ===================================================================== */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

/* ---------- PNG 编码 ---------- */
function makeCrcTable() {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
}
const CRC_TABLE = makeCrcTable();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeB, data])));
  return Buffer.concat([len, typeB, data, crc]);
}
function encodePng(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- 几何基元（在放大 SS 倍的画布上硬采样，下采样获得抗锯齿） ---------- */
const SS = 4;      // 超采样倍数
const S = 144;     // 输出尺寸
const BIG = S * SS;

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG_TOP = hex('#25254a'), BG_BOT = hex('#13132a');
const LENS = hex('#2c2c55');
const RIM = hex('#e94560');
const GOLD = hex('#f5c518');

// 中心点（放大镜圆心）与半径（SS 单位）
const LX = 68 * SS, LY = 70 * SS;
const R_LENS = 41 * SS, R_RIM = 48 * SS;
const GLYPH_W = 7.5 * SS;

function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / L2;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx - px, qy = ay + t * dy - py;
  return Math.sqrt(qx * qx + qy * qy);
}
function inCircle(px, py, cx, cy, r) {
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}
function inPolyline(px, py, path) {
  for (let i = 0; i < path.length - 1; i++) {
    if (distSeg(px, py, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]) <= GLYPH_W / 2) return true;
  }
  return false;
}

// "?" 字形折线（坐标均 * SS）
const Q_PATH = [
  [71, 41], [84, 45], [89, 57], [85, 67], [75, 73], [73, 82],
].map(p => [p[0] * SS, p[1] * SS]);
// 句点
const DOT = [70, 92];

function shade(px, py) {
  const t = Math.max(0, Math.min(1, py / BIG));
  let r = BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * t;
  let g = BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * t;
  let b = BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * t;

  const dx = px - LX, dy = py - LY, d = Math.sqrt(dx * dx + dy * dy);

  // 1) 镜面（在底图之上）
  if (d <= R_LENS) { r = LENS[0]; g = LENS[1]; b = LENS[2]; }

  // 2) 镜面上方高光弧
  const HIGHLIGHT_R = 30 * SS, HINGE = 5 * SS;
  const hdx = px - LX + 8 * SS, hdy = py - LY - 12 * SS; // 偏向左上
  const hd = Math.sqrt(hdx * hdx + hdy * hdy);
  if (d <= R_LENS && Math.abs(hd - HIGHLIGHT_R) <= HINGE / 2) {
    r = r + (255 - r) * 0.10; g = g + (255 - g) * 0.10; b = b + (255 - b) * 0.10;
  }

  // 3) 金色 "?"（镜面内）
  if (inPolyline(px, py, Q_PATH) || inCircle(px, py, DOT[0] * SS, DOT[1] * SS, 3.4 * SS)) {
    r = GOLD[0]; g = GOLD[1]; b = GOLD[2];
  }

  // 4) 放大镜手柄（金），从右下方探出
  const HW = 6.5 * SS;
  if (distSeg(px, py, 102 * SS, 102 * SS, 114 * SS, 114 * SS) <= HW) {
    r = GOLD[0]; g = GOLD[1]; b = GOLD[2];
  }

  // 5) 红色镜框（最上层，盖住内圈边）
  if (d > R_LENS && d <= R_RIM) { r = RIM[0]; g = RIM[1]; b = RIM[2]; }

  return [r, g, b, 255];
}

/* ---------- 渲染 + 输出 ---------- */
const RGBA = Buffer.alloc(S * S * 4);
const N = SS * SS;
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const c = shade(x * SS + sx + 0.5, y * SS + sy + 0.5);
        r += c[0]; g += c[1]; b += c[2]; a += c[3];
      }
    }
    const o = (y * S + x) * 4;
    RGBA[o] = Math.round(r / N);
    RGBA[o + 1] = Math.round(g / N);
    RGBA[o + 2] = Math.round(b / N);
    RGBA[o + 3] = Math.round(a / N);
  }
}

const out = path.join(__dirname, '../docs/avatar.png');
fs.writeFileSync(out, encodePng(S, S, RGBA));
console.log(`✅ 头像已生成：${out}（${S}x${S} PNG，${fs.statSync(out).size} bytes）`);