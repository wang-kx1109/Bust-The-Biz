/* =====================================================================
 * js/core/layout.js — 渲染布局（由 game.js 启动时填充）
 * 虚拟逻辑宽 = 750（与关卡数据 rpx 坐标 1:1），高度按屏幕比例缩放
 * ===================================================================== */
module.exports = {
  W: 0,            // 屏幕 CSS 宽（windowWidth）
  H: 0,            // 屏幕 CSS 高（windowHeight）
  LOGICAL_W: 750,
  LOGICAL_H: 0,
  SCALE: 1,        // canvas.width / LOGICAL_W
  topInset: 0,     // 状态栏高度（逻辑单位），HUD 用它避让
  bottomInset: 0,  // 底部安全区（逻辑单位）
};