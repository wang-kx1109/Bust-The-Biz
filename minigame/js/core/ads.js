/* =====================================================================
 * js/core/ads.js — 激励视频广告封装
 * ---------------------------------------------------------------------
 * const ok = await ads.show('rescue');  // true = 看完发奖励
 *
 * 策略：
 *  - wx.createRewardedVideoAd 可用 → 单例占位 adUnitId 'adunit-btb-reward'
 *    onClose(res) resolve(!!res.isEnded)；show() 失败或 onError → 模拟降级
 *  - 不可用 / 报错 → 开发模拟模式：_sim 由 render(ctx, now) 每帧绘制
 *    全屏遮罩"🎬 广告播放中（开发模拟）…剩余 Xs"，到时 resolve(true)
 *  - 并发防护：已 active 的 show() 复用同一 Promise
 *  - 每次调用 track('ad_watch', {scene})
 *
 * game.js 主循环已在每帧末尾调用 ads.render(ctx, now)，此处无需场景操心。
 * ===================================================================== */
const gfx = require('./gfx.js');
const layout = require('./layout.js');
const { track } = require('./track.js');

const AD_UNIT = 'adunit-btb-reward';
const BANNER_UNIT = 'adunit-btb-banner';
const SIM_DUR = 2500; // 模拟广告时长 ms

let _ad = null;        // 真实激励视频单例
let _sim = null;       // {t0, durMs, done}
let _pending = null;   // 并发复用的 Promise
let _resolve = null;   // 当前真实广告 onClose 的 resolve
let _banner = null;    // Banner 广告位：null=未尝试 false=不可用 object=已创建

function _startSim(done) {
  _sim = { t0: Date.now(), durMs: SIM_DUR, done };
}

function _ensureAd() {
  if (_ad) return _ad;
  _ad = wx.createRewardedVideoAd({ adUnitId: AD_UNIT });
  _ad.onClose((res) => {
    const r = _resolve;
    _resolve = null;
    if (r) r(!!(res && res.isEnded));
  });
  _ad.onError(() => {
    _ad = null;
    const r = _resolve;
    _resolve = null;
    if (r && !_sim) _startSim(r); // 真实广告出错 → 模拟降级
  });
  return _ad;
}

function show(scene) {
  track('ad_watch', { scene: scene || 'unknown' });
  if (_pending) return _pending; // 并发防护：复用同一 Promise

  _pending = new Promise((resolve) => {
    const done = (ok) => {
      _pending = null;
      resolve(!!ok);
    };

    if (typeof wx !== 'undefined' && typeof wx.createRewardedVideoAd === 'function') {
      try {
        const ad = _ensureAd();
        _resolve = done;
        const p = ad.show();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            _resolve = null;
            if (!_sim) _startSim(done); // 拉取失败 → 模拟降级
          });
        }
        return;
      } catch (e) { /* 落模拟 */ }
    }
    _startSim(done);
  });
  return _pending;
}

// 主循环每帧调用：模拟模式画全屏遮罩，到时 resolve(true)
function render(ctx, now) {
  if (!_sim || !ctx) return;
  const remain = _sim.durMs - (now - _sim.t0);
  if (remain <= 0) {
    const done = _sim.done;
    _sim = null;
    done(true);
    return;
  }
  const W = layout.LOGICAL_W || 750;
  const H = layout.LOGICAL_H || 1334;
  ctx.fillStyle = 'rgba(0,0,0,0.94)';
  ctx.fillRect(0, 0, W, H);
  gfx.drawText(ctx, '🎬 广告播放中（开发模拟）…', W / 2, H * 0.4, {
    size: 34, bold: true, color: '#ffffff', align: 'center', baseline: 'middle',
  });
  gfx.drawText(ctx, `剩余 ${Math.ceil(remain / 1000)}s`, W / 2, H * 0.4 + 48, {
    size: 26, color: gfx.C.muted, align: 'center', baseline: 'middle',
  });
  // 进度条
  const bw = 320, bh = 12, bx = (W - bw) / 2, by = H * 0.4 + 96;
  const p = 1 - remain / _sim.durMs;
  gfx.fillRound(ctx, bx, by, bw, bh, bh / 2, 'rgba(255,255,255,0.15)');
  gfx.fillRound(ctx, bx, by, Math.max(bh, bw * p), bh, bh / 2, gfx.C.accent);
}

// 当前是否有进行中的广告（真实加载中或模拟播放中）
function isActive() {
  return !!_pending;
}

// Banner 广告位占位（选关页底部）：需要替换为真实广告单元 ID 才会展示，
// 当前任何失败（无 SDK / 单元 ID 无效）都静默容错，不影响游戏。
function showBanner() {
  if (_banner !== null) return; // 整个生命周期只尝试创建一次
  _banner = false;
  if (typeof wx === 'undefined' || typeof wx.createBannerAd !== 'function') return;
  try {
    const sys = (typeof wx.getSystemInfoSync === 'function' && wx.getSystemInfoSync()) || {};
    const w = sys.windowWidth || 375;
    const h = sys.windowHeight || 667;
    const banner = wx.createBannerAd({
      adUnitId: BANNER_UNIT,
      style: { left: 0, top: h - 72, width: w },
    });
    banner.onError(() => { _banner = false; try { banner.hide(); } catch (e) {} });
    const p = banner.show();
    if (p && typeof p.catch === 'function') p.catch(() => { _banner = false; });
    _banner = banner;
  } catch (e) { _banner = false; }
}

module.exports = { show, render, isActive, showBanner, AD_UNIT, BANNER_UNIT };
