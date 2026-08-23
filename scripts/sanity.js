#!/usr/bin/env node
/* =====================================================================
 * scripts/sanity.js — 关卡数据 / 游戏逻辑 一致性校验
 * ---------------------------------------------------------------------
 * 用法：node scripts/sanity.js （在仓库根目录执行）
 * 校验维度：
 *  1. 数据完整性：levels 数量、ID 唯一性、HTML 标签无泄漏
 *  2. 坐标映射：所有错误点中心落在所属 zone 内且位于 750x750 画布内
 *  3. 隐藏点引用：zone.reveal ↔ fault.hidden ↔ fault.unlockBy 交叉一致
 *  4. 结构契约：每题恰好 1 个正确答案、急救恰好 1 个对、成就降序且顶端对应满分
 *  5. 满分公式：maxScore = 问数 + 错误数 + 对数 + 1
 * ===================================================================== */
const assert = require('assert');
const path = require('path');

const LEVELS = require(path.join(__dirname, '../miniprogram/data/levels.js'));
const GAME_LEVELS = require(path.join(__dirname, '../minigame/js/data/levels.js'));

let pass = 0;
function ok(name) {
  pass++;
  console.log(`  ✓ ${name}`);
}

/* ---------- 0. 双数据源一致性（miniprogram ↔ minigame） ---------- */
console.log('\n[0] 双数据源一致性');
assert.deepStrictEqual(LEVELS, GAME_LEVELS, 'miniprogram/data/levels.js 与 minigame/js/data/levels.js 必须完全一致');
ok('miniprogram ↔ minigame 两份关卡数据字节级一致（改数据需同步两份）');

/* ---------- 1. 数据完整性 ---------- */
console.log('\n[1] 数据完整性');
assert.strictEqual(LEVELS.length, 2, '关卡数量应为 2（与根 levels.js 同步）');
ok(`levels 数量 = ${LEVELS.length}`);

const levelIds = new Set();
const zoneIds = new Set();
const faultIds = new Set();
const pairIds = new Set();

for (const lv of LEVELS) {
  assert(!levelIds.has(lv.id), `关卡 id 重复：${lv.id}`);
  levelIds.add(lv.id);

  // 领域文本不允许残留 HTML 标签
  const htmlRe = /<\/?[a-zA-Z][^>]*>/;
  const texts = lv.interview.neighbor.texts;
  assert(Array.isArray(texts) && texts.length > 0, `关卡 ${lv.id} neighbor.texts 应为非空数组`);
  assert(!htmlRe.test(JSON.stringify(texts)), `关卡 ${lv.id} neighbor.texts 含 HTML 标签（应已转纯文本）`);

  // 三连问：每题恰好 1 个正确答案
  for (const q of lv.interview.questions) {
    const n = q.options.filter(o => o.correct).length;
    assert.strictEqual(n, 1, `关卡 ${lv.id} 题目「${q.ask}」应有且仅有 1 个正确答案`);
  }
  // 急救：恰好 1 个正确
  const rc = lv.firstAid.options.filter(o => o.correct).length;
  assert.strictEqual(rc, 1, `关卡 ${lv.id} 急救应恰好 1 个正确`);

  // 成就：按 min 降序，且顶部档位对应满分
  const achs = lv.result.achievements;
  for (let i = 1; i < achs.length; i++) {
    assert(achs[i - 1].min > achs[i].min, `关卡 ${lv.id} 成就应降序排列`);
  }
  assert.strictEqual(achs[0].min, lv.interview.questions.length + lv.findFaults.faults.length + lv.connectPairs.length + 1,
    `关卡 ${lv.id} 最高成就档对应满分`);

  // 找茬：id 唯一性
  for (const z of lv.findFaults.zones) {
    assert(!zoneIds.has(lv.id + '/' + z.id), `zone id 重复：${lv.id}/${z.id}`);
    zoneIds.add(lv.id + '/' + z.id);
  }
  for (const f of lv.findFaults.faults) {
    assert(!faultIds.has(lv.id + '/' + f.id), `fault id 重复：${lv.id}/${f.id}`);
    faultIds.add(lv.id + '/' + f.id);
    pairIds.add(f.id);
  }
  // 连线：左侧是"错误原因"，必须引用存在的错误点 id；右侧是"后果 id"（独立命名空间），仅需唯一
  const conseqIds = new Set();
  for (const p of lv.connectPairs) {
    assert(pairIds.has(p.leftId), `关卡 ${lv.id} 连线左侧引用不存在的错误点 ${p.leftId}`);
    assert(typeof p.rightId === 'string' && p.rightId.length > 0, `关卡 ${lv.id} 连线右侧 id 非法`);
    assert(!conseqIds.has(p.rightId), `关卡 ${lv.id} 连线右侧 id 重复：${p.rightId}`);
    conseqIds.add(p.rightId);
  }
}
ok('两关数据结构契约通过（唯一ID / 单选正确 / 成就降序 / 急救唯一正确）');

