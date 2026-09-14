/* =====================================================================
 * minigame/game.js — 小游戏入口
 * ---------------------------------------------------------------------
 * 职责：
 *  1. 创建主屏 canvas + 2d context
 *  2. 计算渲染布局（虚拟逻辑宽 750，与关卡数据 rpx 坐标 1:1），
 *     jsbridge 未就绪时兜底默认布局 + 渐进式多轮重试校准
 *  3. 注册 8 个场景到 router
 *  4. 触屏分发（wx.onTouchStart/Move/End → tap/move/end）
 *  5. requestAnimationFrame 主循环：update + render + fx/ads 收尾
 *
 * 注意：本文件是小游戏入口，不要使用 DOM/WXML。
 * ===================================================================== */
const layout = require('./js/core/layout.js');
const router = require('./js/core/router.js');
const store = require('./js/core/state.js');
const fx = require('./js/core/fx.js');
const ads = require('./js/core/ads.js');

// ---------- 主屏 canvas + ctx ----------
const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');

// ---------- 逻辑布局（750 刻度） ----------
const LOGICAL_W = 750;
let sys = null;
let W = 375, H = 667, dpr = 2;

// 启动早期 jsbridge 可能未就绪：读取失败用安全默认值，稍后再校准
function applyLayout(s) {
  sys = s;
  if (!s) return;
  W = s.windowWidth || W;
  H = s.windowHeight || H;
  dpr = s.pixelRatio || dpr;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  layout.W = W;
  layout.H = H;
  layout.LOGICAL_W = LOGICAL_W;
  layout.LOGICAL_H = Math.round((750 * H) / W);
  layout.SCALE = canvas.width / LOGICAL_W;
  layout.topInset = Math.round(((s.statusBarHeight || 24) * LOGICAL_W) / W);
  layout.bottomInset = Math.round(Math.max(0, (H - (s.safeArea ? s.safeArea.bottom : H)) * LOGICAL_W / W));
}

try {
  applyLayout(wx.getSystemInfoSync());
} catch (e) {
  applyLayout(null); // 兜底默认布局，桥就绪后校准
}
// 兜底默认值也先写进 layout（applyLayout(null) 会跳过），这里给最小值
if (!sys) {
  layout.W = W; layout.H = H; layout.LOGICAL_W = LOGICAL_W;
  layout.LOGICAL_H = Math.round((750 * H) / W);
  layout.SCALE = dpr; // 占位，随后校准
  layout.topInset = 30; layout.bottomInset = 20;
}

// jsbridge 就绪后校准真实屏幕：渐进式多轮重试（Windows 版工具桥接初始化偏慢，
// 单发 300ms 可能仍未就绪），任一轮成功即停，全部失败则沿用兜底默认布局
(function calibrateLayout() {
  const RETRIES = [300, 1000, 2500, 5000];
  let i = 0;
  function attempt() {
    if (i >= RETRIES.length || sys) return;
    try {
      applyLayout(wx.getSystemInfoSync()); // 成功即停（applyLayout 会置 sys）
    } catch (e) { /* 桥未就绪，下一轮再试 */ }
    i++;
    if (!sys && i < RETRIES.length) setTimeout(attempt, RETRIES[i] - RETRIES[i - 1]);
  }
  setTimeout(attempt, RETRIES[0]);
})();

// ---------- 场景注册 ----------
const scenes = [
  ['select', require('./js/scenes/select.js')],
  ['ask', require('./js/scenes/ask.js')],
  ['find', require('./js/scenes/find.js')],
  ['link', require('./js/scenes/link.js')],
  ['rescue', require('./js/scenes/rescue.js')],
  ['result', require('./js/scenes/result.js')],
  ['fail', require('./js/scenes/fail.js')],
  ['collection', require('./js/scenes/collection.js')],
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
wx.onTouchMove((e) => {
  const t = e.touches[0];
  if (!t) return;
  const p = touchXY(t);
  router.dispatchMove(p.x, p.y);
});
wx.onTouchEnd((e) => {
  const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
  if (!t) return;
  const p = touchXY(t);
  router.dispatchEnd(p.x, p.y);
});

// ---------- 主循环 ----------
let lastTs = 0;
function frame(ts) {
  const now = ts || Date.now();
  const dt = Math.min(50, now - (lastTs || now));
  lastTs = now;

  ctx.setTransform(layout.SCALE, 0, 0, layout.SCALE, 0, 0);
  ctx.clearRect(0, 0, layout.LOGICAL_W, layout.LOGICAL_H);
  // 屏震：按 fx 提供的偏移对主 ctx 做 translate
  const sh = fx.getShake(now);
  if (sh.dx || sh.dy) ctx.translate(sh.dx, sh.dy);

  router.update(dt, now);
  fx.update(dt, now);
  router.render(ctx);
  fx.renderWorld(ctx, now);   // 场景渲染后：粒子 + 飘字
  fx.renderOverlay(ctx, now); // 最上层：弹幕 + 红闪
  ads.render(ctx, now);       // 广告遮罩（模拟模式）

  requestAnimationFrame(frame);
}

// ---------- 启动 ----------
store.loadProgress();
fx.clear(); // 特效清零后再进选关
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