/* =====================================================================
 * js/scenes/find.js — 找茬场景（v0.4 真实场景建模 · 无标记找茬版）
 * ---------------------------------------------------------------------
 * 场景容器用缩放系数 k 把 750x750 坐标映射到屏幕区域：
 *   ctx.translate(SX,SY) + ctx.scale(k,k) 绘制 → 内部直接用关卡原坐标。
 *   命中测试：lx = (x - SX)/k, ly = (y - SY)/k 后交给 core/room.js（同源）。
 *
 * v0.4 变更：
 *  - 场景区渲染整体交给 room.renderRoom()：房间骨架（墙/透视地板/光影）
 *    + 家具陈设 + 错误点=场景内可见异常插画，不再画 zones 色块/❓标记
 *  - 交互改 room.hitTestRoom()：fault → 确认弹窗；inspect（隐藏点 zone）
 *    → banner + 异常弹跳显现；item（普通家具）→ 一句 flavor 吐槽；
 *    null → 「这里看起来没问题」
 *  - 敲锣确认时 fx.burst 砸在异常锚点的屏幕位置
 *  - 保留：HUD / 头部文案 / 提示卡广告 / 线索金色高亮 / 数据面板 / 敲锣动画
 * ===================================================================== */
const store = require('../core/state.js');
const router = require('../core/router.js');
const gfx = require('../core/gfx.js');
const layout = require('../core/layout.js');
const fx = require('../core/fx.js');
const audio = require('../core/audio.js');
const ads = require('../core/ads.js');
const room = require('../core/room.js');
const { track } = require('../core/track.js');
const C = gfx.C;

