/* =====================================================================
 * js/core/fx.js — 跨场景特效管理单例
 * ---------------------------------------------------------------------
 * 集中管理：粒子池 / 飘字池 / 弹幕 / 红闪 / 屏震 / 点赞 hearts。
 * 只依赖 gfx + layout（不得 require router/state，避免循环依赖）。
 *
 * 用法（game.js 已接入，场景工程师直接调事件 API 即可）：
 *   fx.burst(x, y)              答对/敲锣金纸
 *   fx.hearts(x, y)             点赞
 *   fx.sparks(x, y, color)      连线成功
 *   fx.floater(x, y, '+1')      飘字
 *   fx.flash() / fx.shake()     红闪 / 屏震
 *   fx.say('文本')              手动推一条弹幕
 *   fx.setDanmakuPool([...])    设置本关弹幕文案池
 *   fx.clear()                  切关/重开时清空
 * ===================================================================== */
const gfx = require('./gfx.js');
const layout = require('./layout.js');

// 内置通用弹幕池（直播间风味吐槽）
const DEFAULT_POOL = [
  '这租金我看傻了',
  '勇哥稳住，我们能赢',
  '老板这账算得我一愣一愣的',
  '前方高能，血压拉满',
  '这也敢开？梁静茹给的勇气吗',
  '侦探一哥 yyds',
  '满堂红预定',
  '打工人泪目了',
  '这位置白给我都不要',
  '刷个火箭压压惊',
  '又是被数据打脸的一天',
  '老板别嘴硬了哈哈哈',
  '看勇哥破案就是爽',
  '这利润薄得像纸',
  '蹲一个满分通关',
  '求店主心理阴影面积',
  '水友们把保护打在公屏上',
];

const PUSH_INTERVAL = 2200;   // 自动推送基准间隔 ms
const PUSH_JITTER = 600;      // ±600 随机
const FLASH_DUR = 450;        // 红闪时长 ms
const SHAKE_DUR = 450;        // 屏震时长 ms
const DANMAKU_LANES = 4;

const fx = {
  particles: [],
  floaters: [],
  dm: null,          // gfx.createDanmaku 实例（懒创建）
  pool: DEFAULT_POOL.slice(),
  nextPush: 0,       // 下次自动推送时间戳（0 = 未初始化）
  flashT0: -1,
  shakeT0: -1,
  shakeMag: 0,

  /* ---------- 事件 API ---------- */
  // 答对/敲锣：金纸礼花
  burst(x, y, colors, n) {
    gfx.spawnBurst(this.particles, {
      x, y,
      count: n || 22,
      colors: colors || ['#f5c518', '#e94560', '#16c79a', '#ffffff', '#f5a623'],
      speed: 380,
      spread: Math.PI * 2,
      shape: 'rect',
      size: 11,
      life: 950,
      gravity: 620,
    });
  },

  // 点赞：飘起的小心心
  hearts(x, y, n) {
    const count = n || 3;
    for (let i = 0; i < count; i++) {
      const f = gfx.addFloater(
        this.floaters,
        x + (i - (count - 1) / 2) * 36 + (Math.random() - 0.5) * 20,
        y - (i % 3) * 14,
        '❤️',
        '#ff6b9d',
      );
      f.life = 1500;
      f.size = 26;
    }
  },

  // 连线成功：向上溅射的小火花
  sparks(x, y, color) {
    gfx.spawnBurst(this.particles, {
      x, y,
      count: 12,
      colors: [color || '#16c79a', '#ffffff'],
      speed: 260,
      spread: Math.PI * 0.9,
      angle: -Math.PI / 2,
      shape: 'circle',
      size: 8,
      life: 600,
      gravity: 420,
    });
  },

  // 通用飘字（如 '+1'）
  floater(x, y, text, color) {
    gfx.addFloater(this.floaters, x, y, text, color);
  },

  // 警示红闪
  flash() {
    this.flashT0 = Date.now();
  },

  // 屏震（mag 默认 14）
  shake(mag) {
    this.shakeT0 = Date.now();
    this.shakeMag = mag || 14;
  },

  // 手动推一条弹幕（立即从右侧驶入）
  say(text) {
    this._ensureDm();
    gfx.pushDanmaku(this.dm, text, Date.now(), { areaH: this._area().h });
  },

  // 设置本关弹幕文案池（空数组则回退内置通用池）
  setDanmakuPool(lines) {
    this.pool = (lines && lines.length) ? lines.slice() : DEFAULT_POOL.slice();
  },

  // 清空全部特效（切关/重开时由 game.js 调用）
  clear() {
    this.particles.length = 0;
    this.floaters.length = 0;
    if (this.dm) this.dm.items.length = 0;
    this.flashT0 = -1;
    this.shakeT0 = -1;
    this.nextPush = 0;
  },

  /* ---------- 帧驱动 ---------- */
  update(dt, now) {
    // 弹幕自动推送：首次给个短预热，之后 2200ms ± 600
    if (!this.nextPush) this.nextPush = now + 700;
    if (now >= this.nextPush && this.pool.length) {
      const text = this.pool[Math.floor(Math.random() * this.pool.length)];
      this._ensureDm();
      gfx.pushDanmaku(this.dm, text, now, { areaH: this._area().h });
      this.nextPush = now + PUSH_INTERVAL + (Math.random() * 2 - 1) * PUSH_JITTER;
    }
  },

  // 场景渲染后调用：粒子 + 飘字（世界层）
  renderWorld(ctx, now) {
    gfx.drawParticles(ctx, this.particles, now);
    gfx.drawFloaters(ctx, this.floaters, now);
  },

  // 最后调用：弹幕 + 红闪（覆盖层；屏震由 game.js 对主 ctx translate）
  renderOverlay(ctx, now) {
    if (this.dm && this.dm.items.length) {
      const a = this._area();
      gfx.drawDanmaku(ctx, this.dm, now, a.top, a.h);
    }
    if (this.flashT0 > 0) {
      const alpha = 1 - (now - this.flashT0) / FLASH_DUR;
      gfx.drawFlash(ctx, alpha); // alpha<=0 时 drawFlash 自动忽略
      if (alpha <= 0) this.flashT0 = -1;
    }
  },

  // 每帧 setTransform 后由 game.js 取偏移做 translate
  getShake(now) {
    return gfx.shakeXY(now, this.shakeT0, this.shakeMag, SHAKE_DUR);
  },

  /* ---------- 内部 ---------- */
  _ensureDm() {
    if (!this.dm) this.dm = gfx.createDanmaku(DANMAKU_LANES);
  },
  // 弹幕区域：顶部 HUD 下方 → 屏幕 45% 处
  _area() {
    const top = (layout.topInset || 30) + 84;
    const bottom = Math.max(top + 120, (layout.LOGICAL_H || 1334) * 0.45);
    return { top, h: bottom - top };
  },
};

module.exports = fx;
