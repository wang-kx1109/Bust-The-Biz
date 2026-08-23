/* =====================================================================
 * minigame/game.js — 小游戏入口
 * ---------------------------------------------------------------------
 * 职责：
 *  1. 创建主屏 canvas + 2d context
 *  2. 计算渲染布局（虚拟逻辑宽 750，与关卡数据 rpx 坐标 1:1）
 *  3. 注册 7 个场景到 router
 *  4. 触屏分发（wx.onTouchStart）
 *  5. requestAnimationFrame 主循环：update + render
 *
 * 注意：本文件是小游戏入口，不要使用 DOM/WXML。
 * ===================================================================== */
const layout = require('./js/core/layout.js');
const router = require('./js/core/router.js');
const store = require('./js/core/state.js');

// ---------- 主屏 canvas + ctx ----------
const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');
const sys = wx.getSystemInfoSync();
const dpr = sys.pixelRatio || 1;
const W = sys.windowWidth;
const H = sys.windowHeight;

canvas.width = Math.round(W * dpr);
canvas.height = Math.round(H * dpr);

// ---------- 逻辑布局（750 刻度） ----------
const LOGICAL_W = 750;
const LOGICAL_H = Math.round((750 * H) / W);
const SCALE = canvas.width / LOGICAL_W;
const topInset = Math.round(((sys.statusBarHeight || 24) * LOGICAL_W) / W);
const bottomInset = Math.round(Math.max(0, (H - (sys.safeArea ? sys.safeArea.bottom : H)) * LOGICAL_W / W));

layout.W = W;
layout.H = H;
layout.LOGICAL_W = LOGICAL_W;
layout.LOGICAL_H = LOGICAL_H;
layout.SCALE = SCALE;
layout.topInset = topInset;
layout.bottomInset = bottomInset;

// ---------- 场景注册 ----------
const scenes = [
  ['select', require('./js/scenes/select.js')],
  ['ask', require('./js/scenes/ask.js')],
  ['find', require('./js/scenes/find.js')],
  ['link', require('./js/scenes/link.js')],
  ['rescue', require('./js/scenes/rescue.js')],
  ['result', require('./js/scenes/result.js')],
  ['fail', require('./js/scenes/fail.js')],
];
scenes.forEach(([name, scene]) => router.register(name, scene));

// ---------- 触屏分发（clientX/Y 为 CSS 像素 → 逻辑坐标） ----------
function touchXY(t) {
  return { x: (t.clientX * LOGICAL_W) / W, y: (t.clientY * LOGICAL_W) / W };
}
wx.onTouchStart((e) => {
  const t = e.touches[0];
  if (!t) return;
  const p = touchXY(t);
  router.dispatchTap(p.x, p.y);
});

// ---------- 主循环 ----------
let lastTs = 0;
function frame(ts) {
  const now = ts || Date.now();
  const dt = Math.min(50, now - (lastTs || now));
  lastTs = now;

  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

  router.update(dt, now);
  router.render(ctx);

  requestAnimationFrame(frame);
}

// ---------- 启动 ----------
store.loadProgress();
router.switchScene('select');
requestAnimationFrame(frame);

// 分享（客户端菜单转发）
try {
  wx.onShareAppMessage(() => {
    const r = store.computeResult();
    return {
      title: r && r.shareText ? r.shareText : '《餐饮大侦探》· 创业避坑互动诊断小游戏',
      query: 'level=' + (store.state.levelId || ''),
    };
  });
} catch (e) { /* 旧基础库忽略 */ }