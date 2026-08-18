/* =====================================================================
 * levels.js — 关卡数据（与逻辑完全分离）
 * ---------------------------------------------------------------------
 * 本文件只包含数据，不包含任何逻辑。
 * 通过 window.LEVELS 全局对象导出（也可改为 ES Module：export default LEVELS）。
 *
 * 如何新增关卡：
 *   在下方 LEVELS 数组中追加一个对象即可，无需改动 index.html 或 game.js。
 *   所有坐标使用 {x, y}（配合 w/h 为 {x, y, w, h}），参考 750x750 场景图，
 *   game.js 会按百分比缩放渲染。
 *
 * 本Demo仅供玩法验证和学习参考，所有角色、场景、数据均为虚构，不涉及任何商业用途
 * ===================================================================== */

window.LEVELS = [

  /* ===================================================================
   * 关卡 1：奶茶店（原有关卡，保留完整流程）
   * =================================================================== */
  {
    id: 'milk-tea',
    title: '奶茶店避坑诊断',
    subtitle: '糊涂店主 · 月月亏本还在硬扛',
    icon: '🧋',
    shopType: '奶茶店',
    difficulty: 1,                    // 难度（星数）
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
      // 360 环视线索（最多收藏 maxClues 条）
      envClues: [
        { id: 'starbucks', icon: '🏪', label: '隔壁瑞幸', desc: '同品类强敌，客流被分流' },
        { id: 'road',      icon: '🚧', label: '门口修路', desc: '施工挡路，外卖骑手都绕道' },
        { id: 'office',    icon: '🏢', label: '写字楼搬空', desc: '目标客群（白领）流失' },
        { id: 'waimai',    icon: '🛵', label: '外卖单稀少', desc: '线上渠道几乎没做起来' },
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
        text: '他呀？一天顶多卖 100 杯，一杯 18 块，流水撑死 <b style="color:var(--gold)">3000 块</b>，哪来的八千！<br>还有啊，我昨天路过瞄了一眼，他后厨挤了 <b style="color:var(--gold)">七八个人</b>，比客人还多！',
        reveal: '🔍 发现隐藏矛盾：营业额吹水、人工虚报！',
      },
    },

    /* ---------- 找茬阶段 ---------- */
    findFaults: {
      sceneRef: 'milk-tea-scene',
      sceneSize: { w: 750, h: 750 },
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
   * 关卡 2：面包房（新设计，含 1 个隐藏错误点）
   * =================================================================== */
  {
    id: 'bakery',
    title: '面包房避坑诊断',
    subtitle: '老张的商场负一层烘焙店',
    icon: '🍞',
    shopType: '烘焙店',
    difficulty: 2,
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
        { id: 'basement', icon: '🛗', label: '商场负一层', desc: '客流通达性极差' },
        { id: 'empty',    icon: '🏬', label: '商场本身冷清', desc: '整层没几家店开门' },
        { id: 'rival',    icon: '🏪', label: '楼上连锁面包', desc: '同类竞品截胡客流' },
        { id: 'coupon',   icon: '🎟️', label: '靠团购券引流', desc: '来的都是薅羊毛的' },
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
        text: '老张那店啊，在负一层犄角旮旯，我蹲了一整天数着，进店的 <b style="color:var(--gold)">撑死 30 个人</b>，他非说几百人！<br>晚上打烊我还看见他 <b style="color:var(--gold)">一箱一箱往垃圾桶扔面包</b>，那报废率，吓死人！',
        reveal: '🔍 发现隐藏矛盾：客流吹水、报废率惊人！',
      },
    },

    /* ---------- 找茬阶段 ---------- */
    findFaults: {
      sceneRef: 'bakery-scene',
      sceneSize: { w: 750, h: 750 },
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
];