/* ---------- 2 & 3. 坐标映射 + 隐藏点引用 ---------- */
console.log('\n[2/3] 坐标映射 + 隐藏点引用');
const S = 750;
for (const lv of LEVELS) {
  const ff = lv.findFaults;
  const { w, h } = ff.sceneSize;
  const cx = c => c.x, cy = c => c.y; // 错误点以 x/y 为中心

  for (const f of ff.faults) {
    assert(Number.isFinite(f.x) && Number.isFinite(f.y), `关卡 ${lv.id} 错误点 ${f.id} 坐标非法`);
    assert(f.x >= 0 && f.x <= w && f.y >= 0 && f.y <= h, `关卡 ${lv.id} 错误点 ${f.id} (#${f.x},#${f.y}) 超出画布 ${w}x${h}`);

    // 所属 zone：遍历 rect 求包含
    const host = ff.zones.find(z => f.x >= z.x && f.x <= z.x + z.w && f.y >= z.y && f.y <= z.y + z.h);
    assert(host, `关卡 ${lv.id} 错误点 ${f.id} 落在任何 zone 之外`);
  }

  // 隐藏点交叉引用
  for (const z of ff.zones) {
    if (!z.reveal) continue;
    const f = ff.faults.find(x => x.id === z.reveal);
    assert(f, `关卡 ${lv.id} 隐藏点引用 zone.reveal 指向不存在的错误点 ${z.reveal}`);
    assert(f.hidden === true, `关卡 ${lv.id} 被 zone.reveal 锁定的 ${z.reveal} 必须 hidden:true`);
    assert(f.unlockBy === z.id, `关卡 ${lv.id} ${z.reveal}.unlockBy 应等于其触发 zone ${z.id}`);
  }
  for (const f of ff.faults) {
    if (!f.hidden) continue;
    const z = ff.zones.find(x => x.id === f.unlockBy);
    assert(z, `关卡 ${lv.id} 隐藏点 ${f.id} 的 unlockBy ${f.unlockBy} 不存在`);
    assert(z.reveal === f.id, `关卡 ${lv.id} zone ${f.unlockBy} 的 reveal 应指向 ${f.id}`);
  }
  ok(`关卡 ${lv.id}：${ff.faults.length} 个错误点均落在 zone 内，hidden/unlockBy 交叉一致`);
}

/* ---------- 4. 满分公式 ---------- */
console.log('\n[4] 满分公式');
for (const lv of LEVELS) {
  const max = lv.interview.questions.length + lv.findFaults.faults.length + lv.connectPairs.length + 1;
  assert.strictEqual(max, lv.result.achievements[0].min, `关卡 ${lv.id} maxScore 与最高成就档不符`);
  ok(`关卡 ${lv.id}：maxScore = ${max}（问${lv.interview.questions.length} + 错${lv.findFaults.faults.length} + 对${lv.connectPairs.length} + 急救1）`);
}

console.log(`\n✅ sanity.js 数据校验通过（${pass} 项）\n`);
console.log('提示：运行 node scripts/sanity-game.js 可额外校验游戏状态机逻辑。');