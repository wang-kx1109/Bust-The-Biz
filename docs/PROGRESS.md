# 项目进度日志

> 维护约定：每次完成里程碑、踩坑、变更方向都追加一条记录（新记录写在最上方）。开发/接手前先读本文件 + `CLAUDE.md`。

## 里程碑

### 2026-09-14 · v1.0 核心体验重做：直播连麦挑刺 + 探店实拍相机（消灭"文本贴纸感"）
**背景**：用户真机体验 v0.4 后反馈"整体还是像文本加贴纸、只是比较丰富的文档，没有想玩的欲望；审问选择太套路；绕手机转一圈没有真的转、没有周围场景"。要求不做缝补，视觉效果和玩法交互整体大改。

**交付**（游戏流程重构为：连麦挑刺 → 探店实拍 → 连线 → 急救 → 结算）：
- **ask.js 重做「直播连麦挑刺」**：店主换成矢量角色（新 `character.js`：头肩像+主播耳机+10 种人格配色+idle/talk/happy/sweat/angry 五 mood：眨眼/汗珠下滑/说话口型开合/呼吸浮动）；吹牛话术（questions[].vague）以**直播消息流气泡**逐条上浮，**点气泡=质疑**→侦探反问气泡→三张数据卡 easeOutBack 飞入拍板；答对角色大笑+夸奖弹幕，答错冒汗/发怒+扣耐心；追问机制完整保留；答完全部→老王电话→「去店里取证」
- **photo.js 新建「探店实拍」**（合并原环视+找茬两阶段，`find.js` 已删除）：第一人称相机——**手指拖拽环视**矢量店铺实景（1.6x 变焦 + 手持微抖 + 取景框四角括号/REC/十字丝），对准可疑处**按快门拍照取证**：拍到错误点=白闪+敲锣+证据卡滑入（胶卷有限=错误数+1，拍废片占格、点缩略格删除腾格）；发光抽屉/台账**点按调查**翻出隐藏异常（横幅+弹跳显现）；提示卡=相机自动平移+金色脉冲；第 1 章教学微光（glowIds）
- **基建**：`live.js` 直播间氛围组件（观众数随机游走 + 点赞钮，命中自发 fx.hearts）；`fx.transition(cb)` 全屏转场（520ms 盖帘，场景切换走它）；state.js 拍照取证系统（photographFault/takeJunkPhoto/discardPhoto/getPhotoMax）；sanity-game 新增 [13] 拍照用例（20 项）
- **取舍**：envClues（环视线索数据）暂成死路径——数据与 clueGlowFaults 保留（sanity 仍校验），后续可改为"审问答对给对应异常微光"恢复联动；点赞数不持久化

**校验**：node --check 全文件；sanity.js 23 项；sanity-game.js 20 项；check-templates.js 7 页；ask/photo 假 ctx 全流程冒烟（含追问分支/相机 clamp/胶卷满/转场 cb 恰好一次）。

**待办 / 下一步**
- [ ] 真机验证：挑刺节奏、**玩家是否知道要点气泡质疑**（首条有「⚡点这条质疑」角标）、相机拖拽手感与快门命中宽容度、胶卷数难度
- [ ] envClues 融入新流程恢复线索联动；第三章 11-15 关；工具升级+真实广告单元 ID（见 v0.3 待办）

---

### 2026-09-13 · v0.4 真实场景建模：找茬阶段「在真实店铺里找异常」
**背景**：用户反馈找茬阶段"没有真正的场景建模，全靠色块+文字标签"，要求用户在真实场景中找茬。

**交付**：
- **新增 `minigame/js/core/room.js`（矢量场景建模引擎，零外部图片）**：
  - 房间骨架：后墙双段渐变（上深下浅）+ 踢脚线/墙角线 + 9 套 style 透视地砖（墙脚张开纵向透视线 + 越远越密的横向砖缝线：tea 浅木格 / bake 暖木条 / hotpot 红金大砖 / coffee 深咖 / fastfood 红白格 / dumpling 灰青石板 / bbq 深灰石板 / sushi 榻榻米纹 / viral 亮面霓虹反射）+ 左上柔光 + 右下暗角 + 墙面 neonText 霓虹招牌（sin 闪烁）+ 粉笔黑板菜单
  - 家具库 20 种（吧台/收银台/圆桌/卡座/立冰箱/卧冰柜/烤炉/蒸笼/烤架/板前/展示柜/货架/绿植/垃圾桶/海报架/直播架/挂历/灯串/栏杆/纸箱），每种 5-10 图元 + 投影椭圆；9 套 style 固定布局（按 y 排序近压远），摆位避开全部 39 个 fault 锚点
  - **异常目录 39 个（key=fault.id）**：每个错误点 = 场景内可见异常自包含插画（~70px，黑底小标注牌保证可读），多数带 sin 动画（催租单飘动/价签摇摆/手机屏幕呼吸闪/打印机狂吐小票/糊串冒烟/落叶漂移/饼图红区扫过/红圈重合脉冲/红包印章发光…）；hidden 9 个未解锁不画，revealedPop scale 0→1 弹跳进场
  - `renderRoom(ctx, lv, now, opts)`（found 绿角框+✅章 / glow 金色双环 / hinted 3s 脉冲）+ `hitTestRoom(lv,lx,ly)`：fault(半径40) → inspect(带 reveal 的 zone) → item(家具) → null；`itemFlavor(type)` 20 条排查吐槽文案
