# Bust-The-Biz · 餐饮大侦探

模拟「创业避坑直播间」的互动诊断游戏：玩家扮演侦探主播，连麦审问店主 → 找茬 → 连线 → 急救 → 出诊断报告（止损金额 + 成就称号）。

## 仓库构成

| 路径 | 说明 |
| :--- | :--- |
| `minigame/js/scenes/` | **微信小游戏场景（当前开发重心）**，Canvas 2D 渲染 |
| `minigame/game.js` / `game.json` | 小游戏入口 + 配置 |
| `miniprogram/` | ⚠️ **遗留存档**（旧小程序架构，WXML/WXSS，已不维护） |
| `scripts/` | node 一致性校验 |
| `index.html` / `levels.js` | GitHub Pages 原型。⚠️ 因缺 `game.js` 已失效，不维护 |
| `readme.md` | 游戏设计文档（需求/数值/商业化） |
| `<餐饮大侦探>关卡设计文档.md` | 详细关卡设计 |
| `docs/PROGRESS.md` | 进度日志 —— **干任何事前先读这里** |
| `docs/微信小游戏开发指南.md` | **开发体验指南**（环境/导入/真机/排错/协作，给同伴开发者） |
| `docs/avatar.png` | 小程序/小游戏头像（`node scripts/make-avatar.js` 可再生成） |
| `project.config.json` | `compileType: "game"`、`appid: wx01973db56f70ae3e`（小游戏） |

## 校验命令（仓库根目录执行）

```bash
node scripts/sanity.js          # 双数据源一致性 / 数据完整性 / 坐标 / 隐藏点 / 满分公式
node scripts/sanity-game.js     # 状态机全流程冒烟（require minigame 版状态机）+ 场景接口存在性
node scripts/check-templates.js # 仅对遗留 miniprogram 的 WXML 交叉校验（新开发不涉及）
node --check <任意 .js>         # JS 语法
```

改动任何 `minigame/ utils/ pages/ data/` 后都应跑一遍上述脚本再提交。

## 小游戏架构速览

```
minigame/
├── game.js                  # 入口：主canvas + 主循环(requestAnimationFrame) + 触屏分发 + 分享
├── game.json                # 竖屏小游戏配置
└── js/
    ├── core/
    │   ├── state.js         # 状态机（结构同步自旧 utils/game.js，wx 隔离，可 node 测）
    │   ├── router.js        # 场景路由 switchScene / dispatchTap / render
    │   ├── gfx.js           # 绘图库：圆角/文字换行/按钮/HUD/气泡/toast
    │   └── layout.js        # 布局（逻辑宽 750，与关卡坐标 1:1）
    ├── data/levels.js       # 关卡数据（与 miniprogram/data/levels.js 互为镜像）
    └── scenes/              # 7 个场景：select/ask/find/link/rescue/result/fail
```

**渲染与交互约定**
- **逻辑坐标系宽 = 750**，与关卡数据 rpx 坐标 1:1；`layout.SCALE` 缩放绘制。触屏 `wx.onTouchStart` 换算逻辑坐标后派发 `scene.onTap(x, y)`。
- 场景接口：`{ onEnter(), update(dt,now), render(ctx), onTap(x,y), onExit() }`；切换用 `router.switchScene('xxx')`。
- **命中即视觉同源**：每个场景 render() 里边测量边绘制边记录按钮/卡片 rect 到 `this.buttons`/`this.optRects` 等，onTap 用最新 rect 做矩形命中——视觉与点击永不漂移。**不要再拆出独立的布局计算函数**。
- 所有逻辑走 `js/core/state.js` 纯函数；`store.markStage('xxx')` 记录阶段。
- **Canvas 里 emoji 在 Windows 开发者工具可能黑白/豆腐块，真机正常**——属已知现象，别当成 bug。

**得分与止损**（`js/core/state.js :: computeResult`）
```
score   = 答对 + 找茬数 + 连线对数 + 急救对(1)
maxScore = 问数 + 错误数 + 对数 + 1
recovered = 找茬×find + 连线×link + 急救×rescue + 答对×ask + 剩余耐心×patience
loss = max(0, baseLoss − recovered)     // 耐心也是一种"止损贡献"！
成就称号按 score 命中 result.achievements 档位
```

**数据源注意**：关卡数据有两份镜像拷贝（`miniprogram/data/levels.js` 与 `minigame/js/data/levels.js`），改动必须同步（sanity.js 会 deepEqual 校验）。根 `levels.js` 是 HTML 原型遗留。

## 平台限制备忘

- 小游戏无 WXML/WXSS，全部 Canvas 绘制；无 DOM，不能用 `document/querySelector`。
- 主 canvas 宽高 = `windowWidth×pixelRatio`，绘制前 `ctx.setTransform(scale,…)`。
- 存储/分享/音频用 wx 全局 API（`wx.setStorageSync` / `wx.shareAppMessage` / `wx.createInnerAudioContext`）。
- 下一步计划见 `docs/PROGRESS.md`。