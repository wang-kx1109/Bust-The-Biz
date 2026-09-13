#!/usr/bin/env node
/* =====================================================================
 * scripts/sanity-game.js — 游戏状态机逻辑冒烟测试（node 可跑，无 wx）
 * ---------------------------------------------------------------------
 * 用法：node scripts/sanity-game.js
 * 覆盖：
 *  1. 奶茶关全对流程：得分 3+3+3+1=10，loss=0，下一关解锁面包
 *  2. 面包关全对流程：得分 12；隐藏点 unlockBy 流程
 *  3. 失败路径：5 次答错 → patience 0 → failed + stage=fail
 *  4. 连线语义：未选左列先点右列 → needLeft；错配扣耐心
 *  5. 结算退化：全错输入 → loss = baseLoss、最低成就
 *  6. 场景接口存在性（8 场景含 collection）
 *  7. patienceMax 按关卡配置（第二章 4 心）
 *  8. 追问机制（retryable 首错可再答）
 *  9. 勇哥提示卡 useHint（确定性 + 上限 2）
 *  10. 复活 revive（回 failedAt 阶段 +2 心，每关一次）
 *  11. 环视线索联动（clueGlowFaults）
 *  12. 成就 / 图鉴 / 侦探币（onComplete / addCoins / cards）
 * ===================================================================== */
const assert = require('assert');
// 小游戏是当前开发重心：校验 minigame 侧的状态机（与 miniprogram 侧同构）
const game = require('../minigame/js/core/state.js');

let pass = 0;
function ok(name) {
  pass++;
  console.log(`  ✓ ${name}`);
}

// 辅助：答对当前问题（寻找 correct 选项）
function answerAllCorrect(lv) {
  lv.interview.questions.forEach((q, i) => {
    const ci = q.options.findIndex(o => o.correct);
    const r = game.answerQuestion(i, ci);
    assert.strictEqual(r.correct, true, `题目 ${i} 应答对`);
  });
}

/* ---------- 1. 奶茶关全对流程 ---------- */
console.log('\n[1] 奶茶关 · 全对流程');
const mt = game.findLevel('milk-tea');
assert(game.start('milk-tea'), 'start 应成功');
assert.strictEqual(game.state.stage, 'ask', 'start 后应处于 ask');
assert.strictEqual(game.getStateView().maxScore, 10, '奶茶 maxScore=10');

// 三问全对
answerAllCorrect(mt);
assert.strictEqual(game.state.score, 3, '三问后得分 3');
assert.strictEqual(game.state.askCorrect, 3, 'askCorrect=3');

// 环视：收藏上限 3
assert.strictEqual(game.toggleClue('starbucks').saved, true);
assert.strictEqual(game.toggleClue('road').saved, true);
assert.strictEqual(game.toggleClue('office').saved, true);
assert.strictEqual(game.toggleClue('waimai').full, true, '超出 3 条应返回 full');
assert.deepStrictEqual(game.state.savedClues, ['starbucks', 'road', 'office'], '保存顺序');
game.toggleClue('starbucks'); // 取消一条再存新
assert.strictEqual(game.toggleClue('waimai').saved, true);

// 找茬三连
mt.findFaults.faults.forEach((f, i) => {
  assert.strictEqual(game.confirmFlaw(f.id).already, false, `找到 ${f.id}`);
});
assert.strictEqual(game.state.score, 6, '找茬后得分 6');
assert.strictEqual(game.confirmFlaw('rent').already, true, '重复找 same 不重复计分');

// 连线
mt.connectPairs.forEach((_, i) => {
  game.selectLeft(i);
  const r = game.selectRight(i);
  assert.strictEqual(r.correct, true, `连线 ${i} 应正确`);
});
assert(game.allConnected(), '应全部连线完成');
assert.strictEqual(game.state.score, 9, '连线后得分 9');

// 急救选 C（index 2）
assert.strictEqual(game.chooseRescue(2).correct, true);
assert.strictEqual(game.state.score, 10, '急救后得分 10');