- **重写 `minigame/js/scenes/find.js`（无标记找茬）**：不再画 zones 色块/❓标记，头部改「🔍 找出店里的致命问题」「已确证 X/N」；点 fault→确认弹窗（再想想/🔔敲锣，burst 砸在锚点屏幕位置）；点隐藏点区域→banner+异常弹跳显现+「仔细看看这里…」；点普通家具→一句 flavor toast（1.2s）；点空处→「这里看起来没问题」；第 1 关 onEnter 一次性教学 toast；HUD/提示卡广告/线索金色高亮/数据面板/敲锣动画/继续按钮全保留
- zones 数据保留（sanity 依赖），渲染上退化为隐形逻辑区（仅隐藏点触发 + 兜底）

**校验**：`node --check` 两文件；sanity.js 23 项；sanity-game.js 19 项全绿；一次性 node 冒烟 22 项（假 ctx Proxy 10 关×3 帧渲染 / 每 fault 锚点±5px 命中 / reveal zone 中心 inspect / hidden 未解锁不命中 fault / bakery cash→loss 集成 / 20 种 itemFlavor 齐备），跑完已删。

**已知取舍**：
- hidden 点解锁后其插画锚点与触发 zone 完全同位，命中永远优先 fault（符合直觉）
- 个别异常插画（如 gambler 计划纸）画在家具旁而非家具上，靠自带投影/小桌 grounding；锚点 ±10px 内无家具是硬保证（冒烟断言）
- inspect 优先级高于家具：隐藏点 zone 带内的家具点击也触发调查（如 bakery 底部收银带内的收银台），符合"翻台账"语义

**待办 / 下一步**
- [ ] 用户真机验证 v0.4：场景辨识度、异常插画可读性、无标记点击手感（会不会觉得"不知道点哪"）
- [ ] （接续 v0.3 待办）真实广告单元 ID / 第三章 11-15 关 / 结算页推荐位 / 云开发后端

---

### 2026-09-13 · v0.3 全面升级：10 关完整版 + 直播间视觉重做 + 商业化闭环
**背景**：用户对 v0.2 的界面/玩法不满意（纯色块 UI、仅 2 关、无变现），目标"可玩性高、有商业价值、界面吸引人"。

**交付**：
- **内容**：2 → 10 关（设计文档 1-10 关全部落地；6-10 关文档只有简版，补全了审问/环视/找茬/连线/急救/结算全环节）；每关 5 种店主人设（persona）、`sceneTheme` 主题场景、`danmaku` 专属弹幕；第 5 关保留"急救正确项不是止损"的破套路设计
- **视觉**：gfx 2.0（阴影卡片/渐变/霓虹字/粒子/飘字/弹幕/红闪/屏震/缓动）；8 场景全部重做（select 章节分组+惯性滚动、ask 打字机+人设表情、find 主题店铺渲染+线索金色高晕、link 手指拖动连线、rescue 盖章动画、result 计数滚动+成就横幅、fail 心碎+复活、新增 collection 成就图鉴页）
- **玩法机制**：环视线索真正联动找茬（faultId→金色高亮）；勇哥提示卡（每关 2 次，激励视频）；复活续命（每关 1 次，回失败阶段 +2 心）；第二章追问机制（retryable 首错可再答）；patienceMax 按章节（第一章 5 / 第二章 4）
- **商业化**：激励视频封装 ads.js（真实 SDK 就绪走真广告，否则开发模拟降级）；三个点位（提示卡/复活/双倍侦探币）+ Banner 占位（`adunit-btb-banner`，需替换真实单元 ID）；成就 10 个 + 图鉴 10 卡 + 侦探币（achieve.js）；埋点 track.js（level_start/complete/fail/ad_watch/share_click/fault_found/link_done）
- **音效**：`scripts/make-sounds.js` 零依赖合成 6 个 WAV（锣/对/错/心碎/点击/号角）→ `minigame/assets/sounds/`；audio.js 封装（wx 隔离，dev 静音）
- **数据**：双镜像保持 deepEqual（sanity.js 断言 10 关 + 新字段校验：chapter/persona/sceneTheme/danmaku/envClues.faultId/patienceMax/retryable）；**bakery.difficulty 由 2 改为 1**（对齐设计文档关卡02=★，旧值是历史偏差）

**校验**：`node --check` 全部文件；sanity.js 23 项；sanity-game.js 19 项（新增 patienceMax/追问/useHint/revive/clueGlowFaults/成就图鉴侦探币 6 组用例 + collection 接口检查）；check-templates.js 7 页全绿。

**已知提示**：
- 触屏点按在 select/collection 延迟到抬手分流（拖动/点按互斥），手感差异属设计取舍
- 提示卡 useHint 不重复提示同一错误点（state.hinted 记录）
- 根 `levels.js`（坏掉的 HTML 原型）与新数据进一步脱节，维持不维护；真源是 `minigame/js/data/levels.js` ⇄ `miniprogram/data/levels.js`

**待办 / 下一步**
- [ ] 用户真机验证（开发者工具模拟器 + 手机预览）：emoji 真机渲染、select/collection 滚动手感、link 拖动连线、广告模拟遮罩、Windows 模拟器 emoji 黑白为已知现象
- [ ] 接入真实广告单元 ID（替换 ads.js 的 `adunit-btb-reward` / `adunit-btb-banner` 占位）+ 流量主开通
- [ ] 第三章（11-15 关：合同陷阱/股权纠纷/连锁崩塌，含限时机制 60s）——设计文档数据已在，复制本章模式扩数据即可
- [ ] 结算页诊断建议推荐位（品牌合作 CPA 位，GDD 6.3）
- [ ] 云开发后端（成就/侦探币当前纯本地存储，换设备丢失）

---

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