module.exports = {
  SX: 0, SY: 0, k: 1, sceneW: 0, sceneH: 0,
  modal: null,        // {id,title,desc,data,panelNormal}
  modalBtns: null,
  banner: null,
  toast: null,
  hintBtn: null,
  continueBtn: null,
  bellT0: -1,
  popId: '', popT0: -1,   // 隐藏点异常弹跳显现
  hintFx: null,           // {faultId, t0} 提示脉冲
  _hintBusy: false,
  _lastFound: null,       // {id, t0} 数据面板新增行滑入/高亮
  _tutorialShown: false,  // 第 1 关一次性教学 toast

  onEnter() {
    store.markStage('find');
    const lv = store.getLevel();
    if (!lv) { router.switchScene('select'); return; }
    fx.setDanmakuPool(lv.interview.danmaku);
    this.modal = null;
    this.banner = null;
    this.toast = null;
    this.bellT0 = -1;
    this.popId = '';
    this.popT0 = -1;
    this.hintFx = null;
    this._hintBusy = false;
    this._lastFound = null;
    if (lv.id === 'milk-tea' && !this._tutorialShown) {
      this._tutorialShown = true;
      this.toast = { text: '👆 直接点击画面里可疑的东西，比如那堆催租单', until: Date.now() + 3400 };
    } else if (store.clueGlowFaults().length > 0) {
      this.toast = { text: '📸 你收藏的线索在这家店有发现！', until: Date.now() + 2200 };
    }
  },
  update(dt, now) {
    if (this.banner && now > this.banner.until) this.banner = null;
    if (this.toast && now > this.toast.until) this.toast = null;
  },

  /* ---------- 交互 ---------- */
  onTap(x, y) {
    if (this.modal) {
      const { ynBtn, confirmBtn } = this.modalBtns || {};
      if (ynBtn && gfx.hit(x, y, ynBtn)) { this.modal = null; return; }
      if (confirmBtn && gfx.hit(x, y, confirmBtn)) { this.onModalConfirm(); return; }
      return; // 弹窗打开时吞掉其余点击
    }
    if (this.hintBtn && gfx.hit(x, y, this.hintBtn)) { this.onHintTap(); return; }
    if (x >= this.SX && x <= this.SX + this.sceneW && y >= this.SY && y <= this.SY + this.sceneH) {
      const lx = (x - this.SX) / this.k;
      const ly = (y - this.SY) / this.k;
      this.onSceneTap(lx, ly);
      return;
    }
    if (this.continueBtn && gfx.hit(x, y, this.continueBtn)) { this.onContinue(); }
  },

  // 场景区内点击：无标记找茬（fault / inspect / item / null 四分流）
  onSceneTap(lx, ly) {
    const lv = store.getLevel();
    if (!lv) return;
    const hit = room.hitTestRoom(lv, lx, ly);
    if (!hit) {
      this.toast = { text: '这里看起来没问题', until: Date.now() + 1200 };
      return;
    }
    if (hit.kind === 'fault') { this.onFaultTap(hit.id); return; }
    if (hit.kind === 'inspect') {
      const r = store.tapZone(hit.zoneId);
      if (r.revealed) {
        this.banner = { text: r.hint, until: Date.now() + 2400 };
        this.popId = r.faultId;
        this.popT0 = Date.now();
        this.toast = { text: '仔细看看这里…', until: Date.now() + 1600 };
      } else {
        this.toast = { text: '这里已经仔细看过了', until: Date.now() + 1200 };
      }
      return;
    }
    if (hit.kind === 'item') {
      this.toast = { text: room.itemFlavor(hit.itemType), until: Date.now() + 1200 };
    }
  },

  onFaultTap(id) {
    if (store.state.foundFlaws.indexOf(id) >= 0) return; // 已确证，不再弹窗
    const ft = store.getLevel().findFaults.faults.find(x => x.id === id);
    if (!ft) return;
    audio.play('click');
    this.modal = { id: ft.id, title: ft.title, desc: ft.desc, data: ft.data, panelNormal: ft.panelNormal };
  },

  onModalConfirm() {
    const fault = this.modal;
    if (!fault) return;
    const lv = store.getLevel();
    const r = store.confirmFlaw(fault.id);
    this.modal = null;
    if (r.already) return;
    audio.play('bell');
    // 敲锣金纸砸在异常锚点的屏幕位置
    const f = lv && lv.findFaults.faults.find(x => x.id === fault.id);
    if (f) fx.burst(this.SX + f.x * this.k, this.SY + f.y * this.k, [C.gold, '#fff', C.accent], 36);
    else fx.burst(375, this.SY + this.sceneH / 2, [C.gold, '#fff', C.accent], 36);
    this.bellT0 = Date.now();
    this._lastFound = { id: fault.id, t0: Date.now() };
    track('fault_found', { id: fault.id });
  },

  onContinue() {
    router.switchScene('link');
  },

  /* ---------- 勇哥提示卡 ---------- */
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
      this.hintFx = { faultId: r.faultId, t0: Date.now() };
      const f = store.getLevel().findFaults.faults.find(x => x.id === r.faultId);
      if (f) {
        const dx = f.x < 250 ? '左侧' : (f.x > 500 ? '右侧' : '中间');
        const dy = f.y < 250 ? '上方' : (f.y > 500 ? '下方' : '中部');
        this.toast = { text: `🃏 勇哥提示：留意店铺${dy}${dx}一带`, until: Date.now() + 2800 };
      }
    }).catch(() => { this._hintBusy = false; });
  },

  /* ---------- 渲染 ---------- */
  render(ctx) {
    gfx.drawBg(ctx);
    const now = Date.now();
    gfx.drawHud(ctx, store.state.score, store.state.patience, store.state.patienceMax);

    const lv = store.getLevel();
    if (!lv) return;
    const theme = lv.findFaults.sceneTheme || {};
    const accent = theme.accent || C.accent;
    const foundCount = store.state.foundFlaws.length;
    const totalCount = lv.findFaults.faults.length;

    // 头部：标题 + 已确证进度 + 勇哥提示卡
    const top = layout.topInset + 84 + 8;
    gfx.drawText(ctx, '🔍 找出店里的致命问题', 40, top, { size: 32, bold: true });
    gfx.drawText(ctx, `点击画面中可疑的地方 · 已确证 ${foundCount}/${totalCount}`, 40, top + 42, {
      size: 22, color: C.muted,
    });
    const remain = Math.max(0, store.MAX_HINTS - store.state.hintsUsed);
    this.hintBtn = { x: 750 - 40 - 170, y: top - 4, w: 170, h: 56, label: `🃏 提示×${remain}`, theme: 'ghost', enabled: true };
    gfx.drawButton(ctx, this.hintBtn);

    // 场景容器尺寸（给面板和底部按钮留足空间）
    const sceneTop = top + 84;
    const footH = 150;
    const panelReserve = 60 + totalCount * 58;
    const availH = layout.LOGICAL_H - layout.bottomInset - sceneTop - footH - panelReserve;
    const sceneH = Math.min(750, Math.max(300, availH));
    const sceneW = sceneH;
    const edge = Math.max(24, (750 - sceneW) / 2);
    this.SX = edge; this.SY = sceneTop; this.sceneW = sceneW; this.sceneH = sceneH;
    this.k = sceneW / 750;

    gfx.fillRound(ctx, this.SX, this.SY, sceneW, sceneH, 20, C.sceneBg);
    gfx.strokeRound(ctx, this.SX, this.SY, sceneW, sceneH, 20, accent, 2);

    ctx.save();
    ctx.translate(this.SX, this.SY);
    ctx.scale(this.k, this.k);
    ctx.beginPath();
    ctx.rect(2, 2, 746, 746);
    ctx.clip();

    // 真实店铺内景（骨架 + 家具 + 异常插画 + 光影），zones 不再画色块
    room.renderRoom(ctx, lv, now, {
      foundIds: store.state.foundFlaws,
      glowIds: store.clueGlowFaults(),
      hintedId: this.hintFx && now - this.hintFx.t0 < 3000 ? this.hintFx.faultId : null,
      hintedT0: this.hintFx ? this.hintFx.t0 : now,
      revealedPop: this.popId && now - this.popT0 < 600 ? { id: this.popId, t0: this.popT0 } : null,
    });

    // 敲锣动画
    if (now - this.bellT0 < 900 && this.bellT0 > 0) {
      const p = (now - this.bellT0) / 900;
      const ease = Math.sin(p * Math.PI) * (1 - p * 0.3);
      ctx.save();
      ctx.translate(375, 375);
      ctx.rotate(Math.sin(p * Math.PI * 3) * 0.2);
      gfx.drawText(ctx, '🔔', 0, 0, { size: 140 + ease * 80, align: 'center', baseline: 'middle' });
      ctx.restore();
    }

    ctx.restore();

    // 隐藏点发现横幅
    if (this.banner) {
      const bw = 640, bh = 56;
      gfx.fillRound(ctx, (750 - bw) / 2, this.SY + sceneH + 16, bw, bh, 14, 'rgba(245,165,35,0.16)');
      gfx.strokeRound(ctx, (750 - bw) / 2, this.SY + sceneH + 16, bw, bh, 14, 'rgba(245,165,35,0.5)', 1);
      gfx.drawText(ctx, this.banner.text, 375, this.SY + sceneH + 16 + 28, {
        size: 24, align: 'center', baseline: 'middle', color: C.amber, bold: true,
      });
    }

    // 数据面板（已确证，实测 vs 正常 + 新增行滑入/高亮）
    const foundFaults = store.state.foundFlaws
      .map(id => lv.findFaults.faults.find(x => x.id === id))
      .filter(Boolean);
    if (foundFaults.length > 0) {
      const py = this.SY + sceneH + (this.banner ? 84 : 16);
      const ph = 46 + foundFaults.length * 58;
      gfx.fillRound(ctx, 24, py, 702, ph, 18, 'rgba(255,255,255,0.06)');
      gfx.strokeRound(ctx, 24, py, 702, ph, 18, C.glassBorder, 1);
      gfx.drawText(ctx, `📊 数据面板 · 已确证 ${foundFaults.length}/${totalCount}`, 40, py + 12, {
        size: 22, color: C.muted,
      });
      let ry = py + 48;
      for (const ft of foundFaults) {
        let slide = 0, hl = 0;
        if (this._lastFound && this._lastFound.id === ft.id) {
          const e = now - this._lastFound.t0;
          slide = (1 - gfx.easeOutCubic(Math.min(1, e / 300))) * 60;
          hl = e < 300 ? 1 - e / 300 : 0;
        }
        if (hl > 0) {
          gfx.fillRound(ctx, 36, ry - 6, 678, 52, 10, `rgba(245,197,24,${(0.25 * hl).toFixed(3)})`);
        }
        gfx.drawText(ctx, ft.panelLabel, 48 + slide, ry, { size: 24, color: C.muted });
        gfx.drawText(ctx, ft.data, 320 + slide, ry, { size: 30, bold: true, color: C.accent });
        gfx.drawText(ctx, `正常 ${ft.panelNormal}`, 620 + slide, ry, { size: 24, color: C.green, align: 'right' });
        ry += 58;
      }
    }

    // 底部继续
    const btnY = layout.LOGICAL_H - layout.bottomInset - 96;
    this.continueBtn = { x: 24, y: btnY, w: 702, h: 90, label: '进入连线阶段 →', theme: 'primary', enabled: true };
    gfx.drawText(ctx, '漏掉的错误不会计入发现分，会影响止损金额哦', 375, btnY - 34, {
      size: 20, color: 'rgba(154,160,184,0.7)', align: 'center',
    });
    gfx.drawButton(ctx, this.continueBtn);

    if (this.modal) this.renderModal(ctx);
    gfx.drawToast(ctx, this.toast, now);
  },

  renderModal(ctx) {
    const m = this.modal;
    const w = 660, x = (750 - w) / 2, h = 430, y = (layout.LOGICAL_H - h) / 2;
    ctx.fillStyle = C.overlay;
    ctx.fillRect(0, 0, 750, layout.LOGICAL_H);
    gfx.fillRound(ctx, x, y, w, h, 24, C.modalBg);
    gfx.strokeRound(ctx, x, y, w, h, 24, C.glassBorder, 2);
    gfx.drawText(ctx, m.title, x + 40, y + 40, { size: 34, bold: true });
    gfx.drawWrapped(ctx, m.desc, x + 40, y + 96, w - 80, 46, { size: 28 });
    gfx.fillRound(ctx, x + 40, y + 96 + 96, w - 80, 56, 12, 'rgba(233,69,96,0.12)');
    gfx.drawText(ctx, `实测 ${m.data} · 正常 ${m.panelNormal}`, x + 40, y + 96 + 100 + 14, {
      size: 24, color: C.lossText, baseline: 'middle',
    });
    const ynBtn = { x: x + 40, y: y + h - 96, w: (w - 110) / 2, h: 80, label: '再想想', theme: 'ghost', enabled: true };
    const confirmBtn = { x: x + 40 + (w - 110) / 2 + 30, y: y + h - 96, w: (w - 110) / 2, h: 80, label: '🔔 确是问题，敲锣！', theme: 'primary', enabled: true };
    this.modalBtns = { ynBtn, confirmBtn };
    gfx.drawButton(ctx, ynBtn);
    gfx.drawButton(ctx, confirmBtn);
  },
};