// 结算
const res = game.computeResult();
assert.strictEqual(res.score, 10);
assert.strictEqual(res.maxScore, 10);
assert.strictEqual(res.achievement, '🏆 避坑天花板', '满分成就');
assert.strictEqual(res.loss, 0, '全对应止损至 0');
assert.strictEqual(res.recoveredTotal, 182, '奶茶全对挽回 182 万（3*20+3*15+25+3*4+5*8）');
assert(game.nextLevelId() === 'bakery', '奶茶通关后下一关应为面包');
game.completeLevel();
assert(game.isUnlocked('bakery'), '通关奶茶后面包解锁');
ok('奶茶全对：10分 / loss 0 / 成就 / 下一关解锁 全部正确');

/* ---------- 2. 面包关・隐藏点 + 全对 ---------- */
console.log('\n[2] 面包关 · 隐藏点 + 全对流程');
const bk = game.findLevel('bakery');
assert(game.start('bakery'), 'start 面包');
assert.strictEqual(game.getStateView().maxScore, 12, '面包 maxScore=12');

// 隐藏点：先点收银台才可见
assert.strictEqual(bk.findFaults.faults.find(f => f.id === 'loss').hidden, true);
let vis = game.visibleFaults().map(f => f.id);
assert(!vis.includes('loss'), '未解锁前 loss 不可见');
assert.strictEqual(game.tapZone('cash').revealed, true, '点收银台触发隐藏点');
vis = game.visibleFaults().map(f => f.id);
assert(vis.includes('loss'), '解锁后 loss 可见');
assert.strictEqual(game.confirmFlaw('loss').already, false, '可找到隐藏点');

// 其余三问全对
answerAllCorrect(bk);
assert.strictEqual(game.state.askCorrect, 3);

// 找其余错误
['location', 'pricing', 'area'].forEach(id => game.confirmFlaw(id));
assert.strictEqual(game.state.score, 7, '隐藏点1 + 问对3 + 找对3 = 7');

// 连线 4 对
for (let i = 0; i < bk.connectPairs.length; i++) {
  game.selectLeft(i);
  assert.strictEqual(game.selectRight(i).correct, true, `面包连线 ${i}`);
}
// 急救 C
assert.strictEqual(game.chooseRescue(2).correct, true);
assert.strictEqual(game.computeResult().score, 12, '面包满分 12');
assert.strictEqual(game.computeResult().loss, 0, '面包全对应止损至 0');
assert.strictEqual(game.computeResult().achievement, '🏆 烘焙界福尔摩斯');
ok('面包全对：隐藏点流程 + 12分 / loss 0 正确');

/* ---------- 3. 失败路径 ---------- */
console.log('\n[3] 失败路径（宁可答错，5 次后耐心归零）');
game.start('milk-tea');
const wrongOpt = mt.interview.questions[0].options.findIndex(o => !o.correct);
for (let i = 0; i < 5; i++) {
  const r = game.answerQuestion(0, wrongOpt); // answerQuestion 与 askStep 无关，可连续触发
  assert.strictEqual(r.correct, false, '应答错');
  if (i === 4) {
    assert.strictEqual(game.state.patience, 0, '耐心归零');
    assert.strictEqual(game.state.failed, true, 'failed=true');
    assert.strictEqual(game.state.stage, 'fail', 'stage=fail');
    assert.strictEqual(r.failed, true, '返回结果带 failed');
  }
}
ok('5 次答错 → 耐心0 / failed / stage=fail');

/* ---------- 4. 连线语义 ---------- */
console.log('\n[4] 连线语义');
game.start('milk-tea');
// 未选左列先点右列 → needLeft
assert.strictEqual(game.selectRight(1).needLeft, true, '未选左列先点右列 → needLeft');
// 选中左列 0
assert.strictEqual(game.selectLeft(0).selected, 0, 'selectLeft 选中');
// 错配右列 1 → 扣耐心
assert.strictEqual(game.selectRight(1).correct, false, '错配 correct=false');
assert.strictEqual(game.state.patience, 4, '错配扣耐心（5→4）');
// 正确配对 0 → 锁定（错配后选择已清空，需重新选中左列）
assert.strictEqual(game.selectLeft(0).selected, 0, '重新选中左列 0');
assert.strictEqual(game.selectRight(0).correct, true, '正确配对');
assert.strictEqual(game.state.score, 1, '正确配对 +1 分');
// 已锁定的左/右卡片应被忽略
assert.strictEqual(game.selectLeft(0).ignore, true, '选中已锁左列 → ignore');
assert.strictEqual(game.selectRight(0).locked, true, '点已锁右列 → locked');
ok('连线：needLeft / 错配扣耐心 / 正确锁定 / 锁定忽略');

