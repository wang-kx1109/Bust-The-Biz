/* =====================================================================
 * js/core/router.js — 场景路由（游戏内页面切换，替代小程序 wx.redirectTo）
 * 场景接口：{ onEnter(), update(dt, now), render(ctx), onTap(x, y), onExit() }
 * ===================================================================== */
const _scenes = {};
let _current = null;

module.exports = {
  get current() { return _current; },

  register(name, scene) {
    _scenes[name] = scene;
  },

  switchScene(name) {
    const s = _scenes[name];
    if (!s) return -1;
    if (_current && _current.onExit) _current.onExit();
    _current = s;
    if (_current.onEnter) _current.onEnter();
    return 0;
  },

  dispatchTap(x, y) {
    if (_current && _current.onTap) _current.onTap(x, y);
  },

  update(dt, now) {
    if (_current && _current.update) _current.update(dt, now);
  },

  render(ctx) {
    if (_current && _current.render) _current.render(ctx);
  },
};