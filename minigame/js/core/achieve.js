/* =====================================================================
 * js/core/achieve.js — 成就系统 + 关卡图鉴 + 累计统计
 * ---------------------------------------------------------------------
 * 纯逻辑 + storage（wx guard，try/catch），node 下走内存副本可测。
 * 不 require state.js：结算数据由场景通过参数传入。
 *
 * 存储键：
 *   btb_achievements {id: true}
 *   btb_gallery      {levelId: true}   每关一张图鉴卡
 *   btb_stats        {totalSaved, coins}   累计止损（万）/ 侦探币
 *
 * 结算时场景调用：
 *   const fresh = achieve.onComplete(levelId, report, stateSnapshot);
 *   // fresh = 本次新解锁的成就标题数组（可拿去弹 toast）
 * ===================================================================== */
const LEVELS = require('../data/levels.js');

const K_ACH = 'btb_achievements';
const K_GAL = 'btb_gallery';
const K_STA = 'btb_stats';

// 10 个成就定义（id / title / desc / icon）
const ACHIEVEMENTS = [
  { id: 'first-clear',  title: '首诊成功',   desc: '通关任意一关',           icon: '🩺' },
  { id: 'perfect',      title: '火眼金睛',   desc: '任一问满分通关',         icon: '🔥' },
  { id: 'ask-perfect',  title: '夺命三连',   desc: '任一审问全对',           icon: '🎯' },
  { id: 'link-perfect', title: '连线大师',   desc: '任一关连线全对',         icon: '🔗' },
  { id: 'close-call',   title: '险象环生',   desc: '剩 ≤1 耐心通关',         icon: '😅' },
  { id: 'ch1-clear',    title: '新手村毕业', desc: '通关第 5 关',            icon: '🎓' },
  { id: 'saver-100',    title: '止损百万',   desc: '累计止损 ≥100 万',       icon: '💰' },
  { id: 'saver-1000',   title: '止损千万',   desc: '累计止损 ≥1000 万',      icon: '🏦' },
  { id: 'gallery-5',    title: '图鉴过半',   desc: '收集 ≥5 张图鉴卡',       icon: '🖼️' },
  { id: 'gallery-all',  title: '全图鉴',     desc: '收集全部图鉴卡',         icon: '🏅' },
];

let unlocked = {};   // id -> true
let gallery = {};    // levelId -> true
let statsData = { totalSaved: 0, coins: 0 };
let inited = false;

function storage() {
  return typeof wx !== 'undefined' ? wx : null;
}

function load() {
  if (inited) return;
  inited = true;
  const s = storage();
  if (!s) return;
  try {
    const a = s.getStorageSync(K_ACH);
    if (a && typeof a === 'object') unlocked = Object.assign({}, a);
    const g = s.getStorageSync(K_GAL);
    if (g && typeof g === 'object') gallery = Object.assign({}, g);
    const st = s.getStorageSync(K_STA);
    if (st && typeof st === 'object' && isFinite(st.totalSaved)) {
      statsData = {
        totalSaved: Number(st.totalSaved),
        coins: isFinite(st.coins) ? Number(st.coins) : 0,
      };
    }
  } catch (e) { /* 忽略 */ }
}

function saveAll() {
  const s = storage();
  if (!s) return;
  try {
    s.setStorageSync(K_ACH, Object.assign({}, unlocked));
    s.setStorageSync(K_GAL, Object.assign({}, gallery));
    s.setStorageSync(K_STA, { totalSaved: statsData.totalSaved, coins: statsData.coins });
  } catch (e) { /* 忽略 */ }
}

function findLevel(levelId) {
  return LEVELS.find(l => l.id === levelId) || null;
}

/* ---------- 基础查询 ---------- */
function list() {
  load();
  return ACHIEVEMENTS.map(a => Object.assign({}, a, { unlocked: !!unlocked[a.id] }));
}

function isUnlocked(id) {
  load();
  return !!unlocked[id];
}

function unlock(id) {
  load();
  if (!ACHIEVEMENTS.some(a => a.id === id) || unlocked[id]) return false;
  unlocked[id] = true;
  saveAll();
  return true;
}

/* ---------- 结算入口 ---------- */
// levelId: 通关关卡；report: state.computeResult() 结果；
// stateSnapshot: state.getStateView()（含 askCorrect / patience 等）
// 返回本次新解锁的成就标题数组
function onComplete(levelId, report, stateSnapshot) {
  load();
  const fresh = [];
  const tryUnlock = (id) => {
    if (unlock(id)) fresh.push(ACHIEVEMENTS.find(a => a.id === id).title);
  };

  // 图鉴卡 + 累计止损
  gallery[levelId] = true;
  const saved = report && isFinite(report.recoveredTotal) ? Number(report.recoveredTotal) : 0;
  statsData.totalSaved = Math.round((statsData.totalSaved + saved) * 100) / 100;

  const lv = findLevel(levelId);
  const snap = stateSnapshot || {};

  tryUnlock('first-clear');
  if (report && report.score === report.maxScore) tryUnlock('perfect');
  if (lv && snap.askCorrect != null && snap.askCorrect >= lv.interview.questions.length) {
    tryUnlock('ask-perfect');
  }
  if (lv && report && report.linkCount === lv.connectPairs.length) {
    tryUnlock('link-perfect');
  }
  if (snap.patience != null && snap.patience <= 1) tryUnlock('close-call');
  if (LEVELS[4] && gallery[LEVELS[4].id]) tryUnlock('ch1-clear');
  if (statsData.totalSaved >= 100) tryUnlock('saver-100');
  if (statsData.totalSaved >= 1000) tryUnlock('saver-1000');
  if (Object.keys(gallery).length >= 5) tryUnlock('gallery-5');
  if (LEVELS.length > 0 && LEVELS.every(l => gallery[l.id])) tryUnlock('gallery-all');

  saveAll();
  return fresh;
}

/* ---------- 图鉴 / 统计 ---------- */
// 侦探币入账（激励视频双倍积分等），累加并持久化，返回最新余额
function addCoins(n) {
  load();
  const v = Math.round(Number(n));
  if (isFinite(v) && v > 0) {
    statsData.coins += v;
    saveAll();
  }
  return statsData.coins;
}

function cards() {
  load();
  return LEVELS.map(l => ({
    id: l.id,
    title: l.title,
    icon: l.icon,
    unlocked: !!gallery[l.id],
  }));
}

function stats() {
  load();
  return {
    totalSaved: statsData.totalSaved,
    coins: statsData.coins,
    galleryCount: Object.keys(gallery).length,
    galleryTotal: LEVELS.length,
    unlockedCount: Object.keys(unlocked).length,
    achievementTotal: ACHIEVEMENTS.length,
  };
}

module.exports = {
  ACHIEVEMENTS,
  list,
  isUnlocked,
  unlock,
  onComplete,
  addCoins,
  cards,
  stats,
};