/* ---------- 5. 结算退化 ---------- */
console.log('\n[5] 结算退化（不作为任何操作直接结算）');
game.start('milk-tea');
game.phoneVerified(); // 跳过 askStep 前进
const r0 = game.computeResult();
assert.strictEqual(r0.score, 0);
// 注意：耐心本身也是止损项（patience×8=40），不动手但耐心满 → 180-40=140
assert.strictEqual(r0.loss, 180 - 5 * 8, '零动作 → loss=baseLoss-耐心挽回=140');
assert.strictEqual(r0.achievement, '🐷 店主的同伙', '最低成就');
assert.strictEqual(r0.shareText.indexOf('140 万') > -1, true, 'shareText 已插值出止损');
ok('零动作 → loss=140 / 最低成就 / shareText 插值');

/* ---------- 6. 小游戏场景接口存在性 ---------- */
console.log('\n[6] 小游戏场景接口');
const SCENE_NAMES = ['select', 'ask', 'find', 'link', 'rescue', 'result', 'fail', 'collection'];
for (const name of SCENE_NAMES) {
  const scene = require(`../minigame/js/scenes/${name}.js`);
  assert(typeof scene.render === 'function', `${name} 缺少 render(ctx)`);
  assert(typeof scene.onTap === 'function', `${name} 缺少 onTap(x, y)`);
  assert(typeof scene.onEnter === 'function', `${name} 缺少 onEnter()`);
  if (scene.update !== undefined) assert(typeof scene.update === 'function', `${name}.update 应为函数或无`);
  ok(`${name}：render/onTap/onEnter 接口齐备`);
}

/* ---------- 7. 耐心上限按关卡配置 ---------- */
console.log('\n[7] 耐心上限 patienceMax（第一章 5 / 第二章 4）');
const dp = game.findLevel('dumpling');
assert(dp.retryable === true && dp.chapter === 2, 'dumpling 应为第二章追问关');
assert.strictEqual(dp.patienceMax, 4, 'dumpling patienceMax=4');
game.start('dumpling');
assert.strictEqual(game.state.patience, 4, 'start 后耐心 = patienceMax');
assert.strictEqual(game.getStateView().patienceMax, 4, '视图带 patienceMax');
game.start('milk-tea');
assert.strictEqual(game.state.patience, 5, 'milk-tea 默认 5 心');
ok('patienceMax 按关卡生效，默认 5');

/* ---------- 8. 追问机制（retryable） ---------- */
console.log('\n[8] 追问机制（首错扣耐心可再答，再错推进）');
game.start('dumpling');
const dpWrong = dp.interview.questions[0].options.findIndex(o => !o.correct);
const dpRight = dp.interview.questions[0].options.findIndex(o => o.correct);
let rr = game.answerQuestion(0, dpWrong);
assert.strictEqual(rr.correct, false, '首答错');
assert.strictEqual(rr.retry, true, 'retryable 首错应允许追问');
assert.strictEqual(game.state.patience, 3, '首错扣 1（4→3）');
assert.strictEqual(game.state.score, 0, '答错不得分');
rr = game.answerQuestion(0, dpRight);
assert.strictEqual(rr.correct, true, '追问答对应得分');
assert.strictEqual(rr.retry, false, '答对无追问标记（retry:false）');
assert.strictEqual(game.state.score, 1, '追问答对 +1');
// 第二题：连错两次 → 第二次 retry:false
game.answerQuestion(1, dp.interview.questions[1].options.findIndex(o => !o.correct));
rr = game.answerQuestion(1, dp.interview.questions[1].options.findIndex(o => !o.correct));
assert.strictEqual(rr.retry, false, '同题再错应正常推进（retry:false）');
assert.strictEqual(game.state.patience, 1, '两次错共扣 2（3→1）');
// 非 retryable 关卡 retry 恒 false
game.start('milk-tea');
rr = game.answerQuestion(0, mt.interview.questions[0].options.findIndex(o => !o.correct));
assert.strictEqual(rr.retry, false, 'milk-tea 无追问');
ok('追问：首错 retry:true / 再答对得分 / 再错推进 / 非 retryable 不受影响');

