/* =====================================================================
 * js/core/audio.js — 音效播放（wx.createInnerAudioContext 懒创建封装）
 * ---------------------------------------------------------------------
 * 用法：audio.play('bell')；audio.setEnabled(false) 关闭（持久化 btb_audio）。
 * name ∈ bell | correct | wrong | heart | click | fanfare
 * 全部 try/catch 包裹：无 wx 环境或任何异常时静默 no-op。
 * 音源由 scripts/make-sounds.js 合成到 minigame/assets/sounds/。
 * ===================================================================== */
const BASE = 'assets/sounds/';
const NAMES = ['bell', 'correct', 'wrong', 'heart', 'click', 'fanfare'];
const STORAGE_KEY = 'btb_audio';

let enabled = true;
const cache = {}; // name -> InnerAudioContext

function storage() {
  return typeof wx !== 'undefined' ? wx : null;
}

// 启动时读一次持久化开关（node 下自动跳过）
(function loadEnabled() {
  const s = storage();
  if (!s) return;
  try {
    const v = s.getStorageSync(STORAGE_KEY);
    if (v === false || v === 0 || v === '0' || v === 'false') enabled = false;
  } catch (e) { /* 忽略 */ }
})();

function setEnabled(b) {
  enabled = !!b;
  const s = storage();
  if (!s) return;
  try {
    s.setStorageSync(STORAGE_KEY, enabled);
  } catch (e) { /* 忽略 */ }
}

function isEnabled() {
  return enabled;
}

function play(name) {
  if (!enabled) return;
  if (NAMES.indexOf(name) < 0) return;
  const s = storage();
  if (!s || typeof s.createInnerAudioContext !== 'function') return;
  try {
    let ctx = cache[name];
    if (!ctx) {
      ctx = s.createInnerAudioContext();
      try { ctx.obeyMuteSwitch = false; } catch (e) { /* 旧基础库忽略 */ }
      cache[name] = ctx;
    }
    ctx.src = BASE + name + '.wav';
    ctx.play();
  } catch (e) { /* 静默 no-op */ }
}

module.exports = { play, setEnabled, isEnabled, NAMES, STORAGE_KEY };
