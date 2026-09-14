/* =====================================================================
 * js/scenes/photo.js — 拍照取证场景（v1.0 第一人称探店相机）
 * ---------------------------------------------------------------------
 * 找茬阶段 v1.0 大改版：从"点击异常插画 + 敲锣确认"升级为第一人称
 * 探店相机——玩家在 750x750 矢量店铺实景里拖拽环视（带惯性 + 手持
 * 微抖），对准可疑处按快门拍照取证。确认动作完全走状态机拍照接口：
 * photographFault（拍到错误点 = 确认 +1 分）/ takeJunkPhoto（废片）
 * / discardPhoto（点缩略格删片腾格），胶卷上限 photoMax。
 *
 * 相机数学：世界 750x750，缩放 z=1.6，s = k*z（k = S/750）；
 * 可视世界边长 S/s = 750/z ≈ 469（与屏幕尺寸无关的常量），
 * camX/camY ∈ [0, 750 - S/s]。渲染：clip 场景区圆角 → translate(SX,SY)
 * + 手持微抖(±2.5px 双 sin) → scale(s) → translate(-camX,-camY)
 * → room.renderRoom(...) + 世界叠加层（未触发 reveal zone 中心的
 * 金色四角星 sparkle，提示可调查）。
 *
 * 交互分流（参照 select.js 按压模式）：onTap 记起点 → onMove 平移
 * 相机（总位移 >10px 判拖动，取消提示平移）→ onEnd 分流：位移<10px
 * 且时长<250ms 判点按（胶卷删除/提示卡/快门/完成取证/隐藏点 zone），
 * 拖动则记录末速度给惯性（update 里 0.92^(dt/16) 衰减）。
 *
 * 拍照命中策略：当前视口世界矩形外扩 30，候选 = visibleFaults() 中
 * 未找到且锚点在矩形内者，取离视口中心最近的一个；无候选 → 废片。
 * 教学模式：第一章 unfound 且 visible 的错误点传 glowIds 金环微光。
 * ===================================================================== */
const store = require('../core/state.js');
const router = require('../core/router.js');
const gfx = require('../core/gfx.js');
const layout = require('../core/layout.js');
const fx = require('../core/fx.js');
const audio = require('../core/audio.js');
const ads = require('../core/ads.js');
const live = require('../core/live.js');
const room = require('../core/room.js');
const { track } = require('../core/track.js');
const C = gfx.C;

const TAU = Math.PI * 2;
const WORLD = 750;          // 场景世界坐标 750x750
const ZOOM = 1.6;           // 相机放大倍数（取景 ≈ 469 世界单位）
const MARGIN = 30;          // 拍照命中外扩（世界单位）
const FLASH_DUR = 220;      // 闪光灯白闪 ms
const TAP_DIST = 10;        // 点按/拖动分流位移阈值（逻辑 px）
const TAP_MS = 250;         // 点按/拖动分流时长阈值
const PAN_MS = 500;         // 提示相机自动平移时长

function trunc4(t) {
  t = String(t || '');
  return t.length > 4 ? t.slice(0, 4) + '…' : t;
}

