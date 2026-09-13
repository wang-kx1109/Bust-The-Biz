/* =====================================================================
 * data/levels.js — 关卡数据（与逻辑完全分离）
 * ---------------------------------------------------------------------
 * 注意：本文件源自仓库根 levels.js，请勿直接修改！
 *       修改根文件后需同步到本文件，并运行 scripts/sanity.js 校验一致性。
 *
 * 唯一的移植变更：interview.neighbor.text（HTML <b> 富文本，小程序 rich-text
 *   无法解析 CSS 变量）→ neighbor.texts（纯文本数组，按 <br> 拆分去标签）。
 *
 * 坐标系：所有坐标使用 {x, y}（配合 w/h 为 {x, y, w, h}），参考 750x750 场景图，
 * 与小程序 rpx（750rpx = 屏宽）天然 1:1 映射。
 *
 * 仅供玩法验证和学习参考，所有角色、场景、数据均为虚构，不涉及任何商业用途
 * ===================================================================== */

const LEVELS = [

  /* ===================================================================
   * 关卡 1：奶茶店（原有关卡，保留完整流程）
   * =================================================================== */
  {
    id: 'milk-tea',
    title: '奶茶店避坑诊断',
    subtitle: '糊涂店主 · 月月亏本还在硬扛',
    icon: '🧋',
    shopType: '奶茶店',
    chapter: 1,                       // 第一章 · 新手村
    difficulty: 1,                    // 难度（星数）
    patienceMax: 5,                   // 第一章初始耐心 5
    retryable: false,                 // 仅第二章可重试
    persona: { type: 'confused', tag: '迷糊新手', catchphrase: '这个……我得问问店员。' },
    unlockCondition: null,            // null = 默认解锁

    /* ---------- 审问阶段 ---------- */
    interview: {
      // 店主信息（含真实数据 / 瞎说范围，用于文档与氛围）
      owner: {
        name: '糊涂店主',
        emoji: '👨‍🍳',
        age: 32,
        catchphrase: '这店绝对赚钱！',
        intro: '侦探你好！谢谢你连麦帮我看店，我这家奶茶店开了大半年，怎么都不赚钱，你给号号脉？',
        camHint: '店主正拿手机转圈…',
        realData: { rent: '5.8万/月', sales: '3000元/日', labor: '8人/2.4万' },
        bluff:    { rent: '摊下来两万', sales: '日流水五六千', labor: '就4个亲戚' },
      },
      // 360 环视线索（最多收藏 maxClues 条；faultId 指向本关 findFaults.faults）
      envClues: [
        { id: 'starbucks', icon: '🏪', label: '隔壁瑞幸', desc: '同品类强敌，客流被分流', faultId: null },
        { id: 'road',      icon: '🚧', label: '门口修路', desc: '施工挡路，客流腰斩，就这还敢收 5.8 万房租？', faultId: 'rent' },
        { id: 'office',    icon: '🏢', label: '写字楼搬空', desc: '目标客群（白领）流失' },
        { id: 'waimai',    icon: '🛵', label: '外卖单稀少', desc: '线上渠道没做起来，原料却按大客流囤', faultId: 'food' },
      ],
      maxClues: 3,
      // 夺命三连问：含糊回答 + 三选一（correct 为真实数据）
      questions: [
        {
          id: 'rent',
          ask: '老板，你这店一个月租金到底多少？',
          vague: '“租金啊……五万八，不过这里面含着转让费和物业费，摊下来其实不贵，两万出头吧！”',
          options: [
            { label: '2.5万/月', correct: false, reveal: '同地段正常价才 2.5万，你被宰了' },
            { label: '5.8万/月', correct: true,  reveal: '真实租金 5.8万/月，严重偏高' },
            { label: '8万/月',   correct: false, reveal: '没有8万，但你报的5.8万也不对' },
          ],
        },
        {
          id: 'sales',
          ask: '那你一天营业额能做多少？',
          vague: '“生意好的时候一天能卖八千，平常也有五六千，特别稳定的！”',
          options: [
            { label: '3000元/日', correct: true,  reveal: '真实日均流水只有 3000元' },
            { label: '6000元/日', correct: false, reveal: '你在吹牛，实际没这么多' },
            { label: '8000元/日', correct: false, reveal: '那是你的“理想值”，不是真实' },
          ],
        },
        {
          id: 'labor',
          ask: '雇了几个人？人工成本多少？',
          vague: '“就雇了四个人，都是自家亲戚，给点零花钱就行了～”',
          options: [
            { label: '4人', correct: false, reveal: '亲戚也发工资，不止4个' },
            { label: '6人', correct: false, reveal: '你再想想后厨挤了几个？' },
            { label: '8人', correct: true,  reveal: '实际8人，月人工2.4万，严重冗余' },
          ],
        },
      ],
      // 隔壁老王验证（交叉验证揭示隐藏矛盾）
      neighbor: {
        name: '隔壁老王',
        emoji: '📞',
        title: '电话录音',
        texts: [
          '他呀？一天顶多卖 100 杯，一杯 18 块，流水撑死 3000 块，哪来的八千！',
          '还有啊，我昨天路过瞄了一眼，他后厨挤了 七八个人，比客人还多！',
        ],
        reveal: '🔍 发现隐藏矛盾：营业额吹水、人工虚报！',
      },
      // 直播间弹幕（纯文本吐槽）
      danmaku: [
        '这租金我直接好家伙',
        '5万8的房租卖18块的奶茶，勇士',
        '一天3000流水？给房东打工罢了',
        '后厨8个人比客人还多哈哈哈',
        '抵押房子加盟，buff叠满',
        '主播快救救她吧',
        '这牌子我熟，快招经典款',
      ],
    },

    /* ---------- 找茬阶段 ---------- */
    findFaults: {
      sceneRef: 'milk-tea-scene',
      sceneSize: { w: 750, h: 750 },
      sceneTheme: { style: 'tea', accent: '#ff8fb5', sign: '好喝到爆奶茶' },
      // 场景分区（x/y/w/h 为 750 坐标系下的定位，单位自定，最终按百分比缩放）
      zones: [
        { id: 'door',    x: 30, y: 25,  w: 690, h: 125, icon: '🚪', label: '招牌「好喝到爆奶茶」', bg: '#2c2c55' },
        { id: 'bar',     x: 30, y: 180, w: 330, h: 160, icon: '🧋', label: '吧台', bg: '#33335f' },
        { id: 'cash',    x: 390, y: 180, w: 330, h: 160, icon: '💵', label: '收银台', bg: '#33335f' },
        { id: 'seat',    x: 30, y: 370, w: 690, h: 210, icon: '🪑', label: '就餐区', bg: '#2a2a52' },
        { id: 'kitchen', x: 30, y: 610, w: 690, h: 115, icon: '🧊', label: '后厨 · 冰箱', bg: '#25253f' },
      ],
      // 错误点（hidden 为 true 表示需点击某正常区域才解锁；unlockBy 对应 zone.id）
      faults: [
        { id: 'rent',  x: 660, y: 85,  title: '租金过高', desc: '月租金 5.8万，而同一地段正常价只有 2.5万，多掏了 3.3万/月。', data: '5.8万', panelLabel: '月租金', panelNormal: '2.5万' },
        { id: 'food',  x: 375, y: 668, title: '食材成本率超标', desc: '食材成本占到 45%，正常应控制在 35% 以内，每卖一杯都在贴钱。', data: '45%', panelLabel: '食材成本率', panelNormal: '≤35%' },
        { id: 'labor', x: 600, y: 475, title: '人工冗余', desc: '实际 8 个人（月薪 2.4万），正常 4 人足够，每月白扔 1.2万。', data: '8人', panelLabel: '人工', panelNormal: '4人' },
      ],
    },

    /* ---------- 连线阶段：错误原因 -> 错误后果 ---------- */
    connectPairs: [
      { leftId: 'rent',  rightId: 'breakeven', left: '💰 租金过高', right: '每天要卖 300 杯才回本' },
      { leftId: 'food',  rightId: 'loseper',   left: '🥩 食材成本超标', right: '每卖一杯净亏 2 元' },
      { leftId: 'labor', rightId: 'waste',     left: '👥 人工冗余', right: '每月白扔 1.2 万' },
    ],

    /* ---------- 急救阶段 ---------- */
    firstAid: {
      prompt: '侦探！那我到底该怎么办？我已经投进去一百多万了，实在不甘心啊……',
      options: [
        { tag: 'A', label: '加大营销投入，砸钱引流', correct: false, why: '成本已经失控，再砸广告只会亏得更快' },
        { tag: 'B', label: '找房东谈降租，再撑一年', correct: false, why: '租金只是问题之一，结构性问题没解决' },
        { tag: 'C', label: '及时转让止损，保住现金流', correct: true, why: '正确！止损离场，留得青山在' },
      ],
    },

    /* ---------- 结算 ---------- */
    result: {
      baseLoss: 180,   // 若继续硬扛的预计亏损（万）
      weights: { find: 20, link: 15, rescue: 25, ask: 4, patience: 8 }, // 各类表现的挽回权重（万）
      achievements: [   // 按得分区间从高到低排列
        { min: 10, title: '🏆 避坑天花板' },
        { min: 7,  title: '🧠 人间清醒' },
        { min: 4,  title: '🏛️ 两江总督' },
        { min: 1,  title: '☁️ 云开店选手' },
        { min: 0,  title: '🐷 店主的同伙' },
      ],
      shareText: '我在《餐饮大侦探》里帮糊涂店主诊断出 {flaws} 个致命错误、止损 {loss} 万！得分 {score}/{total}，你能得几分？',
    },
  },

  /* ===================================================================
   * 关卡 2：面包房（含 1 个隐藏错误点）
   * =================================================================== */
  {
    id: 'bakery',
    title: '面包房避坑诊断',
    subtitle: '老张的商场负一层烘焙店',
    icon: '🍞',
    shopType: '烘焙店',
    chapter: 1,
    difficulty: 1,
    patienceMax: 5,
    retryable: false,
    persona: { type: 'stubborn', tag: '固执老炮', catchphrase: '我做餐饮二十年了，能不懂？' },
    unlockCondition: { type: 'complete', id: 'milk-tea' }, // 通关关卡1后解锁

    /* ---------- 审问阶段 ---------- */
    interview: {
      owner: {
        name: '老张',
        emoji: '🧑‍🍳',
        age: 45,
        catchphrase: '我做餐饮二十年了！',
        intro: '小伙子，我做餐饮二十年了！这烘焙店我一眼就看出能赚，你帮我看看，是不是哪里还没做到位？',
        camHint: '店主正拿手机转圈…',
        realData: { rent: '8000元/月(负一层)', sales: '1500元/日', traffic: '30人/日', loss: '报废率30%' },
        bluff:    { rent: '闭眼签', sales: '日流水八千', traffic: '几百人进店' },
      },
      envClues: [
        { id: 'basement', icon: '🛗', label: '商场负一层', desc: '客流通达性极差，选址硬伤', faultId: 'location' },
        { id: 'empty',    icon: '🏬', label: '商场本身冷清', desc: '整层没几家店开门' },
        { id: 'rival',    icon: '🏪', label: '楼上连锁面包', desc: '同类竞品截胡客流' },
        { id: 'coupon',   icon: '🎟️', label: '靠团购券引流', desc: '9块9的券把客单价钉死在地板上', faultId: 'pricing' },
      ],
      maxClues: 3,
      questions: [
        {
          id: 'sales',
          ask: '老张，你这一天营业额能做多少？',
          vague: '“我做餐饮二十年了！一天营业额少说八千，稳稳的，这还能有假？”',
          options: [
            { label: '1500元/日', correct: true,  reveal: '真实日流水只有 1500 元，你报高了好几倍' },
            { label: '4000元/日', correct: false, reveal: '还是虚的，实际远没这么多' },
            { label: '8000元/日', correct: false, reveal: '那是你的“理想值”，负一层哪来的人' },
          ],
        },
        {
          id: 'traffic',
          ask: '那你这店一天进店多少人？',
          vague: '“商场嘛，人来人往的，一天几百人总有吧，周末更多！”',
          options: [
            { label: '30人/日',   correct: true,  reveal: '真实进店不足 30 人，惨淡得很' },
            { label: '150人/日',  correct: false, reveal: '你数的是路过整层的人吧' },
            { label: '300人/日',  correct: false, reveal: '别做梦了，负一层没这个流量' },
          ],
        },
        {
          id: 'loss',
          ask: '面包卖不完，一般怎么处理？',
          vague: '“卖不完第二天接着卖，我做餐饮二十年，从不浪费粮食！”',
          options: [
            { label: '报废率5%',  correct: false, reveal: '正常面包店才这个数，你不是' },
            { label: '报废率15%', correct: false, reveal: '还是说少了，你再想想扔了多少' },
            { label: '报废率30%', correct: true,  reveal: '真实报废率 30%，每天扔掉一大半' },
          ],
        },
      ],
      neighbor: {
        name: '楼下面馆老板',
        emoji: '📞',
        title: '电话录音',
        texts: [
          '老张那店啊，在负一层犄角旮旯，我蹲了一整天数着，进店的 撑死 30 个人，他非说几百人！',
          '晚上打烊我还看见他 一箱一箱往垃圾桶扔面包，那报废率，吓死人！',
        ],
        reveal: '🔍 发现隐藏矛盾：客流吹水、报废率惊人！',
      },
      danmaku: [
        '负一层开店，鬼都不过去',
        '二十年经验全喂了地下室',
        '日流水1500敢吹八千',
        '报废30%？这是在做慈善',
        '团购引来的全是羊毛党',
        '老张你醒醒，酒香也怕巷子深',
      ],
    },

    /* ---------- 找茬阶段 ---------- */
    findFaults: {
      sceneRef: 'bakery-scene',
      sceneSize: { w: 750, h: 750 },
      sceneTheme: { style: 'bake', accent: '#f0b866', sign: '老张烘焙' },
      zones: [
        { id: 'entrance', x: 30, y: 25,  w: 690, h: 110, icon: '🚪', label: '门头「老张烘焙」', bg: '#3a352e' },
        { id: 'display',  x: 30, y: 165, w: 690, h: 150, icon: '🍞', label: '面包展示柜', bg: '#4a4230' },
        { id: 'oven',     x: 30, y: 345, w: 690, h: 210, icon: '🔥', label: '烤箱 · 操作间', bg: '#3d3333' },
        // 收银台是"正常区域"，点击它会解锁隐藏错误点 loss
        { id: 'cash',     x: 30, y: 585, w: 690, h: 140, icon: '💰', label: '收银台', bg: '#33413f', reveal: 'loss', revealHint: '你翻了下收银台的台账，发现面包每天都在大量报废……' },
      ],
      faults: [
        { id: 'location', x: 660, y: 78,  title: '选址错误（负一层）', desc: '开在商场负一层，客流通达性极差，日进店不足 30 人。', data: '负一层', panelLabel: '选址', panelNormal: '临街/一层' },
        { id: 'pricing',  x: 180, y: 240, title: '客单价过低', desc: '平均客单价仅 18 元，毛利空间被低价团购压没了。', data: '18元', panelLabel: '客单价', panelNormal: '28元+' },
        { id: 'area',     x: 600, y: 450, title: '面积冗余', desc: '200㎡ 烘焙店，一半面积闲置，租金和水电都在白交。', data: '200㎡', panelLabel: '面积', panelNormal: '≤80㎡' },
        // 隐藏错误点：需要先点击收银台（cash 分区）才能解锁发现
        { id: 'loss',     x: 375, y: 655, title: '报废率过高', desc: '每日面包报废率高达 30%，等于每天扔掉近一半。', data: '30%', panelLabel: '报废率', panelNormal: '≤5%', hidden: true, unlockBy: 'cash' },
      ],
    },

    /* ---------- 连线阶段 ---------- */
    connectPairs: [
      { leftId: 'location', rightId: 'notraffic', left: '📍 选址错误(负一层)', right: '没人进店，做啥都白搭' },
      { leftId: 'pricing',  rightId: 'lowmargin', left: '💸 客单价过低', right: '卖得越多亏得越多' },
      { leftId: 'area',     rightId: 'rentwaste', left: '📐 面积冗余', right: '一半房租白交' },
      { leftId: 'loss',     rightId: 'throw',     left: '🗑️ 报废率过高', right: '每天扔掉一大半面包' },
    ],

    /* ---------- 急救阶段 ---------- */
    firstAid: {
      prompt: '侦探，我做了二十年餐饮，你说句实在话，我这店还有救吗？',
      options: [
        { tag: 'A', label: '增加品类（蛋糕、甜品、饮品）', correct: false, why: '负一层没人流，品类越多损耗越大，做啥都没人买' },
        { tag: 'B', label: '加大促销团购，低价引流', correct: false, why: '来的都是薅羊毛的，促销只会亏得更狠' },
        { tag: 'C', label: '及时止损转让，撤离负一层', correct: true, why: '正确！选址是硬伤，止损离场才是唯一解' },
      ],
    },

    /* ---------- 结算 ---------- */
    result: {
      baseLoss: 120,
      weights: { find: 15, link: 10, rescue: 20, ask: 3, patience: 6 },
      achievements: [
        { min: 12, title: '🏆 烘焙界福尔摩斯' },
        { min: 9,  title: '🧠 人间清醒' },
        { min: 5,  title: '👨‍🍳 两江总督' },
        { min: 1,  title: '☁️ 云开店选手' },
        { min: 0,  title: '🐷 老张的合伙人' },
      ],
      shareText: '我在《餐饮大侦探》里帮老张诊断出 {flaws} 个致命错误、止损 {loss} 万！得分 {score}/{total}，你敢来挑战吗？',
    },
  },

  /* ===================================================================
   * 关卡 3：火锅店（甩锅侠 · 迷惑性选项：数值接近）
   * =================================================================== */
  {
    id: 'hotpot',
    title: '火锅店避坑诊断',
    subtitle: '阿杰的加盟火锅店 · 句句怪总部',
    icon: '🍲',
    shopType: '火锅店',
    chapter: 1,
    difficulty: 2,
    patienceMax: 5,
    retryable: false,
    persona: { type: 'blamer', tag: '甩锅侠', catchphrase: '都怪加盟总部！' },
    unlockCondition: { type: 'complete', id: 'bakery' },

    interview: {
      owner: {
        name: '阿杰',
        emoji: '👨‍🍳',
        age: 30,
        catchphrase: '都怪加盟总部！',
        intro: '侦探你来得正好！你给我评评理——我这个店就是被加盟总部坑了！食材贵、罚款多、干啥啥不行，反正不是我的问题！',
        camHint: '店主把镜头怼向一张「优秀加盟商」奖状…',
        realData: { rent: '3.2万/月', sales: '5200元/日', food: '食材成本率52%', labor: '2.8万/月(6人)' },
        bluff:    { rent: '三万多，地段好', food: '三十多吧，正常', labor: '一万多，没多少' },
      },
      envClues: [
        { id: 'fine',      icon: '📜', label: '总部罚款通知', desc: '不按总部渠道进货就罚款，贴了一墙', faultId: 'forced' },
        { id: 'price_tag', icon: '🏷️', label: '高价冻品堆满后厨', desc: '同款毛肚比批发市场贵一倍', faultId: 'supply' },
        { id: 'hall',      icon: '🧍', label: '前厅冷冷清清', desc: '服务员比客人多，厨师长已离职', faultId: 'team' },
        { id: 'banner',    icon: '🚩', label: '「优秀加盟商」锦旗', desc: '总部发的，进货越多越发', faultId: null },
      ],
      maxClues: 3,
      questions: [
        {
          id: 'rent',
          ask: '阿杰，你这个店一个月租金多少？',
          vague: '“租金？三万多吧，这个地段，值！”',
          options: [
            { label: '3.8万/月', correct: false, reveal: '高了，但租金真不是这店的病根' },
            { label: '3.2万/月', correct: true,  reveal: '3.2万/月，基本靠谱——毛病出在别的地方' },
            { label: '2.8万/月', correct: false, reveal: '低了，他没在这上头撒谎' },
          ],
        },
        {
          id: 'food',
          ask: '食材成本率多少？总部进货贵不贵？',
          vague: '“总部统一供货，成本三十多个点吧，很正常，大家都这样。”',
          options: [
            { label: '38%', correct: false, reveal: '38% 是行业正常值，他的真实数字吓人得多' },
            { label: '45%', correct: false, reveal: '还是低估了，再往上猜' },
            { label: '52%', correct: true,  reveal: '实测 52%！行业正常 ≤40%，每卖 100 元流水先没 52 元' },
          ],
        },
        {
          id: 'labor',
          ask: '店里员工工资一个月多少？',
          vague: '“人工没多少，就几个人，一万多顶天了。”',
          options: [
            { label: '1.8万/月', correct: false, reveal: '少了，他拖欠的可不止这个数' },
            { label: '2.8万/月', correct: true,  reveal: '2.8万/月、6个人，厨师长还已经跑路了' },
            { label: '3.8万/月', correct: false, reveal: '没那么多，但拖欠两个月是实打实的' },
          ],
        },
      ],
      neighbor: {
        name: '隔壁烟酒店老板',
        emoji: '📞',
        title: '电话录音',
        texts: [
          '他那个总部啊，供货比市场上贵一倍，还强制进货，不进货就罚款，简直是明抢。',
          '前厅后厨？厨师长上个月就走了，现在前厅就一个小姑娘撑着，上菜慢得要命。',
        ],
        reveal: '🔍 发现隐藏矛盾：进货被总部绑架，团队已经散了半边！',
      },
      danmaku: [
        '甩锅侠本侠了',
        '句句不离总部，字字不提自己',
        '52%成本率，卖得越多亏得越稳',
        '供货贵一倍？这是杀猪盘吧',
        '厨师长跑了哈哈，前厅就一个娃',
        '连续亏6个月还坚持，感动中国',
      ],
    },

    findFaults: {
      sceneRef: 'hotpot-scene',
      sceneSize: { w: 750, h: 750 },
      sceneTheme: { style: 'hotpot', accent: '#e23b3b', sign: '翻滚吧火锅（某大牌加盟）' },
      zones: [
        { id: 'sign',    x: 30, y: 25,  w: 690, h: 110, icon: '🚪', label: '招牌 · 等位区', bg: '#4a1f1f' },
        { id: 'hall',    x: 30, y: 165, w: 690, h: 220, icon: '🍲', label: '大堂卡座', bg: '#542323' },
        { id: 'kitchen', x: 30, y: 415, w: 690, h: 190, icon: '🥩', label: '后厨 · 冻品柜', bg: '#3d1c1c' },
        { id: 'office',  x: 30, y: 635, w: 690, h: 90,  icon: '📒', label: '账台 · 办公室', bg: '#2e1a2e', reveal: 'denial', revealHint: '你翻开账台的月度报表，连续 6 个月全是赤字……' },
      ],
      faults: [
        { id: 'supply', x: 180, y: 240, title: '食材成本失控', desc: '实测食材成本率 52%，行业正常 ≤40%，每卖 100 元流水先被吃掉 52 元。', data: '52%', panelLabel: '食材成本率', panelNormal: '≤40%' },
        { id: 'forced', x: 520, y: 510, title: '强制进货陷阱', desc: '总部指定供应商报价比市场高 80%~100%，不进就罚款，进得多亏得多。', data: '贵80%', panelLabel: '总部供货价', panelNormal: '市场价' },
        { id: 'team',   x: 560, y: 250, title: '员工流失严重', desc: '厨师长已离职、工资拖欠两个月，前厅只剩 1 人撑场，出餐慢、差评多。', data: '剩1人', panelLabel: '前厅在岗', panelNormal: '6人团队' },
        // 隐藏错误点：先点击账台（office 分区）解锁
        { id: 'denial', x: 200, y: 680, title: '盲目坚持', desc: '账本显示连续 6 个月亏损、月亏约 3.5 万，总部还在喊“坚持就是胜利”——坚持到血本无归。', data: '连亏6月', panelLabel: '经营状况', panelNormal: '及时止损', hidden: true, unlockBy: 'office' },
      ],
    },

    connectPairs: [
      { leftId: 'supply', rightId: 'lose12',   left: '📈 食材成本率52%', right: '每卖100元，毛利先被吃掉52元' },
      { leftId: 'forced', rightId: 'cost2x',   left: '🔗 总部强制进货', right: '采购成本是市场价的2倍' },
      { leftId: 'team',   rightId: 'badreview', left: '👥 员工集体离职', right: '服务质量崩溃，差评霸屏' },
    ],

    firstAid: {
      prompt: '侦探，那你说咋办？反正都是总部的锅！我可告诉你，想让我认错，门都没有！',
      options: [
        { tag: 'A', label: '和总部谈判，争取自主进货权', correct: false, why: '快招品牌的核心利润就来自强制进货，不可能让步——谈判桌你都上不去' },
        { tag: 'B', label: '低价转让，彻底脱离加盟体系', correct: true, why: '正确！这是一场注定打不赢的战争，及时止损是最好的选择' },
        { tag: 'C', label: '提高菜品价格，覆盖成本', correct: false, why: '52%成本率+竞品环伺，提价就是赶走最后一批客人' },
      ],
    },

    result: {
      baseLoss: 170,
      weights: { find: 20, link: 15, rescue: 25, ask: 4, patience: 6 },
      achievements: [
        { min: 11, title: '🏆 财务侦探' },
        { min: 8,  title: '🧠 人间清醒' },
        { min: 5,  title: '💸 成本战士' },
        { min: 2,  title: '☁️ 云开店选手' },
        { min: 0,  title: '🐷 甩锅学徒' },
      ],
      shareText: '我在《餐饮大侦探》里帮阿杰诊断出 {flaws} 个致命错误、止损 {loss} 万！得分 {score}/{total}，你能比他先甩掉锅吗？',
    },
  },

  /* ===================================================================
   * 关卡 4：咖啡店（网红梦 · 干扰项合理化）
   * =================================================================== */
  {
    id: 'coffee',
    title: '咖啡店避坑诊断',
    subtitle: '莉莉的网红咖啡馆 · 5000粉丝的梦',
    icon: '☕',
    shopType: '咖啡馆',
    chapter: 1,
    difficulty: 2,
    patienceMax: 5,
    retryable: false,
    persona: { type: 'influencer', tag: '网红梦', catchphrase: '我在抖音有5000粉丝！' },
    unlockCondition: { type: 'complete', id: 'hotpot' },

    interview: {
      owner: {
        name: '莉莉',
        emoji: '💁‍♀️',
        age: 26,
        catchphrase: '我在抖音有5000粉丝！',
        intro: '宝子们欢迎侦探连麦！我家咖啡馆超有氛围感的，随便一拍都是大片，流量这块你就放心吧！',
        camHint: '店主对着补光灯调整第 8 次机位…',
        realData: { rent: '2.5万/月', sales: '900元/日', traffic: '20人/日', decor: '装修投入80万' },
        bluff:    { rent: '网红街标配', sales: '三四千一天', traffic: '五六十人排队', decor: '也就几十万' },
      },
      envClues: [
        { id: 'menu',      icon: '📋', label: '45元价目表', desc: '隔壁连锁咖啡均价才25元', faultId: 'price' },
        { id: 'ringlight', icon: '💡', label: '直播补光灯', desc: '机位比客人的座位还多', faultId: 'vanity' },
        { id: 'decorwall', icon: '🖼️', label: '整面打卡墙', desc: '听说光这一面墙就花了8万', faultId: 'decor' },
        { id: 'seats',     icon: '🪑', label: '空荡荡的座位', desc: '饭点就坐了四桌', faultId: null },
      ],
      maxClues: 3,
      questions: [
        {
          id: 'rent',
          ask: '莉莉，你这个店月租金多少？',
          vague: '“两万五，网红街标配！贵是贵，但出片啊，值！”',
          options: [
            { label: '1.8万/月', correct: false, reveal: '没这么便宜，网红街的溢价她没否认' },
            { label: '2.5万/月', correct: true,  reveal: '2.5万/月属实——租金不是最要命的，往下看' },
            { label: '3.2万/月', correct: false, reveal: '没这么高，她的房租在吹牛方面难得诚实' },
          ],
        },
        {
          id: 'sales',
          ask: '那一天营业额能做多少？',
          vague: '“一天三四千吧，稳得很！周末探店的宝子更多！”',
          options: [
            { label: '900元/日', correct: true,  reveal: '真实日流水 900 元：20 个客人 × 45 元，一个不多' },
            { label: '2200元/日', correct: false, reveal: '那是她把“理想值”打了折，还是虚的' },
            { label: '3800元/日', correct: false, reveal: '这店开业以来就没见过这个数' },
          ],
        },
        {
          id: 'decor',
          ask: '装修投了多少？',
          vague: '“也就几十万吧，没细算，反正要出片！设计费就小二十万呢。”',
          options: [
            { label: '30万', correct: false, reveal: '再加一位数差不多' },
            { label: '50万', correct: false, reveal: '还是说少了，她的“没细算”是真没数' },
            { label: '80万', correct: true,  reveal: '整整 80 万！日均 20 个客人，单客分摊装修成本 4 万元' },
          ],
        },
      ],
      neighbor: {
        name: '隔壁老王',
        emoji: '📞',
        title: '电话录音',
        texts: [
          '她家咖啡是不错，但一天就那二十来个人，八十万装修？我算了下，得卖到下个世纪。',
          '一天到晚听她在店里喊“三二一，开始”，正经客人来了都没人招呼。',
        ],
        reveal: '🔍 发现隐藏矛盾：营业额和店主的“营业时间”对不上！',
      },
      danmaku: [
        '5000粉丝敢花80万装修',
        '45块一杯，抢钱还送咖啡',
        '日流水900，不如楼下煎饼摊',
        '拍视频4小时，管店2小时，懂',
        '单客装修4万块，壕无人性',
        '滤镜碎了一地',
      ],
    },

    findFaults: {
      sceneRef: 'coffee-scene',
      sceneSize: { w: 750, h: 750 },
      sceneTheme: { style: 'coffee', accent: '#6f4e37', sign: '莉莉咖啡 · 出片圣地' },
      zones: [
        { id: 'sign',    x: 30, y: 25,  w: 690, h: 100, icon: '🚪', label: '门头 · 霓虹招牌', bg: '#2b241c' },
        { id: 'counter', x: 30, y: 145, w: 690, h: 140, icon: '☕', label: '吧台 · 价目表', bg: '#35291d' },
        { id: 'photo',   x: 30, y: 315, w: 690, h: 160, icon: '📸', label: '打卡墙 · 直播角', bg: '#2d2a1e', reveal: 'vanity', revealHint: '你看了眼直播角的数据屏：5000粉丝，到店转化不足1%……' },
        { id: 'seat',    x: 30, y: 505, w: 690, h: 110, icon: '🪑', label: '就餐区', bg: '#26221a' },
        { id: 'store',   x: 30, y: 645, w: 690, h: 80,  icon: '📦', label: '储物间', bg: '#211d17' },
      ],
      faults: [
        { id: 'decor',  x: 180, y: 410, title: '过度装修', desc: '总投入 80 万（设计费就 20 万），日均客流仅 20 人，单客分摊装修成本高达 4 万元。', data: '80万', panelLabel: '装修投入', panelNormal: '20万内' },
        { id: 'price',  x: 600, y: 215, title: '定价过高', desc: '客单价 45 元，周边咖啡均价 25 元，没有支撑溢味的品牌力和复购。', data: '45元', panelLabel: '客单价', panelNormal: '25元' },
        { id: 'focus',  x: 300, y: 685, title: '本末倒置', desc: '每天拍视频、剪视频 4 小时，管店 2 小时；储物间原料放到过期都没人理。', data: '4h拍/2h管', panelLabel: '时间分配', panelNormal: '以店为本' },
        // 隐藏错误点：先点击打卡墙 · 直播角（photo 分区）解锁
        { id: 'vanity', x: 520, y: 395, title: '流量幻觉', desc: '5000 抖音粉丝 ≠ 5000 顾客：视频播放量几万，到店转化率不足 1%。', data: '转化<1%', panelLabel: '粉丝到店率', panelNormal: '≥5%', hidden: true, unlockBy: 'photo' },
      ],
    },

    connectPairs: [
      { leftId: 'decor',  rightId: 'percap',    left: '💅 装修投入80万', right: '单客分摊装修成本4万元' },
      { leftId: 'price',  rightId: 'rentshort', left: '🏷️ 客单价45元', right: '日收900元，连房租都喂不饱' },
      { leftId: 'vanity', rightId: 'conv1',     left: '📱 5000粉丝当资本', right: '粉丝到店转化率不足1%' },
    ],

    firstAid: {
      prompt: '侦探，再给我半年时间！我粉丝马上就破万了，到时候一条探店视频就能回本，对吧？你帮我想想办法嘛！',
      options: [
        { tag: 'A', label: '降价到25元，拉回客流', correct: false, why: '降价能拉客，但80万装修成本还在，亏得更快；你的品牌力也撑不起性价比路线' },
        { tag: 'B', label: '持续运营，用时间分摊装修成本', correct: false, why: '日收900元连房租都覆盖不了，时间不是你的朋友，资金链断裂才是你的结局' },
        { tag: 'C', label: '忍痛转让，承认失败', correct: true, why: '正确！80万已经沉没，不要再往里填了——网红梦和生意，从来是两回事' },
      ],
    },

    result: {
      baseLoss: 180,
      weights: { find: 20, link: 15, rescue: 25, ask: 4, patience: 6 },
      achievements: [
        { min: 11, title: '🏆 滤镜粉碎者' },
        { min: 8,  title: '🧠 人间清醒' },
        { min: 5,  title: '📸 点赞之交' },
        { min: 2,  title: '☁️ 云探店选手' },
        { min: 0,  title: '🐷 榜一大哥' },
      ],
      shareText: '我在《餐饮大侦探》里帮莉莉诊断出 {flaws} 个致命错误、止损 {loss} 万！得分 {score}/{total}，5000粉丝也救不了的店！',
    },
  },

  /* ===================================================================
   * 关卡 5：快餐店（辛苦人 · 急救正确项是“取消满减”，打破永远选止损）
   * =================================================================== */
  {
    id: 'fastfood',
    title: '快餐店避坑诊断',
    subtitle: '老李的写字楼快餐 · 单量越多亏得越多',
    icon: '🍔',
    shopType: '快餐店',
    chapter: 1,
    difficulty: 2,
    patienceMax: 5,
    retryable: false,
    persona: { type: 'honest', tag: '辛苦人', catchphrase: '订单越多越好啊！' },
    unlockCondition: { type: 'complete', id: 'coffee' },

    interview: {
      owner: {
        name: '老李',
        emoji: '👨‍🍳',
        age: 35,
        catchphrase: '订单越多越好啊！',
        intro: '侦探，你帮我看看：我外卖一天八九十单，单量杠杠的，怎么月底一算账还是亏的？是不是平台搞我？',
        camHint: '店主把手机架在外卖打印机旁边…',
        realData: { rent: '1.8万/月', dine: '1500元/日(堂食)', waimai: '2800元/日(外卖)', fee: '平台扣点23%', net: '外卖净利-8%' },
        bluff:    { waimai: '全是利润', fee: '扣点十几吧', net: '肯定赚啊' },
      },
      envClues: [
        { id: 'bill',    icon: '🧾', label: '平台扣点账单', desc: '23% 的扣点条目密密麻麻', faultId: 'fee' },
        { id: 'printer', icon: '🖨️', label: '外卖单打印机', desc: '小票堆成山，没一张算过净利', faultId: 'promo' },
        { id: 'poster',  icon: '📢', label: '满30减15海报', desc: '相当于五折硬亏', faultId: 'promo' },
        { id: 'lunch',   icon: '🍚', label: '午市堂食排队', desc: '唯一真正赚钱的业务', faultId: null },
      ],
      maxClues: 3,
      questions: [
        {
          id: 'fee',
          ask: '老李，外卖平台扣点多少？',
          vague: '“扣点……十几吧，正常水平，大家都这样。”',
          options: [
            { label: '23%', correct: true,  reveal: '实测 23%！已经超过餐饮外卖的生死线（20%）' },
            { label: '15%', correct: false, reveal: '这是你以为的“正常水平”，不是真实水平' },
            { label: '18%', correct: false, reveal: '还是低了，把平台服务费、配送费全摊开再看' },
          ],
        },
        {
          id: 'waimai',
          ask: '日均外卖营业额多少？',
          vague: '“一天三四千呢，那可都是利润！”',
          options: [
            { label: '3000元/日', correct: false, reveal: '高了点，他连流水都记不牢' },
            { label: '2800元/日', correct: true,  reveal: '流水 2800 元不假——但“都是利润”？扣点加满减，做一单亏一单' },
            { label: '4200元/日', correct: false, reveal: '吹牛，他打印机没这么忙' },
          ],
        },
        {
          id: 'net',
          ask: '外卖到底赚不赚钱？',
          vague: '“赚不赚？肯定赚啊，订单那么多摆在那儿！”',
          options: [
            { label: '每单赚5元', correct: false, reveal: '要是真赚，他月底能对着账本唉声叹气？' },
            { label: '每单亏5元', correct: true,  reveal: '实测每单净亏 5 元、净利率 -8%——单量是泡沫，账才是真的' },
            { label: '不赚不亏', correct: false, reveal: '没这么温和，满30减15是实打实在倒贴' },
          ],
        },
      ],
      neighbor: {
        name: '隔壁老王',
        emoji: '📞',
        title: '电话录音',
        texts: [
          '他那“满30减15”是我见过最狠的，我中午点了一单，32块的东西我实付17，我心想这老李图啥？',
          '他到现在还以为单量多就是赚钱，我都不好意思点破他。',
        ],
        reveal: '🔍 发现隐藏矛盾：单量 ≠ 利润，每单都在倒贴！',
      },
      danmaku: [
        '满30减15，老板做慈善',
        '23%扣点+五折，双重暴击',
        '单量越多亏得越多，流水幻觉',
        '每单亏5块，一天白送出去四百',
        '只有堂食在养外卖，惨',
        '老李快醒醒，订单不是钱',
      ],
    },

    findFaults: {
      sceneRef: 'fastfood-scene',
      sceneSize: { w: 750, h: 750 },
      sceneTheme: { style: 'fastfood', accent: '#e63946', sign: '老李快餐 · 满30减15' },
      zones: [
        { id: 'sign',    x: 30, y: 25,  w: 690, h: 90,  icon: '🚪', label: '门头 · 满减海报', bg: '#3d1f22' },
        { id: 'counter', x: 30, y: 145, w: 690, h: 150, icon: '💵', label: '堂食收银 · 出餐口', bg: '#47262a' },
        { id: 'printer', x: 30, y: 325, w: 330, h: 170, icon: '🖨️', label: '外卖单打印机', bg: '#33262e', reveal: 'promo', revealHint: '你撕下一叠外卖小票细算：满30减15叠加23%扣点，每单净亏5元……' },
        { id: 'seat',    x: 390, y: 325, w: 330, h: 170, icon: '🪑', label: '堂食区', bg: '#3a2a24' },
        { id: 'kitchen', x: 30, y: 525, w: 690, h: 200, icon: '🍳', label: '后厨 · 冰箱', bg: '#2e2226' },
      ],
      faults: [
        { id: 'fee',    x: 180, y: 220, title: '平台扣点吞噬利润', desc: '扣点 23% 已是行业高位，叠加配送费、推广费，每单先被平台切走近三成。', data: '23%', panelLabel: '平台扣点', panelNormal: '≤20%' },
        { id: 'promo',  x: 180, y: 410, title: '满减活动失控', desc: '“满30减15”相当于 5 折：扣点 23% + 满减 15 元，客单 32 元到手不足 10 元，食材包装成本 15 元——每单净亏 5 元。', data: '满30减15', panelLabel: '活动力度', panelNormal: '微利引流', hidden: true, unlockBy: 'printer' },
        { id: 'nomath', x: 560, y: 410, title: '只看流水不看净利', desc: '记账本只记“单量”和“流水”，从没有一个“净利”栏——亏到哪一天都不知道。', data: '无净利账', panelLabel: '记账方式', panelNormal: '单单算净利' },
        { id: 'cross',  x: 375, y: 620, title: '堂食补贴外卖', desc: '堂食（净利率约 15%）赚的钱全在填外卖的坑，整体利润被越拖越垮。', data: '利润互贴', panelLabel: '盈亏结构', panelNormal: '各自核算' },
      ],
    },

    connectPairs: [
      { leftId: 'fee',    rightId: 'lose5',     left: '🧾 平台扣点23%', right: '每单外卖净亏5元' },
      { leftId: 'promo',  rightId: 'moreorder', left: '📉 满30减15活动', right: '订单越多，亏损越大' },
      { leftId: 'cross',  rightId: 'dinepay',   left: '💔 堂食利润贴外卖', right: '赚钱的生意被亏钱的拖垮' },
    ],

    firstAid: {
      prompt: '侦探，取消满减我不是没想过，可一取消单量肯定从八九十掉到二三十，看着订单往下掉，我这心里跟猫抓一样！你再想想，有没有又能保单量、又能赚钱的办法？',
      options: [
        { tag: 'A', label: '取消满减，缩小外卖占比', correct: true, why: '正确！先止血再求生——23%扣点是硬成本，不赚钱的订单再多也是毒药。单量漂亮，不如钱包漂亮' },
        { tag: 'B', label: '加大外卖推广，用规模摊薄成本', correct: false, why: '规模越大亏得越多！每单 -5 元的生意，做一万单亏五万' },
        { tag: 'C', label: '提高外卖价格，维持满减', correct: false, why: '提价订单量暴跌，评分还会被刷下来，两头挨打' },
      ],
    },

    result: {
      baseLoss: 120,
      weights: { find: 15, link: 10, rescue: 20, ask: 3, patience: 6 },
      achievements: [
        { min: 11, title: '🏆 算账高手' },
        { min: 8,  title: '🧾 流水清醒了' },
        { min: 5,  title: '💸 糊涂账' },
        { min: 2,  title: '☁️ 云开店选手' },
        { min: 0,  title: '🐷 满减侠' },
      ],
      shareText: '我在《餐饮大侦探》里帮老李诊断出 {flaws} 个致命错误、止损 {loss} 万！得分 {score}/{total}，外卖单量陷阱你躲得开吗？',
    },
  },

  /* ===================================================================
   * 关卡 6：饺子馆（赵姨 · 家族管理失控）
   * =================================================================== */
  {
    id: 'dumpling',
    title: '饺子馆避坑诊断',
    subtitle: '赵姨的二十年老馆子 · 儿子接班的烦恼',
    icon: '🥟',
    shopType: '饺子馆',
    chapter: 2,
    difficulty: 2,
    patienceMax: 4,
    retryable: true,
    persona: { type: 'elder', tag: '老掌柜', catchphrase: '现在的年轻人啊……' },
    unlockCondition: { type: 'complete', id: 'fastfood' },

    interview: {
      owner: {
        name: '赵姨',
        emoji: '👵',
        age: 60,
        catchphrase: '现在的年轻人啊……',
        intro: '侦探，我这饺子馆开了二十年，街坊都认我这手艺。自打去年让我儿子接手，钱就哗哗地往外流，我说他两句他就嫌我老套……',
        camHint: '赵姨把镜头转向在柜台打游戏的儿子…',
        realData: { rent: '1.5万/月', sales: '8万/月(原12万)', food: '成本率45%(原32%)', loss: '月亏3万' },
        bluff:    { sales: '跟以前差不多', food: '物价涨了嘛', loss: '没亏，就是少赚' },
      },
      envClues: [
        { id: 'book',   icon: '📒', label: '翻烂的老账本', desc: '赵姨时代的账，笔笔清楚', faultId: 'account' },
        { id: 'order',  icon: '📦', label: '高价冻肉堆满仓', desc: '进价签比市场价高一截', faultId: 'kickback' },
        { id: 'staff',  icon: '🧑‍🍳', label: '松散的后厨', desc: '包饺子的人边刷手机边干活', faultId: 'staff' },
        { id: 'sign6',  icon: '🏮', label: '褪色的老店招牌', desc: '二十年的口碑，被半年败掉', faultId: null },
      ],
      maxClues: 3,
      questions: [
        {
          id: 'sales',
          ask: '赵姨，现在一个月营业额大概多少？',
          vague: '“营业额？跟以前差不多吧，十二三万总是有的。”（儿子在旁边喊：行情不好，大家都一样！）',
          options: [
            { label: '12万/月', correct: false, reveal: '那是赵姨巅峰时期的老黄历' },
            { label: '8万/月',  correct: true,  reveal: '现在只有 8 万，比巅峰少了三分之一——儿子嘴里是“行情不好”' },
            { label: '10万/月', correct: false, reveal: '没到，差得还远' },
          ],
        },
        {
          id: 'food',
          ask: '食材成本率现在是多少？',
          vague: '“成本是比以前贵了点，物价上涨嘛，很正常。”',
          options: [
            { label: '32%', correct: false, reveal: '那是赵姨时代的数字，确实漂亮' },
            { label: '45%', correct: true,  reveal: '45%！三年物价涨不了 13 个点——多出去的钱进了谁的口袋？' },
            { label: '38%', correct: false, reveal: '没这么乐观，账面比这个难看' },
          ],
        },
        {
          id: 'loss',
          ask: '那现在一个月是赚是亏？',
          vague: '“亏什么亏，就是少赚点，养老的钱总够的。”',
          options: [
            { label: '月盈利2万', correct: false, reveal: '那是接班前的老皇历' },
            { label: '月亏损3万', correct: true,  reveal: '月亏 3 万！从 +2 万到 -3 万，一年 60 万的落差，这叫“少赚点”？' },
            { label: '盈亏平衡', correct: false, reveal: '账本上要真打平，赵姨能愁成这样？' },
          ],
        },
      ],
      neighbor: {
        name: '老街坊王大爷',
        emoji: '📞',
        title: '电话录音',
        texts: [
          '赵姨包的饺子我吃了二十年，自打她儿子把馅改了，肉少了皮厚了，我们老邻居都不怎么去了。',
          '还有啊，那个天天来送肉的小个子，是她儿子媳妇的亲弟弟——进价比菜市场贵一大截，我们都不敢说。',
        ],
        reveal: '🔍 发现隐藏矛盾：采购价虚高，采购员是“自己人”！',
      },
      danmaku: [
        '小舅子采购，经典剧情',
        '成本率32涨到45，差价进谁口袋了',
        '老招牌被半年败光，心疼赵姨',
        '账实不符，懂的都懂',
        '改配方降本？那是降命',
        '家族企业的通病，外人没法管',
      ],
    },

    findFaults: {
      sceneRef: 'dumpling-scene',
      sceneSize: { w: 750, h: 750 },
      sceneTheme: { style: 'dumpling', accent: '#d9a441', sign: '赵姨饺子馆 · 二十年老味' },
      zones: [
        { id: 'sign',    x: 30, y: 25,  w: 690, h: 90,  icon: '🏮', label: '门头 · 老招牌', bg: '#3a2c1c' },
        { id: 'hall',    x: 30, y: 145, w: 690, h: 180, icon: '🥟', label: '大堂 · 餐桌', bg: '#453522' },
        { id: 'kitchen', x: 30, y: 355, w: 690, h: 180, icon: '🍳', label: '后厨 · 操作台', bg: '#3d2f20' },
        { id: 'ledger',  x: 30, y: 565, w: 330, h: 160, icon: '📒', label: '账台 · 采购台账', bg: '#2f2a1e', reveal: 'kickback', revealHint: '你翻开采购台账：五花肉进价比市场高 40%，供应商签字栏是个陌生的名字……' },
        { id: 'store',   x: 390, y: 565, w: 330, h: 160, icon: '📦', label: '储物间', bg: '#34291c' },
      ],
      faults: [
        { id: 'staff',      x: 180, y: 445, title: '员工懒散', desc: '赵姨时代 3 个人包的量，现在 5 个人还天天喊忙；边刷手机边干活，出餐慢、口味飘。', data: '5人', panelLabel: '后厨人数', panelNormal: '3人' },
        { id: 'succession', x: 560, y: 240, title: '接班瞎改革', desc: '儿子把招牌馅料“降本”改版，又盲目上会员充值，老客流失，月流水从 12 万掉到 8 万。', data: '12万→8万', panelLabel: '月营业额', panelNormal: '稳定12万' },
        { id: 'account',    x: 560, y: 645, title: '账目对不上', desc: '账面原料支出和实际销量对不上，每月差出近万元——赵姨的旧账本和儿子的新账各说各话。', data: '差1万/月', panelLabel: '账实差异', panelNormal: '账实相符' },
        // 隐藏错误点：先点击账台 · 采购台账（ledger 分区）解锁
        { id: 'kickback',   x: 180, y: 645, title: '采购回扣', desc: '采购单显示五花肉进价比市场高 40%，采购员是儿子的小舅子——多出去的 13 个点成本率，都喂了自家人。', data: '进价高40%', panelLabel: '采购价', panelNormal: '市场价', hidden: true, unlockBy: 'ledger' },
      ],
    },

    connectPairs: [
      { leftId: 'kickback',   rightId: 'costup',  left: '🥩 采购吃回扣', right: '成本率从32%飙到45%' },
      { leftId: 'account',    rightId: 'intored', left: '📒 账目对不上', right: '从月赚2万变成月亏3万' },
      { leftId: 'succession', rightId: 'churn',   left: '👶 儿子瞎改革', right: '出品不稳，老客流失' },
    ],

    firstAid: {
      prompt: '侦探，要不……我把店收回来自己干？可我这身子骨也盯不动了，你说该咋办？家里还有一大家子指着这店吃饭……',
      options: [
        { tag: 'A', label: '请职业经理人，家族退出日常运营', correct: true, why: '正确！二十年的招牌经不起亲情内耗——让专业的人管店，家人只管分红，采购必须招投标' },
        { tag: 'B', label: '赵姨重新出山，亲自盯店', correct: false, why: '治标不治本：她盯得了一时，盯不了长远，矛盾只会更激化' },
        { tag: 'C', label: '再给儿子半年时间慢慢学', correct: false, why: '每月亏 3 万，半年就是 18 万学费——老店的家底经不起这么交学费' },
      ],
    },

    result: {
      baseLoss: 150,
      weights: { find: 20, link: 15, rescue: 25, ask: 4, patience: 8 },
      achievements: [
        { min: 11, title: '🏆 家宅侦探' },
        { min: 8,  title: '🥟 金牌调解员' },
        { min: 5,  title: '📒 账目明白人' },
        { min: 2,  title: '☁️ 云开店选手' },
        { min: 0,  title: '🐷 小舅子本舅' },
      ],
      shareText: '我在《餐饮大侦探》里帮赵姨诊断出 {flaws} 个致命错误、止损 {loss} 万！得分 {score}/{total}，二十年的招牌差点败在自己人手里！',
    },
  },

  /* ===================================================================
   * 关卡 7：烧烤店（膨胀青年 · 扩张噩梦，隐藏“雇排队托”合同）
   * =================================================================== */
  {
    id: 'bbq',
    title: '烧烤店避坑诊断',
    subtitle: '小王的扩张噩梦 · 干就完了！',
    icon: '🍢',
    shopType: '烧烤店',
    chapter: 2,
    difficulty: 3,
    patienceMax: 4,
    retryable: true,
    persona: { type: 'arrogant', tag: '膨胀青年', catchphrase: '干就完了！' },
    unlockCondition: { type: 'complete', id: 'dumpling' },

    interview: {
      owner: {
        name: '小王',
        emoji: '🧑‍🦱',
        age: 28,
        catchphrase: '干就完了！',
        intro: '侦探，别整那些虚的！我一个烧烤摊一年就赚了 50 万，开 3 家分店那是手到擒来！你随便看，随便问！',
        camHint: '店主把镜头对准分店的“长队”…',
        realData: { main: '总店月利4万(原8万)', branch: '3家分店月亏8万', debt: '总负债90万', complain: '投诉率35%(原5%)' },
        bluff:    { main: '老样子，七八万', branch: '家家爆火', complain: '偶尔个把差评' },
      },
      envClues: [
        { id: 'notice', icon: '📋', label: '转让告示', desc: '两家分店门口贴着转让', faultId: 'expand' },
        { id: 'phone7', icon: '📱', label: '刷不完的差评', desc: '“肉是生的”“咸到发苦”霸屏', faultId: 'quality' },
        { id: 'iou',    icon: '📄', label: '一沓借款合同', desc: '总店的房产都抵押出去了', faultId: 'debt' },
        { id: 'queue',  icon: '🧍', label: '总店的长队照片', desc: '开业当天的“盛况”，排队的全是熟脸', faultId: null },
      ],
      maxClues: 3,
      questions: [
        {
          id: 'main',
          ask: '小王，总店现在一个月利润多少？',
          vague: '“总店？老样子，一个月七八万利润，稳！”',
          options: [
            { label: '8万/月', correct: false, reveal: '那是开分店前的老皇历，现在腰斩了' },
            { label: '4万/月', correct: true,  reveal: '只剩 4 万！人力物力全被分店抽走，总店被拖垮了' },
            { label: '6万/月', correct: false, reveal: '没到，分店像个抽水机一样吸总店的血' },
          ],
        },
        {
          id: 'branch',
          ask: '3 家分店现在经营得怎么样？',
          vague: '“分店？家家爆火！开业那三天排队排出两条街，你没看见？”',
          options: [
            { label: '月亏8万', correct: true,  reveal: '3 家合计月亏 8 万！开业三天后的“排队”，是花钱雇的' },
            { label: '月赚5万', correct: false, reveal: '要真赚，他能把总店房产抵押了？' },
            { label: '基本持平', correct: false, reveal: '没有“基本”，是血亏' },
          ],
        },
        {
          id: 'complain',
          ask: '各店投诉率怎么样？',
          vague: '“投诉？做生意哪有没差评的，个别而已。”',
          options: [
            { label: '5%',  correct: false, reveal: '那是他摆摊时代的老数据' },
            { label: '15%', correct: false, reveal: '没那么乐观，再翻一倍多' },
            { label: '35%', correct: true,  reveal: '35%！原来只有 5%，分店的串又咸又生，差评霸屏' },
          ],
        },
      ],
      neighbor: {
        name: '分店隔壁便利店老板',
        emoji: '📞',
        title: '电话录音',
        texts: [
          '分店开业那三天是壮观，三小时排队。那队伍里的都是熟面孔，一天 150 块管饭，我也去排了半天，嘿嘿。',
          '三天以后？门可罗雀！现在那三家店，两家在转让，一家改卖早餐了。',
        ],
        reveal: '🔍 发现隐藏矛盾：排队是雇的托，分店真实客流惨不忍睹！',
      },
      danmaku: [
        '一年赚50万敢连开3家分店',
        '开业排队是雇的托哈哈',
        '150一天管饭，我也想报名',
        '投诉率35%，品控塌方现场',
        '总店利润腰斩，喜闻乐见',
        '干就完了！完就完了',
      ],
    },

    findFaults: {
      sceneRef: 'bbq-scene',
      sceneSize: { w: 750, h: 750 },
      sceneTheme: { style: 'bbq', accent: '#c2571a', sign: '小王烧烤 · 干就完了' },
      zones: [
        { id: 'sign',   x: 30, y: 25,  w: 690, h: 90,  icon: '🚪', label: '门头 · 分店招牌', bg: '#33201a' },
        { id: 'yard',   x: 30, y: 145, w: 690, h: 180, icon: '🔥', label: '总店大院 · 烤炉', bg: '#3d2419' },
        { id: 'branch', x: 30, y: 355, w: 690, h: 160, icon: '🏚️', label: '分店照片墙 · 转让信息', bg: '#2c1e1c' },
        { id: 'office', x: 30, y: 545, w: 690, h: 180, icon: '🗄️', label: '办公室 · 杂物', bg: '#241d20', reveal: 'shills', revealHint: '你拉开办公桌抽屉，一份“排队人员服务合同”躺在最底下……' },
      ],
      faults: [
        { id: 'expand',  x: 180, y: 240, title: '盲目扩张', desc: '一年赚 50 万就敢连开 3 家分店、每家投入 30 万，管理半径根本够不着，品控、采购、服务全线崩盘。', data: '3家×30万', panelLabel: '扩张速度', panelNormal: '单店深耕' },
        { id: 'quality', x: 520, y: 435, title: '品控崩塌', desc: '投诉率从 5% 飙到 35%，分店的肉串又咸又生，点评区差评霸屏，老客集体流失。', data: '35%', panelLabel: '投诉率', panelNormal: '≤5%' },
        { id: 'debt',    x: 180, y: 630, title: '资金链断裂', desc: '3 家分店月亏 8 万，总店房产已抵押，总负债滚到 90 万——再撑半年连总店都得搭进去。', data: '负债90万', panelLabel: '总负债', panelNormal: '无抵押扩张' },
        // 隐藏错误点：先点击办公室（office 分区）解锁
        { id: 'shills',  x: 540, y: 640, title: '雇排队托造假', desc: '抽屉里的“排队人员服务合同”：每天 150 元/人管饭，开业三天的“火爆场面”全是买来的。', data: '150元/人/天', panelLabel: '排队成本', panelNormal: '真实客流', hidden: true, unlockBy: 'office' },
      ],
    },

    connectPairs: [
      { leftId: 'expand',  rightId: 'radius',  left: '🚀 盲目扩张3家分店', right: '管理半径跟不上，总店被拖垮' },
      { leftId: 'quality', rightId: 'badrep',  left: '🧂 品控崩塌', right: '投诉率35%，老客流失' },
      { leftId: 'debt',    rightId: 'debt90',  left: '💸 月亏8万硬扛', right: '总负债滚到90万' },
      { leftId: 'shills',  rightId: 'fakeline', left: '🎭 雇排队托', right: '假排队掩盖真客流' },
    ],

    firstAid: {
      prompt: '侦探你说，我要不要再借笔钱给分店搞波大促销？干就完了！总不能眼睁睁看着店砸手里吧？',
      options: [
        { tag: 'A', label: '再开一家旗舰店冲规模', correct: false, why: '负债 90 万还想加杠杆？这不是扩张，是给自己修坟' },
        { tag: 'B', label: '关掉分店，收缩回总店', correct: true, why: '正确！壮士断腕，关掉失血的分店，把总店的口碑和现金流救回来' },
        { tag: 'C', label: '给各店搞统一培训，先保店', correct: false, why: '病根是扩张本身，不是培训能解决的——三个烂摊子再标准也是三个烂摊子' },
      ],
    },

    result: {
      baseLoss: 190,
      weights: { find: 20, link: 15, rescue: 25, ask: 4, patience: 8 },
      achievements: [
        { min: 12, title: '🏆 扩张急刹车' },
        { min: 9,  title: '🧠 人间清醒' },
        { min: 6,  title: '🔥 烤炉守夜人' },
        { min: 3,  title: '☁️ 云开店选手' },
        { min: 0,  title: '🐷 排队托本托' },
      ],
      shareText: '我在《餐饮大侦探》里帮小王诊断出 {flaws} 个致命错误、止损 {loss} 万！得分 {score}/{total}，雇托排队的店你一眼能看穿吗？',
    },
  },

  /* ===================================================================
   * 关卡 8：日料店（海归理想派 · 高端定位失误）
   * =================================================================== */
  {
    id: 'sushi',
    title: '日料店避坑诊断',
    subtitle: '小刘的高端日料 · 空运来的理想',
    icon: '🍣',
    shopType: '日料店',
    chapter: 2,
    difficulty: 3,
    patienceMax: 4,
    retryable: true,
    persona: { type: 'idealist', tag: '理想派', catchphrase: '我们的食材都是空运的！' },
    unlockCondition: { type: 'complete', id: 'bbq' },

    interview: {
      owner: {
        name: '小刘',
        emoji: '🧑‍💼',
        age: 32,
        catchphrase: '我们的食材都是空运的！',
        intro: '侦探，我做的是品质！挪威三文鱼、北海道海胆，全部空运直达！你帮我看看，这么懂行的店，客人怎么就接不住呢？',
        camHint: '店主站在一堆空运食材箱前讲解…',
        realData: { rent: '6万/月(高端商场)', sales: '9万/月', labor: '7万/月', loss: '月亏4万', repeat: '复购率<10%' },
        bluff:    { sales: '十五六万', loss: '微亏，马上扭亏', repeat: '回头客很多' },
      },
      envClues: [
        { id: 'menu8', icon: '📋', label: '500元人均价目', desc: '同商场均价的三四倍', faultId: 'position' },
        { id: 'air',   icon: '✈️', label: '空运食材箱', desc: '运费和损耗比食材本身还烧钱', faultId: 'cost' },
        { id: 'pad',   icon: '📊', label: '平板里的商圈调研', desc: '周边人均消费最高才 120 元', faultId: 'bubble' },
        { id: 'box8',  icon: '🚪', label: '空着的包厢', desc: '周末晚上都坐不满一半', faultId: null },
      ],
      maxClues: 3,
      questions: [
        {
          id: 'sales',
          ask: '小刘，现在月营业额多少？',
          vague: '“流水？十五六万吧，懂行的客人还是多的。”',
          options: [
            { label: '15万/月', correct: false, reveal: '把他报的数字打个六折差不多' },
            { label: '9万/月',  correct: true,  reveal: '月流水只有 9 万，其中一大半是开业头两个月的猎奇客' },
            { label: '12万/月', correct: false, reveal: '没到，他的流水撑不起这个体面数' },
          ],
        },
        {
          id: 'loss',
          ask: '那现在一个月亏损多少？',
          vague: '“亏是亏一点，两个点三个点，马上扭亏。”',
          options: [
            { label: '2万/月', correct: false, reveal: '他嘴里的“两个点”是安慰自己的' },
            { label: '4万/月', correct: true,  reveal: '月亏 4 万！房租 6 万 + 人工 7 万 = 13 万固定成本，流水 9 万怎么算都是血亏' },
            { label: '6万/月', correct: false, reveal: '暂时还没亏到这么多——但照这个趋势快了' },
          ],
        },
        {
          id: 'repeat',
          ask: '客人复购率怎么样？',
          vague: '“回头客？很多啊，吃过都说好！”',
          options: [
            { label: '50%',      correct: false, reveal: '真有一半回头客，他能月亏 4 万？' },
            { label: '30%',      correct: false, reveal: '还是乐观了，这不是一线城市核心商圈' },
            { label: '不足10%',  correct: true,  reveal: '复购率不足 10%——尝鲜一次可以，谁天天吃 500 块的工作餐？' },
          ],
        },
      ],
      neighbor: {
        name: '同商场火锅店店长',
        emoji: '📞',
        title: '电话录音',
        texts: [
          '我们店人均 120，已经是这条街的天花板了。他开 500 人均的日料？我们全商场都等着看。',
          '上个月在他家办会员的，这个月全跑我们这办储值卡了——你说他的复购能有多少？',
        ],
        reveal: '🔍 发现隐藏矛盾：商圈人均天花板 120 元，500 元定价是在真空里做生意！',
      },
      danmaku: [
        '人均500，二线城市怎么吃',
        '空运的是智商税吧',
        '月亏4万还在谈品质',
        '复购不足10%，尝鲜党罢了',
        '周边人均天花板120，降维打击',
        '理想主义者的钱包先空了',
      ],
    },

    findFaults: {
      sceneRef: 'sushi-scene',
      sceneSize: { w: 750, h: 750 },
      sceneTheme: { style: 'sushi', accent: '#3d5a80', sign: '海之鲜 · 空运日料' },
      zones: [
        { id: 'sign',     x: 30, y: 25,  w: 690, h: 90,  icon: '🚪', label: '门头 · 木质招牌', bg: '#1d2433' },
        { id: 'counter8', x: 30, y: 145, w: 690, h: 160, icon: '🍣', label: '板前 · 吧台', bg: '#232c3d' },
        { id: 'box',      x: 30, y: 335, w: 690, h: 150, icon: '✈️', label: '空运食材 · 冷柜', bg: '#1f2937' },
        { id: 'seat8',    x: 30, y: 515, w: 690, h: 100, icon: '🛋️', label: '包厢 · 空座', bg: '#242c3a' },
        { id: 'survey',   x: 30, y: 645, w: 690, h: 80,  icon: '📊', label: '平板 · 商圈调研', bg: '#1b2330', reveal: 'bubble', revealHint: '你拿起平板看了眼商圈调研：周边餐饮人均最高 120 元（某大牌火锅）……' },
      ],
      faults: [
        { id: 'position', x: 180, y: 225, title: '高端定位失误', desc: '人均 500 元在二线城市纯属真空定价，目标客群约等于零，开业猎奇潮一过立刻断流。', data: '人均500元', panelLabel: '客单价', panelNormal: '150-200元' },
        { id: 'cost',     x: 540, y: 225, title: '成本倒挂', desc: '房租 6 万 + 人工 7 万 = 13 万固定成本，月流水才 9 万——还没算食材就倒贴 4 万/月。', data: '月亏4万', panelLabel: '月利润', panelNormal: '盈利' },
        { id: 'repeat',   x: 180, y: 565, title: '复购率崩塌', desc: '复购率不足 10%，包厢周末都坐不满一半：没有回头客的高端店，只是一次性景点。', data: '<10%', panelLabel: '复购率', panelNormal: '≥30%' },
        // 隐藏错误点：先点击平板 · 商圈调研（survey 分区）解锁
        { id: 'bubble',   x: 540, y: 685, title: '需求幻觉', desc: '他自己做的商圈调研写着：周边餐饮人均消费最高 120 元（某大牌火锅）——数据都摆在这，他选择不看。', data: '周边人均120元', panelLabel: '商圈人均', panelNormal: '定价500元', hidden: true, unlockBy: 'survey' },
      ],
    },

    connectPairs: [
      { leftId: 'position', rightId: 'lowflow',   left: '🎎 人均500元定位', right: '客流稀少，月流水仅9万' },
      { leftId: 'cost',     rightId: 'burn4',     left: '🏢 固定成本13万/月', right: '每月倒贴4万，存款见底' },
      { leftId: 'repeat',   rightId: 'noRepeat',  left: '🔁 复购率不足10%', right: '尝鲜客一去不返' },
    ],

    firstAid: {
      prompt: '侦探，要不我咬牙再撑撑？品质一降，这家店就没有灵魂了……你帮我想个既保住格调、又能活下去的法子？',
      options: [
        { tag: 'A', label: '人均降到150-200元，调整定位', correct: true, why: '正确！先活下去再谈格调——用商圈调研数据定价，做轻奢简餐而不是“空运信仰”' },
        { tag: 'B', label: '坚持高端，等懂行的客人', correct: false, why: '数据都告诉你客群≈0 了，再等下去只会等到房东的腾退通知' },
        { tag: 'C', label: '再砸30万办高端品鉴会', correct: false, why: '拿最后的老本给错误的定位办葬礼，排场再大也是葬礼' },
      ],
    },

    result: {
      baseLoss: 160,
      weights: { find: 20, link: 15, rescue: 25, ask: 4, patience: 8 },
      achievements: [
        { min: 11, title: '🏆 定位大师' },
        { min: 8,  title: '🍣 清醒的理想派' },
        { min: 5,  title: '✈️ 空运回收员' },
        { min: 2,  title: '☁️ 云开店选手' },
        { min: 0,  title: '🐷 大冤种会员' },
      ],
      shareText: '我在《餐饮大侦探》里帮小刘诊断出 {flaws} 个致命错误、止损 {loss} 万！得分 {score}/{total}，人均500的日料你敢接盘吗？',
    },
  },

  /* ===================================================================
   * 关卡 9：网红店（流量信徒 · 500万播放的泡沫）
   * =================================================================== */
  {
    id: 'viral',
    title: '网红店避坑诊断',
    subtitle: '大鹏的榴莲鸡 · 500万播放的泡沫',
    icon: '🐔',
    shopType: '网红店',
    chapter: 2,
    difficulty: 3,
    patienceMax: 4,
    retryable: true,
    persona: { type: 'influencer', tag: '流量信徒', catchphrase: '只要火了就行！' },
    unlockCondition: { type: 'complete', id: 'sushi' },

    interview: {
      owner: {
        name: '大鹏',
        emoji: '🧑‍🎤',
        age: 29,
        catchphrase: '只要火了就行！',
        intro: '侦探！我那个“XX榴莲鸡”的视频，500 万播放！开业三天排队三小时！这就是流量时代的打法，你学不来的！',
        camHint: '店主循环播放那条爆款视频…',
        realData: { first: '首月流水60万', third: '第3月流水8万', repeat: '复购率5%', debt: '欠供应商30万' },
        bluff:    { third: '稳定50万', repeat: '回头客一大堆', debt: '赊账是行业惯例' },
      },
      envClues: [
        { id: 'neon',   icon: '🌈', label: '满墙打卡装饰', desc: '霓虹灯比客人还多', faultId: 'hype' },
        { id: 'due',    icon: '📄', label: '供应商催款单', desc: '30 万欠款，贴满收银台', faultId: 'debt9' },
        { id: 'rig',    icon: '🎥', label: '专业拍摄设备', desc: '比后厨的灶具还齐全', faultId: 'mcn' },
        { id: 'table9', icon: '🪑', label: '空荡荡的大堂', desc: '饭点坐不满三分之一', faultId: null },
      ],
      maxClues: 3,
      questions: [
        {
          id: 'first',
          ask: '大鹏，开业首月流水多少？',
          vague: '“首月？60 万！人气炸裂！这就是爆款的力量！”',
          options: [
            { label: '60万', correct: true,  reveal: '60 万是真的——但那是 500 万播放砸出来的猎奇消费，不是生意基本盘' },
            { label: '40万', correct: false, reveal: '他这次难得没吹牛，首月确实猛' },
            { label: '80万', correct: false, reveal: '他倒是想，排队三小时的承载力到不了这个数' },
          ],
        },
        {
          id: 'third',
          ask: '那现在（第三个月）月流水多少？',
          vague: '“现在？稳定 50 万左右吧，基本盘稳了！”',
          options: [
            { label: '8万',  correct: true,  reveal: '第 3 个月只剩 8 万！热度 90 天就退潮，他的“基本盘”是沙滩上的城堡' },
            { label: '50万', correct: false, reveal: '把首月的数拿来壮胆，这是流量信徒的经典话术' },
            { label: '30万', correct: false, reveal: '没这么体面，退潮比想象中快得多' },
          ],
        },
        {
          id: 'repeat',
          ask: '客人复购率多少？',
          vague: '“复购？回头客一大堆，吃过都说上头！”',
          options: [
            { label: '30%', correct: false, reveal: '要有这复购，第三个月能只剩 8 万？' },
            { label: '15%', correct: false, reveal: '还是高了，猎奇生意没有回头客' },
            { label: '5%',  correct: true,  reveal: '复购率仅 5%——猎奇是一锤子买卖，味道和性价比留不下人' },
          ],
        },
      ],
      neighbor: {
        name: '隔壁奶茶店店员',
        emoji: '📞',
        title: '电话录音',
        texts: [
          '开业前三天是壮观，三小时排队。第四天就露馅了——我数过，中午就坐了 6 桌。',
          '他那条爆款视频我知道，MCN 公司操盘的，一条 20 万。他跟我们老板吹牛的时候自己说的。',
        ],
        reveal: '🔍 发现隐藏矛盾：500 万播放是 20 万买来的，真实复购惨不忍睹！',
      },
      danmaku: [
        '500万播放是20万买的',
        '复购5%，一锤子买卖',
        '开业3天排队3小时，然后呢',
        '第3个月流水8万，泡沫破了',
        '欠供应商30万还在想买热搜',
        '流量退潮，一地鸡毛',
      ],
    },

    findFaults: {
      sceneRef: 'viral-scene',
      sceneSize: { w: 750, h: 750 },
      sceneTheme: { style: 'viral', accent: '#9b5de5', sign: 'XX榴莲鸡 · 抖音爆款' },
      zones: [
        { id: 'sign9',  x: 30, y: 25,  w: 690, h: 90,  icon: '🚪', label: '门头 · 霓虹灯牌', bg: '#2a1f3d' },
        { id: 'wall',   x: 30, y: 145, w: 690, h: 170, icon: '🌈', label: '打卡墙 · 霓虹装饰', bg: '#31224a' },
        { id: 'hall9',  x: 30, y: 345, w: 690, h: 190, icon: '🪑', label: '大堂 · 空桌', bg: '#251d38' },
        { id: 'office9', x: 30, y: 565, w: 690, h: 160, icon: '🗄️', label: '后厨 · 办公室', bg: '#201a30', reveal: 'mcn', revealHint: '你拉开办公室抽屉：一份 20 万的 MCN 推广合同，乙方要求“保证 500 万播放”……' },
      ],
      faults: [
        { id: 'hype',    x: 180, y: 230, title: '流量泡沫', desc: '500 万播放只换来一波猎奇客，复购率仅 5%——打卡经济不是餐饮，是行为艺术。', data: '复购5%', panelLabel: '复购率', panelNormal: '≥30%' },
        { id: 'product', x: 180, y: 440, title: '产品撑不住', desc: '点评区“拍照出片、口味一般、性价比低”刷屏：爆款可以炒出来，回头客炒不出来。', data: '口碑两极', panelLabel: '产品口碑', panelNormal: '口味复购' },
        { id: 'debt9',   x: 540, y: 440, title: '备货失控欠款', desc: '按首月 60 万流水备的货，热度一过全砸手里，欠供应商 30 万被催款。', data: '欠款30万', panelLabel: '应付账款', panelNormal: '按销定采' },
        // 隐藏错误点：先点击后厨 · 办公室（office9 分区）解锁
        { id: 'mcn',     x: 375, y: 645, title: '花钱买爆款', desc: '抽屉里的 MCN 合同：20 万推广费换“保底 500 万播放”——所谓爆红，是一场精心策划的购买。', data: '20万推广费', panelLabel: '获客成本', panelNormal: '自然流量', hidden: true, unlockBy: 'office9' },
      ],
    },

    connectPairs: [
      { leftId: 'hype',    rightId: 'tideout',   left: '🌊 500万播放泡沫', right: '热度90天退潮，月流水跌到8万' },
      { leftId: 'product', rightId: 'noSecond',  left: '🍗 产品撑不住', right: '复购率5%，吃过不再来' },
      { leftId: 'debt9',   rightId: 'owe30',     left: '📦 按爆款备货', right: '热度退去，欠供应商30万' },
      { leftId: 'mcn',     rightId: 'paidViral', left: '💳 20万买爆款', right: '流量是买的，真客寥寥无几' },
    ],

    firstAid: {
      prompt: '侦探，要不我再砸一笔钱把热度续上？只要再火一次，一切都回来了！你相信我，火过一次的店，还能再火！',
      options: [
        { tag: 'A', label: '再投20万买热搜，重回巅峰', correct: false, why: '同一个坑买两次门票？买来的流量退潮更快，下次只剩 4 万流水' },
        { tag: 'B', label: '砍掉花哨营销，重塑产品和口味', correct: true, why: '正确！从“打卡经济”回归“复购经济”——把 20 万推广费的一半拿去做产品和口碑，才睡得安稳' },
        { tag: 'C', label: '趁热开放加盟，收割下一波', correct: false, why: '自己还没活明白就去收加盟费，那是把亏损打包卖给别人，也是给自己挖坑' },
      ],
    },

    result: {
      baseLoss: 170,
      weights: { find: 20, link: 15, rescue: 25, ask: 4, patience: 8 },
      achievements: [
        { min: 12, title: '🏆 流量解构者' },
        { min: 9,  title: '🧠 人间清醒' },
        { min: 6,  title: '📉 退潮见证人' },
        { min: 3,  title: '☁️ 云开店选手' },
        { min: 0,  title: '🐷 MCN编外人员' },
      ],
      shareText: '我在《餐饮大侦探》里帮大鹏诊断出 {flaws} 个致命错误、止损 {loss} 万！得分 {score}/{total}，500万播放的泡沫你戳得破吗？',
    },
  },

  /* ===================================================================
   * 关卡 10：奶茶店二店之殇（小美回归 · 赌徒心态，与第1关剧情呼应）
   * =================================================================== */
  {
    id: 'milk2',
    title: '奶茶店二店避坑诊断',
    subtitle: '小美又回来了 · 这次她开了两家',
    icon: '🧋',
    shopType: '奶茶店',
    chapter: 2,
    difficulty: 3,
    patienceMax: 4,
    retryable: true,
    persona: { type: 'gambler', tag: '赌徒心态', catchphrase: '这次不一样！' },
    unlockCondition: { type: 'complete', id: 'viral' },

    interview: {
      owner: {
        name: '小美',
        emoji: '👩',
        age: 27,
        catchphrase: '这次不一样！',
        intro: '侦探……你还记得我吗？上次多亏了你！这次我吸取上次的教训了——我又开了第二家，位置更好！两家一起，肯定能把亏的赚回来！',
        camHint: '小美把镜头在两家店之间来回切换…',
        realData: { shop1: '一店月亏2万', shop2: '二店月亏3万', debt: '总负债45万', distance: '两店相距800米' },
        bluff:    { shop2: '二店马上盈利', debt: '40万不到', distance: '隔着两条街' },
      },
      envClues: [
        { id: 'map10',  icon: '🗺️', label: '墙上的城市地图', desc: '两家店的位置被红笔圈在一起', faultId: 'overlap' },
        { id: 'report', icon: '📋', label: '皱巴巴的选址报告', desc: '上次诊断的劝退意见就写在上面', faultId: 'sameSpot' },
        { id: 'salary', icon: '💸', label: '拖欠的工资条', desc: '两家店员工都在讨薪', faultId: 'spread' },
        { id: 'card',   icon: '🎫', label: '老客的会员卡', desc: '一店的老客，全被二店优惠券吸走', faultId: null },
      ],
      maxClues: 3,
      questions: [
        {
          id: 'distance',
          ask: '小美，两家店相距多远？',
          vague: '“两家店？隔着两条街呢，不冲突！”',
          options: [
            { label: '800米', correct: true,  reveal: '实测 800 米！外卖配送圈几乎完全重合，两家店在抢同一批客人' },
            { label: '2公里', correct: false, reveal: '没这么远，她的“两条街”是心理安慰' },
            { label: '3公里', correct: false, reveal: '真隔 3 公里反而没这病了' },
          ],
        },
        {
          id: 'debt',
          ask: '现在总负债多少？',
          vague: '“负债？四十万不到吧，我这次控制得很好！”',
          options: [
            { label: '45万', correct: true,  reveal: '总负债 45 万——比上次诊断时还多了 20 万，这就是“控制得很好”' },
            { label: '30万', correct: false, reveal: '那是开二店之前的数' },
            { label: '20万', correct: false, reveal: '她倒是想，账本不允许' },
          ],
        },
        {
          id: 'shop2',
          ask: '第二家店现在盈亏如何？',
          vague: '“二店？位置更好，马上就能盈利！”',
          options: [
            { label: '月亏3万', correct: true,  reveal: '二店月亏 3 万，比一店亏得还多——位置“更好”是她自己骗自己' },
            { label: '月赚1万', correct: false, reveal: '要真赚了，她说话能这么没底气？' },
            { label: '基本持平', correct: false, reveal: '两家店没有一家是平的' },
          ],
        },
      ],
      neighbor: {
        name: '二店隔壁老王',
        emoji: '📞',
        title: '电话录音',
        texts: [
          '她一店二店我都常去，一样的配方一样的价，外卖平台上两家店互相打价格战——笑死，亏的都是她自己的钱。',
          '上次你不是劝她别签二店那个铺子吗？她嘴上说好，转头就签了，就是你现在看到的这家。',
        ],
        reveal: '🔍 发现隐藏矛盾：二店选址就是上轮劝她别签的那个！左右手互搏！',
      },
      danmaku: [
        '小美又回来了哈哈',
        '同一个坑摔两次，专业',
        '800米开两家，自己卷自己',
        '负债45万，越陷越深',
        '赌徒心态：这次不一样！',
        '一店二店互相价格战，离谱',
      ],
    },

    findFaults: {
      sceneRef: 'milk2-scene',
      sceneSize: { w: 750, h: 750 },
      sceneTheme: { style: 'tea', accent: '#ff7bac', sign: '好喝到爆奶茶 · 二店' },
      zones: [
        { id: 'sign10', x: 30, y: 25,  w: 690, h: 90,  icon: '🚪', label: '门头 · 两店联动海报', bg: '#3d2333' },
        { id: 'shop1z', x: 30, y: 145, w: 330, h: 280, icon: '🧋', label: '一店 · 老店', bg: '#452a3a' },
        { id: 'shop2z', x: 390, y: 145, w: 330, h: 280, icon: '🧋', label: '二店 · 新店', bg: '#4a2d35' },
        { id: 'desk',   x: 30, y: 455, w: 690, h: 120, icon: '🗂️', label: '办公桌 · 经营资料', bg: '#342430' },
        { id: 'wall10', x: 30, y: 605, w: 690, h: 120, icon: '🗺️', label: '墙上地图 · 选址报告', bg: '#2e2130', reveal: 'sameSpot', revealHint: '你展开墙上那份皱巴巴的选址报告——正是上次你劝她别签的那个铺位编号……' },
      ],
      faults: [
        { id: 'overlap', x: 180, y: 285, title: '客群重叠', desc: '两家店相距仅 800 米，外卖配送圈几乎完全重合，会员和优惠券在左右手之间互相抢客。', data: '相距800米', panelLabel: '两店距离', panelNormal: '≥3公里' },
        { id: 'gambler', x: 540, y: 285, title: '赌徒心态', desc: '“第一家亏了，第二家一定能赚回来”——用开新店的债填旧店的坑，总负债从 25 万滚到 45 万。', data: '负债45万', panelLabel: '总负债', panelNormal: '及时止损' },
        { id: 'spread',  x: 180, y: 515, title: '资源摊薄', desc: '资金、人手一分为二，两家店都半死不活：工资开始拖欠，一店的老员工走了两个。', data: '双店均亏', panelLabel: '运营状态', panelNormal: '单店盈利' },
        // 隐藏错误点：先点击墙上地图 · 选址报告（wall10 分区）解锁
        { id: 'sameSpot', x: 540, y: 665, title: '同一个坑摔两次', desc: '二店选址就是上次诊断时你劝她别签的那个铺位——报告上你的批注还在，她偷偷还是签了。', data: '同一选址', panelLabel: '二店选址', panelNormal: '重新调研', hidden: true, unlockBy: 'wall10' },
      ],
    },

    connectPairs: [
      { leftId: 'overlap',  rightId: 'cannibal',  left: '🥊 800米内开二店', right: '左右手互搏，外卖单互相分流' },
      { leftId: 'gambler',  rightId: 'double25',  left: '🎰 亏了想翻本', right: '负债从25万滚到45万' },
      { leftId: 'spread',   rightId: 'bothweak',  left: '✂️ 资源一分为二', right: '两家都救不活，工资拖欠' },
    ],

    firstAid: {
      prompt: '侦探，要不……我把一店转让了？可那是我第一次开店的地方，我真舍不得。你再帮我算算，有没有两家都保住的法子？',
      options: [
        { tag: 'A', label: '再借钱开第三家摊薄成本', correct: false, why: '赌徒的标准动作：越亏越加注。45 万的教训还没交够学费吗？' },
        { tag: 'B', label: '关掉一家，集中资源救另一家', correct: true, why: '正确！止损不是认输，是把仅剩的弹药集中到还有救的阵地——45 万里至少能救回一半' },
        { tag: 'C', label: '两家都再撑半年看看', correct: false, why: '两家合计月亏 5 万，半年又是 30 万——“再撑撑”是赌徒最熟悉的遗言' },
      ],
    },

    result: {
      baseLoss: 160,
      weights: { find: 20, link: 15, rescue: 25, ask: 4, patience: 8 },
      achievements: [
        { min: 11, title: '🏆 回头是岸' },
        { min: 8,  title: '🧋 清醒的赌徒' },
        { min: 5,  title: '💸 止损练习生' },
        { min: 2,  title: '☁️ 云开店选手' },
        { min: 0,  title: '🐷 二店合伙人' },
      ],
      shareText: '我在《餐饮大侦探》里帮小美（对，又是她）诊断出 {flaws} 个致命错误、止损 {loss} 万！得分 {score}/{total}，这次你能拦住她吗？',
    },
  },
];

module.exports = LEVELS;
