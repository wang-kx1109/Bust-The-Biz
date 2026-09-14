/* =====================================================================
 * js/core/live.js — 直播间氛围组件：实时观众数 + 点赞按钮
 * ---------------------------------------------------------------------
 * 用法：
 *   const live = require('./live.js');
 *   this.live = live.createLive();          // ask/photo 场景 onEnter
 *   live.updateLive(this.live, dt);         // 场景 update()
 *   live.drawLive(ctx, this.live, now);     // 场景 render()（画在 HUD 下方）
 *   // onTap 里：
 *   if (live.tapLike(this.live, x, y)) return; // 命中点赞钮会自发 fx.hearts
 * ---------------------------------------------------------------------
 * 只依赖 gfx / layout / fx，不 require state/router（任何场景可用）。
 * ===================================================================== */
const gfx = require('./gfx.js');
const layout = require('./layout.js');

// 观众数随时间微涨（直播感），每 ~900ms 随机游走一次
function createLive(base) {
  return {
    viewers: base || 800 + Math.floor(Math.random() * 1200),
    likes: 0,
    likeRect: null,   // drawLive 时每帧重建（命中同源）
    _tick: 0,
    _heartT0: -1,     // 点赞按下时的心形弹跳
  };
}

function updateLive(s, dt) {
  if (!s) return;
  s._tick += dt;
  if (s._tick > 900) {
    s._tick = 0;
    s.viewers = Math.max(50, s.viewers + Math.floor(Math.random() * 21) - 8);
  }
}

// 矢量爱心（避免依赖 emoji 字体）
function heartPath(ctx, cx, cy, size) {
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.4, cy - s * 0.2, cx - s * 0.7, cy - s * 1.2, cx, cy - s * 0.45);
  ctx.bezierCurveTo(cx + s * 0.7, cy - s * 1.2, cx + s * 1.4, cy - s * 0.2, cx, cy + s * 0.9);
  ctx.closePath();
}

function drawLive(ctx, s, now) {
  if (!s) return;
  const top = layout.topInset + 84;

  // 观众数 pill（HUD 下方左侧）
  const label = '👀 ' + s.viewers;
  const w = Math.max(132, gfx.textWidth(ctx, label, 22, true) + 44);
  gfx.fillRoundShadow(ctx, 24, top, w, 42, 21, 'rgba(0,0,0,0.38)', { blur: 8, color: 'rgba(0,0,0,0.3)', dy: 2 });
  gfx.drawText(ctx, label, 24 + w / 2, top + 21, { size: 22, bold: true, color: '#fff', align: 'center', baseline: 'middle' });

  // 点赞按钮（右下角，浮层圆形）
  const r = 52;
  const cx = 750 - 40 - r;
  const cy = layout.LOGICAL_H - layout.bottomInset - 40 - r;
  s.likeRect = { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
  const press = s._heartT0 > 0 && now - s._heartT0 < 220 ? 1 - (now - s._heartT0) / 220 : 0;
  const rr = r * (1 - press * 0.18);

  const grad = ctx.createLinearGradient(cx - rr, cy - rr, cx + rr, cy + rr);
  grad.addColorStop(0, '#ff6b81');
  grad.addColorStop(1, gfx.C.accent);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rr, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(233,69,96,0.55)';
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, rr, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 2;
  ctx.stroke();

  heartPath(ctx, cx, cy - 4 + press * 6, 44);
  ctx.fillStyle = '#fff';
  ctx.fill();

  if (s.likes > 0) {
    gfx.drawText(ctx, String(s.likes), cx, cy + rr + 22, {
      size: 22, bold: true, color: '#ff9fb0', align: 'center', baseline: 'middle',
    });
  }
}

// 命中返回 true（已自发 fx.hearts 三连）；未命中返回 false
function tapLike(s, x, y) {
  if (!s || !s.likeRect) return false;
  const r = s.likeRect;
  const dx = x - (r.x + r.w / 2), dy = y - (r.y + r.h / 2);
  if (dx * dx + dy * dy > (r.w / 2 + 14) * (r.w / 2 + 14)) return false;
  s.likes++;
  s._heartT0 = Date.now();
  const fx = require('./fx.js'); // 延迟 require 避免环
  fx.hearts(r.x + r.w / 2, r.y, 6);
  return true;
}

module.exports = { createLive, updateLive, drawLive, tapLike };
