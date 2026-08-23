# 项目进度日志

> 维护约定：每次完成里程碑、踩坑、变更方向都追加一条记录（新记录写在最上方）。开发/接手前先读本文件 + `CLAUDE.md`。

## 里程碑

### 2026-08-24 · v0.2 转向「微信小游戏」（Canvas 渲染，2 关全流程）
**背景**：用户注册的 AppID 类型是小游戏（`wx01973db56f70ae3e`），与旧小程序架构不兼容 → 决定整体迁往小游戏。

**交付**：`minigame/` Canvas 版，逻辑/数据/校验 100% 复用，UI 层重写为 7 个场景。

- 架构：逻辑宽 750 坐标系（与关卡坐标 1:1）、场景路由 router、绘图库 gfx、单帧"测量+绘制+命中"同源
- 场景：select / ask / find / link / rescue / result / fail 全流程（含隐藏点、敲锣、红闪、成就、分享）
- 复用：`js/core/state.js`（状态机）+ `js/data/levels.js`（数据）与 miniprogram 互为镜像，sanity deepEqual 防漂移
- 旧 miniprogram/ 保留为遗留存档，不再维护
- 校验：node --check 全过；sanity.js 7 项；sanity-game.js 12 项（含场景接口存在性）

**已知提示**：canvas emoji 在 Windows 开发者工具可能黑白/豆腐块 → 以真机为准。

**待办 / 下一步**
- [ ] 用户真机验证（开发者工具模拟器 + 手机预览扫码），重点：连线对准、隐藏点、emoji 真机显示
- [ ] 关卡扩容 + 店主差异化话术
- [ ] 激励视频广告 / Banner（小游戏投放单元）
- [ ] 音效（wx.createInnerAudioContext，可用 base64 音频数据）

---

### 2026-08-23 · v0.1 MVP：微信小程序版可玩骨架（2 关）
**交付**：`miniprogram/` 原生小程序，7 页全流程 + HUD 组件 + 状态机 + 3 个校验脚本。

- 关卡：奶茶店（3 错）、面包房（4 错，含 1 隐藏错误点，点「收银台」解锁）
- 阶段：选择 → 审问（环视收藏≤3 / 三连问 / 老王电话）→ 找茬（750 坐标→rpx、敲锣动画、数据面板联动）→ 连线（canvas 2d、绿锁/红闪）→ 急救 → 结算 / 失败
- 解锁：`wx.setStorageSync('btb_progress')`，通关奶茶解锁面包；有"解锁全部"调试按钮
- 校验：sanity.js（数据/坐标/引用）、sanity-game.js（状态机冒烟 5 组）、check-templates.js（WXML↔JS 交叉）全部通过

**关键决策**
- 750×750 坐标系与 rpx 天然 1:1，坐标零换算。
- `neighbor.text`(HTML) → `texts`(纯文本)，规避 rich-text 的 CSS 变量问题。
- 结算：`loss = max(0, baseLoss − Σ各环节挽回)`，**耐心值也是挽回项**（全不动但满耐心 → 止损 140 万非 180 万）。
- 导航策略：前向 `redirectTo` / 重开与回选关 `reLaunch` / 各页 `onLoad` 阶段守卫。

**待办 / 下一步**
- [ ] 用户端验证：微信开发者工具导入仓库根目录跑全流程（含手机真机预览）——见 CLAUDE.md 校验命令 + 交付时给出的验证清单
- [ ] 关卡扩容（3-15 关）：火锅店 / 咖啡店 / 快餐店……每关只需向 `miniprogram/data/levels.js` 追加对象 + 跑 sanity
- [ ] 5000 粉丝「网红梦」人设的店主差异化话术（当前 2 关店主文案较平）
- [ ] 广告位（设计文档第六章）：激励视频「勇哥提示卡 / 复活续命 / 双倍积分」+ Banner。需真实 AppID 与微信广告组件
- [ ] 云开发/后端存储（当前纯本地 Storage）
- [ ] 分享裂变（结算页 open-type=share 已可用，`onShareAppMessage` 文案已插值）

---

## 已知问题 / 备忘（方便接手）

- 仓库根 HTML 原型缺 `game.js` 损坏；`miniprogram/data/levels.js` 是最新数据源（根 `levels.js` 需人工同步）。
- 连线页 canvas 依赖 `type="2d"`，基础库需 ≥ 2.9；如遇旧基础库白屏，先升基础库。
- 失败路径唯一入口是 `game.state.failed`；冷启动直接进 fail 会被守卫弹回选关。