# Bust-The-Biz · 餐饮大侦探

模拟「创业避坑直播间」的互动诊断游戏：玩家扮演侦探主播，连麦审问店主 → 找茬 → 连线 → 急救 → 出诊断报告（止损金额 + 成就称号）。

## 仓库构成

| 路径 | 说明 |
| :--- | :--- |
| `minigame/js/scenes/` | **微信小游戏场景（当前开发重心）**，Canvas 2D 渲染，8 个场景 |
| `minigame/js/core/` | gfx(绘图) / fx(粒子弹幕飘字屏震) / audio(音效) / ads(激励视频) / track(埋点) / achieve(成就图鉴侦探币) / state(状态机) / router / layout / room(v0.4 矢量场景建模引擎，find 专用) |
| `minigame/game.js` / `game.json` | 小游戏入口 + 配置 |
| `minigame/assets/sounds/` | 6 个合成音效 WAV（`node scripts/make-sounds.js` 可再生成） |
| `miniprogram/` | ⚠️ **遗留存档**（旧小程序架构，WXML/WXSS，已不维护；仅 `data/levels.js` 作为数据镜像参与校验） |
| `scripts/` | node 一致性校验 |
| `index.html` / `levels.js` | GitHub Pages 原型。⚠️ 因缺 `game.js` 已失效，不维护 |
| `readme.md` | 游戏设计文档（需求/数值/商业化） |
| `<餐饮大侦探>关卡设计文档.md` | 详细关卡设计（1-15 关数据；v0.3 已落地 1-10 关） |
| `docs/PROGRESS.md` | 进度日志 —— **干任何事前先读这里** |
| `docs/微信小游戏开发指南.md` | **开发体验指南**（环境/导入/真机/排错/协作，给同伴开发者） |
| `docs/avatar.png` | 小程序/小游戏头像（`node scripts/make-avatar.js` 可再生成） |
| `project.config.json` | `compileType: "game"`、`appid: wx01973db56f70ae3e`（小游戏） |

## 校验命令（仓库根目录执行）

```bash
node scripts/sanity.js          # 双数据源一致性 / 数据完整性 / 坐标 / 隐藏点 / 满分公式（10 关 + 元数据字段）
node scripts/sanity-game.js     # 状态机全流程冒烟（19 项：含追问/复活/提示卡/线索联动/成就）+ 场景接口存在性（8 场景）
node scripts/check-templates.js # 仅对遗留 miniprogram 的 WXML 交叉校验（新开发不涉及）
node scripts/make-sounds.js     # 重新生成 6 个音效 WAV（改了合成参数才需要跑）
node --check <任意 .js>         # JS 语法
```

改动任何 `minigame/ utils/ pages/ data/` 后都应跑一遍上述脚本再提交。

## 小游戏架构速览

```
minigame/
├── game.js                  # 入口：主canvas + 主循环(requestAnimationFrame) + 触屏分发(tap/move/end) + 分享
├── game.json                # 竖屏小游戏配置
└── js/
    ├── core/
    │   ├── state.js         # 状态机（纯逻辑可 node 测）：审问/找茬/连线/急救/结算 + patienceMax/revive/useHint/追问/线索联动
    │   ├── router.js        # 场景路由 switchScene / dispatchTap(Move/End) / render
    │   ├── gfx.js           # 绘图库：圆角/阴影/渐变/文字换行/按钮/HUD/气泡/toast + 粒子/飘字/弹幕/缓动/红闪
    │   ├── fx.js            # 跨场景特效单例：burst/hearts/sparks/floater/flash/shake/say(弹幕)/转场；主循环驱动
    │   ├── audio.js         # 音效封装 play('bell'|'correct'|'wrong'|'heart'|'click'|'fanfare')，dev 静音降级
    │   ├── ads.js           # 激励视频 show(scene)→Promise<bool>（真实 SDK 失败自动降级开发模拟）+ Banner 占位
    │   ├── track.js         # 埋点 track(evt,data) → btb_events 本地环形存储
    │   ├── achieve.js       # 成就 10 / 图鉴 10 / 侦探币 coins（onComplete/addCoins/cards/list/stats）
    │   ├── layout.js        # 布局（逻辑宽 750，与关卡坐标 1:1）
    │   └── room.js          # 矢量场景建模引擎（v0.4，find 专用）：房间骨架/透视地板/20 家具/39 异常插画/hitTestRoom/itemFlavor，零外部图片
    ├── data/levels.js       # 关卡数据（10 关，与 miniprogram/data/levels.js 互为镜像）
    └── scenes/              # 8 个场景：select/ask/find/link/rescue/result/fail/collection
```

**渲染与交互约定**
- **逻辑坐标系宽 = 750**，与关卡数据坐标 1:1；`layout.SCALE` 缩放绘制。触屏 `wx.onTouchStart/Move/End` 换算逻辑坐标后派发 `scene.onTap/onMove/onEnd(x, y)`（onMove/onEnd 为可选接口，link 拖动连线在用）。
- 场景接口：`{ onEnter(), update(dt,now), render(ctx), onTap(x,y), onExit() }`；切换用 `router.switchScene('xxx')`。
- **命中即视觉同源**：每个场景 render() 里边测量边绘制边记录按钮/卡片 rect 到 `this.buttons`/`this.optRects` 等，onTap 用最新 rect 做矩形命中——视觉与点击永不漂移。**不要再拆出独立的布局计算函数**（link 的历史豁免除外）。select/collection 带 drag 滚动：rect 记录时减 scrollY，按压点延迟到 onEnd 分流拖动/点按。
- **find 场景的场景区是约定豁免**：v0.4 起渲染与命中都委托 `core/room.js`（`renderRoom(ctx, lv, now, opts)` / `hitTestRoom(lv, lx, ly)`，750 场景坐标，find.js 做 SX/SY/k 缩放平移）——错误点是"场景内的可见异常插画"，zones 退化为隐形逻辑区（仅隐藏点触发+兜底），不再画色块/❓标记。
- 所有逻辑走 `js/core/state.js` 纯函数；`store.markStage('xxx')` 记录阶段。
- 主循环每帧顺序：`setTransform → fx.getShake translate → router.update → fx.update → router.render → fx.renderWorld → fx.renderOverlay → ads.render`；场景只管发事件（fx.burst/audio.play/ads.show），fx/ads 的绘制由主循环统一收尾。
- **Canvas 里 emoji 在 Windows 开发者工具可能黑白/豆腐块，真机正常**——属已知现象，别当成 bug。
- **关卡数据新字段**（v0.3）：`chapter`(1|2)、`persona{type,tag,catchphrase}`（type 映射 ask 表情）、`patienceMax`（ch1=5/ch2=4）、`retryable`（仅 ch2，首错可追问）、`interview.danmaku[]`（场景 onEnter 喂 fx.setDanmakuPool）、`envClues[].faultId`（收藏后 find 阶段金色高亮）、`findFaults.sceneTheme{style,accent,sign}`（9 套主题键 tea|bake|hotpot|coffee|fastfood|dumpling|bbq|sushi|viral）。

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