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
 * ===================================================================== */
const assert = require('assert');
const game = require('../miniprogram/utils/game.js');

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

console.log(`\n✅ sanity-game.js 逻辑校验通过（${pass} 项）\n`);