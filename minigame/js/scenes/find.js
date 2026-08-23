/* =====================================================================
 * js/scenes/find.js — 找茬场景
 * 场景容器用一个缩放系数 k 把 750x750 坐标映射到屏幕区域：
 *   ctx.translate(SX,SY) + ctx.scale(k,k) 绘制 → 内部直接用关卡原坐标。
 *   命中测试：lx = (x - SX)/k, ly = (y - SY)/k 后与 750 坐标比对。
 * ===================================================================== */
const store = require('../core/state.js');
const router = require('../core/router.js');
const gfx = require('../core/gfx.js');
const layout = require('../core/layout.js');
const C = gfx.C;

module.exports = {
  SX: 0, SY: 0, k: 1,
  modal: null,        // {id,title,desc,data,panelNormal}
  banner: null,       // {text, until}
  toast: null,
  bellT0: -1,         // 敲锣动画起点
  popId: '', popT0: -1,

  onEnter() {
    store.markStage('find');
    if (!store.getLevel()) { router.switchScene('select'); return; }
    this.modal = null;
    this.banner = null;
    this.bellT0 = -1;
    this.popId = '';
    this.popT0 = -1;
  },
  update(dt, now) {
    if (this.banner && now > this.banner.until) this.banner = null;
    if (this.toast && now > this.toast.until) this.toast = null;
  },

  /* ---------- 交互 ---------- */
  onTap(x, y) {
    // 弹窗优先（打开时吞掉其余点击）
    if (this.modal) {
      const { ynBtn, confirmBtn } = this.modalBtns || {};
      if (ynBtn && gfx.hit(x, y, ynBtn)) { this.modal = null; return; }
      if (confirmBtn && gfx.hit(x, y, confirmBtn)) { this.onModalConfirm(); return; }
      return; // 弹窗打开时吞掉其余点击
    }
    // 场景内部
    if (x >= this.SX && x <= this.SX + this.sceneW && y >= this.SY && y <= this.SY + this.sceneH) {
      const lx = (x - this.SX) / this.k;
      const ly = (y - this.SY) / this.k;
      // 优先错误点标记
      for (const f of store.visibleFaults()) {
        const dx = lx - f.x, dy = ly - f.y;
        if (dx * dx + dy * dy <= 34 * 34) { this.onFaultTap(f.id); return; }
      }
      // 区域
      const z = store.getLevel().findFaults.zones.find(zone =>
        lx >= zone.x && lx <= zone.x + zone.w && ly >= zone.y && ly <= zone.y + zone.h);
      if (z) { this.onZoneTap(z.id); }
      return;
    }
    if (this.continueBtn && gfx.hit(x, y, this.continueBtn)) { this.onContinue(); }
  },

  onZoneTap(zoneId) {
    const r = store.tapZone(zoneId);
    if (!r.revealed) {
      this.toast = { text: '这里好像没什么异常', until: Date.now() + 1200 };
      return;
    }
    this.banner = { text: r.hint, until: Date.now() + 2400 };
    this.popId = r.faultId;
    this.popT0 = Date.now();
  },

  onFaultTap(id) {
    if (store.state.foundFlaws.indexOf(id) >= 0) return;
    const ft = store.getLevel().findFaults.faults.find(x => x.id === id);
    if (!ft) return;
    this.modal = { id: ft.id, title: ft.title, desc: ft.desc, data: ft.data, panelNormal: ft.panelNormal };
  },

  onModalConfirm() {
    const fault = this.modal;
    if (!fault) return;
    const r = store.confirmFlaw(fault.id);
    this.modal = null;
    if (r.already) return;
    this.bellT0 = Date.now();
  },

  onContinue() {
    router.switchScene('link');
  },

  /* ---------- 渲染 ---------- */
  render(ctx) {
    gfx.drawBg(ctx);
    const now = Date.now();
    gfx.drawHud(ctx, store.state.score, store.state.patience, 5);

    // 头部
    const lv = store.getLevel();
    if (!lv) return;
    const top = layout.topInset + 84 + 8;
    gfx.drawText(ctx, `🔍 找茬 · ${lv.title}`, 375, top, { size: 32, bold: true, align: 'center' });
    gfx.drawText(ctx, '点击店铺区域检查，红色 ❓ 是可疑错误点', 375, top + 42, {
      size: 22, color: C.muted, align: 'center',
    });

    // 场景容器尺寸（给面板和底部按钮留足空间）
    const sceneTop = top + 84;
    const footH = 150; // 底部按钮区
    const panelReserve = 60 + store.getLevel().findFaults.faults.length * 58; // 面板最大高度
    const availH = layout.LOGICAL_H - layout.bottomInset - sceneTop - footH - panelReserve;
    const sceneH = Math.min(750, Math.max(300, availH));
    const sceneW = sceneH; // 正方形
    const edge = Math.max(24, (750 - sceneW) / 2);
    this.SX = edge; this.SY = sceneTop; this.sceneW = sceneW; this.sceneH = sceneH;
    this.k = sceneW / 750;

    // 场景底
    gfx.fillRound(ctx, this.SX, this.SY, sceneW, sceneH, 20, C.sceneBg);
    gfx.strokeRound(ctx, this.SX, this.SY, sceneW, sceneH, 20, C.glassBorder, 2);

    ctx.save();
    ctx.translate(this.SX, this.SY);
    ctx.scale(this.k, this.k);

    // zones
    for (const z of lv.findFaults.zones) {
      gfx.fillRound(ctx, z.x, z.y, z.w, z.h, 14, z.bg || '#33335f');
      gfx.drawText(ctx, z.icon, z.x + z.w / 2, z.y + z.h / 2 - (z.label ? 24 : 0), {
        size: Math.min(58, z.h * 0.3), align: 'center', baseline: 'middle',
      });
      if (z.label) {
        gfx.drawText(ctx, z.label, z.x + z.w / 2, z.y + z.h / 2 + 18, {
          size: Math.min(22, z.h * 0.22), align: 'center', color: C.muted,
        });
      }
    }

    // 错误点标记
    const found = store.state.foundFlaws;
    for (const f of store.visibleFaults()) {
      const isFound = found.indexOf(f.id) >= 0;
      const isPop = this.popId === f.id && now - this.popT0 < 500;
      const pulse = isFound ? 1 : 1 + Math.sin(now * 0.006) * 0.05;
      const r = 30 * pulse + (isPop ? (1 - (now - this.popT0) / 500) * 16 : 0);
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isFound ? C.green : C.accent;
      ctx.fill();
      if (!isFound) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, r + 6 + Math.sin(now * 0.006) * 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(233,69,96,0.5)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      gfx.drawText(ctx, isFound ? '✅' : '?', f.x, f.y, {
        size: 30, align: 'center', baseline: 'middle', color: '#fff', bold: true,
      });
    }

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

    // 数据面板（已找到）
    const foundFaults = store.state.foundFlaws
      .map(id => lv.findFaults.faults.find(x => x.id === id))
      .filter(Boolean);
    if (foundFaults.length > 0) {
      const py = this.SY + sceneH + (this.banner ? 84 : 16);
      const ph = 46 + foundFaults.length * 58;
      gfx.fillRound(ctx, 24, py, 702, ph, 18, 'rgba(255,255,255,0.06)');
      gfx.strokeRound(ctx, 24, py, 702, ph, 18, C.glassBorder, 1);
      gfx.drawText(ctx, `📊 数据面板 · 已确证 ${foundFaults.length}/${lv.findFaults.faults.length}`, 40, py + 12, {
        size: 22, color: C.muted,
      });
      let ry = py + 48;
      for (const ft of foundFaults) {
        gfx.drawText(ctx, ft.panelLabel, 48, ry, { size: 24, color: C.muted });
        gfx.drawText(ctx, ft.data, 320, ry, { size: 30, bold: true, color: C.accent });
        gfx.drawText(ctx, `正常 ${ft.panelNormal}`, 620, ry, { size: 24, color: C.green, align: 'right' });
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

    // 弹窗
    if (this.modal) this.renderModal(ctx);
    gfx.drawToast(ctx, this.toast, Date.now());
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