module.exports = {
  // 场景区布局（render 里边画边记，交互读同一份 → 命中同源）
  SX: 0, SY: 0, S: 0, k: 1, s: 0,
  visW: WORLD / ZOOM, maxCam: WORLD - WORLD / ZOOM,
  camX: 0, camY: 0,
  // 相机/反馈状态
  live: null,
  toast: null,
  banner: null,          // 隐藏点发现横幅 {text, until}
  evidence: null,        // 证据标注卡 {fault, t0}，1.6s 自动隐
  popFx: null,           // 隐藏点弹跳显现 {id, t0}
  hintFx: null,          // 提示脉冲 {faultId, t0}（3s 内传给 renderRoom）
  panTo: null,           // 提示自动平移 {x0,y0,x1,y1,t0}
  flashT0: -1,
  // 命中 rect（render 记录）
  hintBtn: null, doneBtn: null, shutter: null, thumbs: [],
  // 拖动/惯性状态
  _press: null, _moved: false, _lastX: 0, _lastY: 0,
  _velX: 0, _velY: 0, _flingX: 0, _flingY: 0,
  _shutterT0: -1, _hintBusy: false, _tutorialShown: false,

  onEnter() {
    store.markStage('photo');
    const lv = store.getLevel();
    if (!lv) { router.switchScene('select'); return; }
    fx.setDanmakuPool(lv.interview.danmaku);
    this.live = live.createLive();
    this.toast = null;
    this.banner = null;
    this.evidence = null;
    this.popFx = null;
    this.hintFx = null;
    this.panTo = null;
    this.flashT0 = -1;
    this._shutterT0 = -1;
    this._hintBusy = false;
    this._press = null;
    this._moved = false;
    this._velX = 0; this._velY = 0;
    this._flingX = 0; this._flingY = 0;
    // 相机初始：水平居中，略偏上（先看到招牌/后墙一带）
    this.camX = this.maxCam / 2;
    this.camY = Math.max(0, this.maxCam / 2 - 60);
    if (lv.chapter === 1 && !this._tutorialShown) {
      this._tutorialShown = true;
      this.toast = { text: '👆 拖动画面环视店铺，对准可疑处按快门', until: Date.now() + 3400 };
    }
  },

  update(dt, now) {
    if (this.banner && now > this.banner.until) this.banner = null;
    if (this.toast && now > this.toast.until) this.toast = null;
    // 拖动惯性：0.92^(dt/16) 衰减，触界即停
    if (this._flingX || this._flingY) {
      const step = dt / 16;
      this.camX = gfx.clamp(this.camX + this._flingX * step, 0, this.maxCam);
      this.camY = gfx.clamp(this.camY + this._flingY * step, 0, this.maxCam);
      const d = Math.pow(0.92, dt / 16);
      this._flingX *= d;
      this._flingY *= d;
      if (Math.abs(this._flingX) < 0.02) this._flingX = 0;
      if (Math.abs(this._flingY) < 0.02) this._flingY = 0;
      if (this.camX <= 0 || this.camX >= this.maxCam) this._flingX = 0;
      if (this.camY <= 0 || this.camY >= this.maxCam) this._flingY = 0;
    }
    // 提示自动平移：easeInOutQuad 500ms 插值到目标锚点
    if (this.panTo) {
      const p = (now - this.panTo.t0) / PAN_MS;
      const e = gfx.easeInOutQuad(p);
      this.camX = gfx.lerp(this.panTo.x0, this.panTo.x1, e);
      this.camY = gfx.lerp(this.panTo.y0, this.panTo.y1, e);
      if (p >= 1) this.panTo = null;
    }
    live.updateLive(this.live, dt);
  },

  /* ---------- 交互（onTap 记起点，onEnd 分流点按/拖动） ---------- */
  onTap(x, y) {
    this._press = { x, y, t0: Date.now() };
    this._moved = false;
    this._velX = 0; this._velY = 0;
    this._flingX = 0; this._flingY = 0;
  },

  onMove(x, y) {
    if (!this._press || !this.S) return;
    if (!this._moved) {
      const dx = x - this._press.x, dy = y - this._press.y;
      if (Math.sqrt(dx * dx + dy * dy) <= TAP_DIST) return;
      this._moved = true;
      this.panTo = null;           // 用户接管相机，取消自动平移
      this._lastX = x; this._lastY = y;
      return;
    }
    const dxs = x - this._lastX, dys = y - this._lastY;
    this._lastX = x; this._lastY = y;
    if (!dxs && !dys) return;
    // 手指拖着世界走：cam 反向移动，屏幕 delta / s 换算世界 delta
    this._velX = -dxs / this.s;
    this._velY = -dys / this.s;
    this.camX = gfx.clamp(this.camX + this._velX, 0, this.maxCam);
    this.camY = gfx.clamp(this.camY + this._velY, 0, this.maxCam);
  },

  onEnd(x, y) {
    if (!this._press) return;
    const p = this._press;
    const dx = x - p.x, dy = y - p.y;
    const isTap = !this._moved
      && Math.sqrt(dx * dx + dy * dy) < TAP_DIST
      && Date.now() - p.t0 < TAP_MS;
    if (isTap) {
      this.handleTap(p.x, p.y);
    } else if (this._moved) {
      this._flingX = this._velX;
      this._flingY = this._velY;
    }
    this._press = null;
    this._moved = false;
  },

  handleTap(x, y) {
    const lv = store.getLevel();
    if (!lv) return;
    // 胶卷缩略格：点按删除腾格
    for (let i = 0; i < this.thumbs.length; i++) {
      if (gfx.hit(x, y, this.thumbs[i])) { this.onDiscard(i); return; }
    }
    if (this.hintBtn && gfx.hit(x, y, this.hintBtn)) { this.onHintTap(); return; }
    if (this.shutter) {
      const dx = x - this.shutter.cx, dy = y - this.shutter.cy;
      if (dx * dx + dy * dy <= this.shutter.r * this.shutter.r) { this.onShutter(); return; }
    }
    if (this.doneBtn && gfx.hit(x, y, this.doneBtn)) { this.onDone(); return; }
    if (live.tapLike(this.live, x, y)) return;
    // 场景区点按：相机模式下只用于调查——命中未触发的 reveal zone 矩形
    if (this.s > 0 && x >= this.SX && x <= this.SX + this.S && y >= this.SY && y <= this.SY + this.S) {
      const lx = (x - this.SX) / this.s + this.camX;
      const ly = (y - this.SY) / this.s + this.camY;
      this.onSceneTap(lv, lx, ly);
    }
  },

  onSceneTap(lv, lx, ly) {
    const zones = (lv.findFaults && lv.findFaults.zones) || [];
    for (const z of zones) {
      if (!z.reveal || store.state.revealedZones[z.id]) continue;
      if (lx >= z.x && lx <= z.x + z.w && ly >= z.y && ly <= z.y + z.h) {
        const r = store.tapZone(z.id);
        if (r.revealed) {
          this.banner = { text: r.hint, until: Date.now() + 2400 };
          this.popFx = { id: r.faultId, t0: Date.now() };
          this.toast = { text: '仔细看看这里…', until: Date.now() + 1600 };
        }
        return;
      }
    }
    // 其他点按不处理（相机模式点按只用于调查）
  },

  /* ---------- 快门拍照 ---------- */
  onShutter() {
    const lv = store.getLevel();
    if (!lv || this.s <= 0) return;
    this._shutterT0 = Date.now();
    const found = store.state.foundFlaws;
    const cx = this.camX + this.visW / 2;
    const cy = this.camY + this.visW / 2;
    // 候选：未找到且锚点落在视口矩形（外扩 MARGIN）内的可见错误点
    let best = null, bestD = Infinity;
    for (const f of store.visibleFaults()) {
      if (found.indexOf(f.id) >= 0) continue;
      if (f.x < this.camX - MARGIN || f.x > this.camX + this.visW + MARGIN) continue;
      if (f.y < this.camY - MARGIN || f.y > this.camY + this.visW + MARGIN) continue;
      const d = (f.x - cx) * (f.x - cx) + (f.y - cy) * (f.y - cy);
      if (d < bestD) { bestD = d; best = f; }
    }
    if (best) {
      const r = store.photographFault(best.id);
      if (r.ok) {
        this.flashT0 = Date.now();
        audio.play('bell');
        fx.burst(
          this.SX + (best.x - this.camX) * this.s,
          this.SY + (best.y - this.camY) * this.s,
          [C.gold, '#fff', (lv.findFaults.sceneTheme && lv.findFaults.sceneTheme.accent) || C.accent],
          30,
        );
        this.evidence = { fault: best, t0: Date.now() };
        track('fault_found', { id: best.id });
      } else if (r.already) {
        this.toast = { text: '这条已经拍过了', until: Date.now() + 1400 };
      } else if (r.reason === 'full') {
        this.toast = { text: '胶卷满了，点废片可删除腾格', until: Date.now() + 1800 };
      }
      return;
    }
    // 无候选 → 废片同样占一格胶卷
    const r = store.takeJunkPhoto();
    if (r.ok) {
      this.flashT0 = Date.now();
      audio.play('click');
      this.toast = { text: '拍了张没用的…', until: Date.now() + 1400 };
    } else if (r.reason === 'full') {
      this.toast = { text: '胶卷满了，点废片可删除腾格', until: Date.now() + 1800 };
    }
  },

  onDiscard(i) {
    const r = store.discardPhoto(i);
    if (r.ok) {
      audio.play('click');
      this.toast = { text: '已删除照片，腾出 1 格胶卷', until: Date.now() + 1400 };
    }
  },

  /* ---------- 勇哥提示卡：广告 → useHint → 相机自动平移 ---------- */
  onHintTap() {
    if (this._hintBusy) return;
    this._hintBusy = true;
    ads.show('hint').then((ok) => {
      this._hintBusy = false;
      if (!ok) {
        this.toast = { text: '🎬 看完广告才能获得提示哦', until: Date.now() + 1600 };
        return;
      }
      const r = store.useHint();
      if (!r.ok) {
        this.toast = {
          text: r.reason === 'limit' ? '🃏 本关提示次数用完了' : '没有可提示的了',
          until: Date.now() + 1600,
        };
        return;
      }
      const lv = store.getLevel();
      const f = lv && lv.findFaults.faults.find(x => x.id === r.faultId);
      this.hintFx = { faultId: r.faultId, t0: Date.now() };
      if (f) {
        // 相机自动平移：把锚点送到视口中央（clamp 到合法范围）
        const tx = gfx.clamp(f.x - this.visW / 2, 0, this.maxCam);
        const ty = gfx.clamp(f.y - this.visW / 2, 0, this.maxCam);
        this.panTo = { x0: this.camX, y0: this.camY, x1: tx, y1: ty, t0: Date.now() };
      }
    }).catch(() => { this._hintBusy = false; });
  },

  /* ---------- 完成取证：全屏转场进连线 ---------- */
  onDone() {
    const lv = store.getLevel();
    if (!lv || fx._trans) return;
    track('photo_done', {
      found: store.state.foundFlaws.length,
      total: lv.findFaults.faults.length,
    });
    fx.transition(() => router.switchScene('link'));
  },

  /* ---------- 渲染 ---------- */
  render(ctx) {
    const now = Date.now();
    gfx.drawBg(ctx);
    gfx.drawHud(ctx, store.state.score, store.state.patience, store.state.patienceMax);

    const lv = store.getLevel();
    if (!lv) return;
    const ff = lv.findFaults;
    const accent = (ff.sceneTheme && ff.sceneTheme.accent) || C.accent;
    const view = store.getStateView();
    const photos = view.photos;
    const photoMax = view.photoMax;

    // 头部（下移一行避让 live 观众 pill）：标题 + 副标 + 胶卷数
    const top = layout.topInset + 84 + 56;
    gfx.drawText(ctx, '📷 探店实拍', 40, top, { size: 32, bold: true });
    gfx.drawText(ctx, '拖动环视 · 对准可疑处按快门', 40, top + 42, { size: 22, color: C.muted });
    const fw = 150;
    gfx.fillRound(ctx, 750 - 40 - fw, top + 2, fw, 48, 24, 'rgba(255,255,255,0.07)');
    gfx.strokeRound(ctx, 750 - 40 - fw, top + 2, fw, 48, 24, C.glassBorder, 1);
    gfx.drawText(ctx, `🎞 ${photos.length}/${photoMax}`, 750 - 40 - fw / 2, top + 27, {
      size: 24, bold: true, align: 'center', baseline: 'middle',
    });

    // 方形场景区（沿用 find 自适应算法，底部预留 ~230 给横幅/胶卷条/底栏）
    const sceneTop = top + 84;
    const footH = 230;
    const availH = layout.LOGICAL_H - layout.bottomInset - sceneTop - footH;
    const S = Math.min(WORLD, Math.max(300, availH));
    const SX = Math.max(24, (750 - S) / 2);
    const SY = sceneTop;
    this.SX = SX; this.SY = SY; this.S = S;
    this.k = S / WORLD;
    this.s = this.k * ZOOM;
    this.visW = S / this.s;               // == WORLD / ZOOM（常量）
    this.maxCam = WORLD - this.visW;
    this.camX = gfx.clamp(this.camX, 0, this.maxCam);
    this.camY = gfx.clamp(this.camY, 0, this.maxCam);

    gfx.fillRound(ctx, SX, SY, S, S, 20, C.sceneBg);
    gfx.strokeRound(ctx, SX, SY, S, S, 20, accent, 2);

    // 相机取景：clip → 屏幕锚定 + 手持微抖 → 世界缩放 → 相机平移
    const jx = Math.sin(now * 0.0013) * 2.5;
    const jy = Math.sin(now * 0.0017 + 1.7) * 2.5;
    ctx.save();
    gfx.roundRectPath(ctx, SX, SY, S, S, 20);
    ctx.clip();
    ctx.translate(SX + jx, SY + jy);
    ctx.scale(this.s, this.s);
    ctx.translate(-this.camX, -this.camY);

    const foundIds = store.state.foundFlaws;
    let glowIds;
    if (lv.chapter === 1) {
      // 教学模式：未找到且可见的错误点金环微光
      glowIds = store.visibleFaults().filter(f => foundIds.indexOf(f.id) < 0).map(f => f.id);
    } else {
      glowIds = store.clueGlowFaults();
    }
    room.renderRoom(ctx, lv, now, {
      foundIds,
      glowIds,
      hintedId: this.hintFx && now - this.hintFx.t0 < 3000 ? this.hintFx.faultId : null,
      hintedT0: this.hintFx ? this.hintFx.t0 : now,
      revealedPop: this.popFx && now - this.popFx.t0 < 600 ? { id: this.popFx.id, t0: this.popFx.t0 } : null,
    });
    this.drawSparkles(ctx, lv, now);
    ctx.restore();

    // 取景框 chrome + 闪光灯（屏幕空间）
    this.drawChrome(ctx, SX, SY, S, now);
    if (this.flashT0 > 0 && now - this.flashT0 < FLASH_DUR) {
      const a = 1 - (now - this.flashT0) / FLASH_DUR;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(SX, SY, S, S);
      ctx.restore();
    }

    // 底部固定布局：隐藏点横幅 → 胶卷条 → 底栏（提示/快门/完成）
    const barY = layout.LOGICAL_H - layout.bottomInset - 98;
    const stripY = barY - 104;
    if (this.banner) {
      const bw = 640, bh = 52;
      const by = Math.min(SY + S + 10, stripY - bh - 10);
      gfx.fillRound(ctx, (750 - bw) / 2, by, bw, bh, 14, 'rgba(245,165,35,0.16)');
      gfx.strokeRound(ctx, (750 - bw) / 2, by, bw, bh, 14, 'rgba(245,165,35,0.5)', 1);
      const size = gfx.textWidth(ctx, this.banner.text, 24, true) > bw - 48 ? 20 : 24;
      gfx.drawText(ctx, this.banner.text, 375, by + bh / 2, {
        size, align: 'center', baseline: 'middle', color: C.amber, bold: true,
      });
    }
    this.drawFilm(ctx, photos, photoMax, lv, stripY);
    this.drawBar(ctx, lv, accent, now, barY);
    if (this.evidence) this.drawEvidence(ctx, now, stripY);

    gfx.drawToast(ctx, this.toast, now);
    live.drawLive(ctx, this.live, now);
  },

  // 世界叠加层：未触发且带 reveal 的 zone 中心画金色四角星（旋转 + 呼吸）
  drawSparkles(ctx, lv, now) {
    const zones = (lv.findFaults && lv.findFaults.zones) || [];
    let idx = 0;
    for (const z of zones) {
      if (!z.reveal || store.state.revealedZones[z.id]) continue;
      const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
      const r = 20 * (0.85 + 0.15 * Math.sin(now * 0.004 + idx * 1.9));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(now * 0.0012 + idx);
      ctx.shadowColor = C.gold;
      ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(245,197,24,0.92)';
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * TAU;
        const rad = k % 2 === 0 ? r : r * 0.4;
        const px = Math.cos(ang) * rad, py = Math.sin(ang) * rad;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      idx++;
    }
  },

  // 取景框 chrome：四角白色 L 括号、REC 红点闪、中心淡十字、四角内暗角
  drawChrome(ctx, SX, SY, S, now) {
    ctx.save();
    const off = 16, L = 34;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const corners = [
      [SX + off, SY + off, 1, 1], [SX + S - off, SY + off, -1, 1],
      [SX + off, SY + S - off, 1, -1], [SX + S - off, SY + S - off, -1, -1],
    ];
    for (const [cx, cy, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx + L * sx, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + L * sy);
      ctx.stroke();
    }
    // REC 红点闪（右上）
    const recA = Math.sin(now * 0.006) > 0 ? 1 : 0.25;
    ctx.globalAlpha = recA;
    ctx.beginPath();
    ctx.arc(SX + S - 96, SY + 30, 7, 0, TAU);
    ctx.fillStyle = '#ff4d4d';
    ctx.fill();
    gfx.drawText(ctx, 'REC', SX + S - 78, SY + 30, {
      size: 22, bold: true, color: '#ff6b6b', baseline: 'middle',
    });
    ctx.globalAlpha = 1;
    // 中心淡十字
    const ccx = SX + S / 2, ccy = SY + S / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ccx - 22, ccy); ctx.lineTo(ccx - 8, ccy);
    ctx.moveTo(ccx + 8, ccy); ctx.lineTo(ccx + 22, ccy);
    ctx.moveTo(ccx, ccy - 22); ctx.lineTo(ccx, ccy - 8);
    ctx.moveTo(ccx, ccy + 8); ctx.lineTo(ccx, ccy + 22);
    ctx.stroke();
    // 四角内暗角
    const v = 110;
    const grads = [
      ctx.createLinearGradient(SX, SY, SX + v, SY + v),
      ctx.createLinearGradient(SX + S, SY, SX + S - v, SY + v),
      ctx.createLinearGradient(SX, SY + S, SX + v, SY + S - v),
      ctx.createLinearGradient(SX + S, SY + S, SX + S - v, SY + S - v),
    ];
    const rects = [
      [SX, SY, v, v], [SX + S - v, SY, v, v],
      [SX, SY + S - v, v, v], [SX + S - v, SY + S - v, v, v],
    ];
    for (let i = 0; i < 4; i++) {
      grads[i].addColorStop(0, 'rgba(0,0,0,0.32)');
      grads[i].addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grads[i];
      ctx.fillRect(rects[i][0], rects[i][1], rects[i][2], rects[i][3]);
    }
    ctx.restore();
  },

  // 胶卷条：横排 84px 缩略格；证据=绿框+标题截字，废片=灰框+标题；点按删除腾格
  drawFilm(ctx, photos, photoMax, lv, stripY) {
    this.thumbs = [];
    const cell = 84, gap = 12;
    const n = Math.max(photoMax, 1);
    const totalW = n * cell + (n - 1) * gap;
    let x = (750 - totalW) / 2;
    const faultById = {};
    for (const f of lv.findFaults.faults) faultById[f.id] = f;
    for (let i = 0; i < photoMax; i++) {
      const p = photos[i];
      if (!p) {
        gfx.strokeRound(ctx, x, stripY, cell, cell, 12, 'rgba(255,255,255,0.10)', 1.5);
        x += cell + gap;
        continue;
      }
      const rect = { x, y: stripY, w: cell, h: cell };
      this.thumbs.push(rect);
      const isJunk = !p.faultId;
      const f = isJunk ? null : faultById[p.faultId];
      gfx.fillRound(ctx, x, stripY, cell, cell, 12,
        isJunk ? 'rgba(255,255,255,0.05)' : 'rgba(22,199,154,0.10)');
      gfx.strokeRound(ctx, x, stripY, cell, cell, 12,
        isJunk ? 'rgba(154,160,184,0.55)' : C.green, isJunk ? 2 : 3);
      if (isJunk) {
        gfx.drawText(ctx, '🗑', x + cell / 2, stripY + 32, {
          size: 26, align: 'center', baseline: 'middle', color: C.muted,
        });
        gfx.drawText(ctx, trunc4(p.title || '店内随拍'), x + cell / 2, stripY + 62, {
          size: 16, align: 'center', baseline: 'middle', color: C.muted,
        });
      } else {
        gfx.drawText(ctx, '📸', x + cell / 2, stripY + 32, {
          size: 26, align: 'center', baseline: 'middle',
        });
        gfx.drawText(ctx, trunc4((f && f.title) || '证据'), x + cell / 2, stripY + 62, {
          size: 16, align: 'center', baseline: 'middle', color: '#c9f5e6', bold: true,
        });
      }
      gfx.drawText(ctx, '✕', x + cell - 12, stripY + 12, {
        size: 18, align: 'center', baseline: 'middle', color: 'rgba(255,255,255,0.55)',
      });
      x += cell + gap;
    }
  },

  // 底栏：左提示卡 · 中央快门大圆钮（白圈+accent 内圈，按下缩小回弹）· 右完成取证
  drawBar(ctx, lv, accent, now, barY) {
    const remain = Math.max(0, store.MAX_HINTS - store.state.hintsUsed);
    this.hintBtn = {
      x: 24, y: barY, w: 190, h: 84,
      label: `🃏 提示×${remain}`, theme: 'ghost', enabled: true, fontSize: 26,
    };
    gfx.drawButton(ctx, this.hintBtn);

    const found = store.state.foundFlaws.length;
    const total = lv.findFaults.faults.length;
    this.doneBtn = {
      x: 440, y: barY, w: 200, h: 84,
      label: `完成取证 ${found}/${total} →`, theme: 'primary', enabled: true, fontSize: 24,
    };
    gfx.drawButton(ctx, this.doneBtn);

    const cx = 375, cy = barY + 40, r = 56;
    this.shutter = { cx, cy, r };
    let scale = 1;
    if (this._shutterT0 > 0 && now - this._shutterT0 < 260) {
      scale = 1 - 0.16 * (1 - gfx.easeOutCubic((now - this._shutterT0) / 260));
    }
    const rr = r * scale;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, TAU);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.stroke();
    const ir = rr - 12;
    const g = ctx.createLinearGradient(cx - ir, cy - ir, cx + ir, cy + ir);
    g.addColorStop(0, accent);
    g.addColorStop(1, C.accentDark);
    ctx.beginPath();
    ctx.arc(cx, cy, ir, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, ir * 0.34, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.restore();
  },

  // 证据标注卡：从底部滑入（fault title + 实测 data · 正常 panelNormal），1.6s 自动隐
  drawEvidence(ctx, now, stripY) {
    const e = this.evidence;
    const age = now - e.t0;
    if (age > 1600) { this.evidence = null; return; }
    const f = e.fault;
    const w = 640, h = 116;
    const x = (750 - w) / 2;
    const yBase = stripY - h - 12;
    const slide = (1 - gfx.easeOutCubic(Math.min(1, age / 260))) * 80;
    const fade = age > 1300 ? Math.max(0, 1 - (age - 1300) / 300) : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    const y = yBase + slide;
    gfx.fillRoundShadow(ctx, x, y, w, h, 18, 'rgba(16,16,34,0.92)', { blur: 20, dy: 6 });
    gfx.strokeRound(ctx, x, y, w, h, 18, 'rgba(245,197,24,0.55)', 2);
    gfx.drawText(ctx, f.title, x + 28, y + 20, { size: 30, bold: true });
    gfx.drawText(ctx, `实测 ${f.data} · 正常 ${f.panelNormal}`, x + 28, y + 66, {
      size: 24, color: C.muted,
    });
    gfx.drawText(ctx, '📸 证据固定！', x + w - 28, y + 20, {
      size: 26, bold: true, color: C.gold, align: 'right',
    });
    ctx.restore();
  },
};