/* ---------- 9. 勇哥提示卡 useHint ---------- */
console.log('\n[9] 勇哥提示卡（确定性取第一个未找到，上限 2）');
game.start('milk-tea');
let hr = game.useHint();
assert.strictEqual(hr.ok, true, '首次提示应成功');
assert.strictEqual(hr.faultId, 'rent', '提示取第一个未找到错误点');
hr = game.useHint();
assert.strictEqual(hr.faultId, 'food', '第二次提示下一个');
hr = game.useHint();
assert.strictEqual(hr.ok, false, '第三次应拒绝');
assert.strictEqual(hr.reason, 'limit', '达到上限');
game.start('milk-tea');
['rent', 'food', 'labor'].forEach(id => game.confirmFlaw(id));
hr = game.useHint();
assert.strictEqual(hr.ok, false, '全部找到后无可提示');
assert.strictEqual(hr.reason, 'none');
ok('useHint：顺序/上限 2 / 无候选语义正确');

/* ---------- 10. 复活 revive ---------- */
console.log('\n[10] 复活（failed → 回 failedAt 阶段 +2 心，每关一次）');
game.start('milk-tea');
const mtWrong0 = mt.interview.questions[0].options.findIndex(o => !o.correct);
for (let i = 0; i < 5; i++) game.answerQuestion(0, mtWrong0);
assert.strictEqual(game.state.failed, true, '应先失败');
assert.strictEqual(game.state.stage, 'fail');
assert.strictEqual(game.state.failedAt, 'ask', '记录失败阶段');
let rv = game.revive();
assert.strictEqual(rv.ok, true, '复活应成功');
assert.strictEqual(rv.stage, 'ask', '回到失败阶段');
assert.strictEqual(game.state.patience, 2, '复活 +2 心');
assert.strictEqual(game.state.failed, false, '清除 failed');
rv = game.revive();
assert.strictEqual(rv.ok, false, '每关只能复活一次');
ok('revive：回阶段/+2 心/单次');

/* ---------- 11. 环视线索联动找茬 ---------- */
console.log('\n[11] 线索联动（envClues.faultId → clueGlowFaults）');
game.start('milk-tea');
assert.deepStrictEqual(game.clueGlowFaults(), [], '未收藏时无高亮');
game.toggleClue('road');
game.toggleClue('waimai');
assert.deepStrictEqual(game.clueGlowFaults(), ['rent', 'food'], '收藏的线索映射到错误点');
game.toggleClue('starbucks'); // faultId 为 null → 不产生高亮
assert.deepStrictEqual(game.clueGlowFaults(), ['rent', 'food'], 'faultId 为空的线索不产生高亮');
ok('clueGlowFaults：收藏线索 → 找茬金色高亮目标');

/* ---------- 12. 成就 / 图鉴 / 侦探币 ---------- */
console.log('\n[12] 成就系统（onComplete / addCoins / cards）');
const achieve = require('../minigame/js/core/achieve.js');
const coins0 = achieve.stats().coins;
achieve.addCoins(10);
assert.strictEqual(achieve.stats().coins, coins0 + 10, '侦探币累加');
game.start('milk-tea');
answerAllCorrect(mt);
mt.findFaults.faults.forEach(f => game.confirmFlaw(f.id));
mt.connectPairs.forEach((_, i) => { game.selectLeft(i); game.selectRight(i); });
game.chooseRescue(2);
const report = game.computeResult();
game.completeLevel();
const fresh = achieve.onComplete('milk-tea', report, game.state);
assert(fresh.indexOf('🏆 避坑天花板') === -1, '满分通关解锁的是 perfect 而非最高档成就名');
assert(fresh.some(t => /火眼金睛|首诊成功/.test(t)), '应解锁首关相关成就：' + fresh.join(','));
assert(achieve.cards().find(c => c.id === 'milk-tea').unlocked, '图鉴收录 milk-tea');
assert(achieve.isUnlocked('first-clear'), 'first-clear 已解锁');
assert(achieve.stats().totalSaved >= report.recoveredTotal, '累计止损入账');
ok('成就/图鉴/侦探币：入账与新解锁正确（' + fresh.join('、') + '）');

console.log(`\n✅ sanity-game.js 逻辑校验通过（${pass} 项）\n`);