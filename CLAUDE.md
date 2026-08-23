# Bust-The-Biz · 餐饮大侦探

模拟「创业避坑直播间」的互动诊断游戏：玩家扮演侦探主播，连麦审问店主 → 找茬 → 连线 → 急救 → 出诊断报告（止损金额 + 成就称号）。

## 仓库构成

| 路径 | 说明 |
| :--- | :--- |
| `miniprogram/` | **微信小程序（当前开发重心）**，原生 JS + WXML + WXSS |
| `scripts/` | node 一致性校验（在无微信开发者工具环境里代替"能跑"） |
| `index.html` / `levels.js` | GitHub Pages 原型。⚠️ 因缺 `game.js` 已失效，暂不维护 |
| `readme.md` | 游戏设计文档（需求/数值/商业化） |
| `<餐饮大侦探>关卡设计文档.md` | 详细关卡设计 |
| `docs/PROGRESS.md` | 进度日志 —— **干任何事前先读这里** |
| `project.config.json` | 开发者工具配置（`miniprogramRoot`、`touristappid`） |

## 校验命令（仓库根目录执行）

```bash
node scripts/sanity.js          # 关卡数据完整性 / 坐标 / 隐藏点引用 / 满分公式
node scripts/sanity-game.js     # 状态机全流程冒烟测试（两关全对/失败/连线语义/结算）
node scripts/check-templates.js # WXML 绑定 ↔ 页面 data/方法 交叉校验
node --check <任意 .js>         # JS 语法
```

改动任何 `data/ utils/ pages/` 后都应跑一遍上述脚本再提交。

## 小程序架构速览

```
miniprogram/
├── app.js / app.json / app.wxss     # 入口；7 页注册；全局暗色主题；全局注册 hud 组件
├── components/hud/                  # 顶部 HUD（❤️耐心值 + 得分），所有阶段页复用
├── data/levels.js                   # 关卡数据（唯一数据源，见"数据源注意"）
├── utils/game.js                    # 单一状态机：state/progress + 全部 API
└── pages/
    ├── select/ 关卡选择（解锁进度）
    ├── ask/    审问（askStep 0开场/1环视/2-4三问/5老王）
    ├── find/   找茬（750 坐标→rpx；隐藏错误点 unlockBy）
    ├── link/   连线（canvas 2d 贝塞尔线）
    ├── rescue/ 急救（三选一）
    ├── result/ 结算（得分/成就/止损/下一关解锁）
    └── fail/   诊断失败（耐心归零）
```

**状态与导航约定**
- 页面不改状态：所有逻辑走 `utils/game.js` 的纯函数，页面用 `game.sync(this)` 注入基础视图，再 `setData` 自己的局部视图。
- 阶段前进用 `wx.redirectTo`，重开/回选关用 `wx.reLaunch`；各页 `onLoad` 以 `game.state.stage` 做守卫，防止深链/回退进入错误阶段。
- 禁用往 `setData` 传函数；`setData` 只收 `getStateView()` 的纯数据。

**得分与止损**（`utils/game.js :: computeResult`）
```
score   = 答对 + 找茬数 + 连线对数 + 急救对(1)
maxScore = 问数 + 错误数 + 对数 + 1
recovered = 找茬×find + 连线×link + 急救×rescue + 答对×ask + 剩余耐心×patience
loss = max(0, baseLoss − recovered)     // 耐心也是一种"止损贡献"！
成就称号按 score 命中 result.achievements 档位
```

**数据源注意**：`miniprogram/data/levels.js` 移植自根 `levels.js`，唯一结构变更 `interview.neighbor.text`(HTML) → `texts`(纯文本数组)。修改关卡数据应改根文件后同步，并跑 `node scripts/sanity.js`。

## 平台限制备忘

- WXSS **不使用 CSS 变量**（部分基础库不支持）→ 全用字面量颜色。
- 连线 canvas 必须 `fields({node,size})` + dpr 缩放。
- 下一步计划见 `docs/PROGRESS.md`。