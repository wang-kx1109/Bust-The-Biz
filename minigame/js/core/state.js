/* =====================================================================
 * utils/game.js — 游戏状态机 + 核心逻辑
 * ---------------------------------------------------------------------
 * 设计原则：
 *  - 核心函数（start/answerQuestion/confirmFlaw/selectRight/chooseRescue/
 *    computeResult 等）是纯逻辑，不直接调用 wx，可在 node 下单元测试。
 *  - 仅持久化函数（saveProgress/loadProgress）内部做 wx 隔离（typeof wx 守卫）。
 *  - 页面通过 getStateView()/sync(page) 拿到纯数据做 setData ——
 *    绝不把函数或 state 本体塞进 setData。
 *  - 进度（解锁关卡）存 wx.setStorageSync('btb_progress', {completed})。
 *
 * 状态字段：
 *  levelId / stage(ask|find|link|rescue|result|fail|select)
 *  askStep(0开场 1环视 2-4三连问 5老王 6完成)
 *  patience(5) / score / askCorrect
 *  savedClues[] / revealedZones{} / foundFlaws[]
 *  selectedLeft(连线选中的左卡片 index) / connected{} / rightOrder[]（右列洗牌顺序）
 *  rescueChosen / rescueCorrect / failed
 * ===================================================================== */
const LEVELS = require('../data/levels.js');

const STORAGE_KEY = 'btb_progress';

const state = {
  levelId: null,
  stage: 'select',
  askStep: 0,
  patience: 5,
  score: 0,
  askCorrect: 0,
  savedClues: [],
  revealedZones: {},   // zoneId -> true（点击"正常区域"解锁隐藏错误点）
  foundFlaws: [],      // 已确认的错误点 id（按发现顺序）
  selectedLeft: null,  // 连线阶段：左列已选中的 pair index
  connected: {},       // pair index -> true（连线正确锁定）
  rightOrder: [],      // 右列卡片顺序 = connectPairs 索引的洗牌
  rescueChosen: null,  // 急救选项 index
  rescueCorrect: false,
  failed: false,
};

const progress = { completed: [] }; // ['milk-tea', ...]

/* =====================================================================
 * 基础工具
 * ===================================================================== */
function findLevel(id) {
  return LEVELS.find(l => l.id === id) || null;
}
function getLevel() {
  return state.levelId ? findLevel(state.levelId) : null;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function maxScore(lv) {
  return lv.interview.questions.length + lv.findFaults.faults.length + lv.connectPairs.length + 1;
}
function failIfZero() {
  if (state.patience <= 0) {
    state.failed = true;
    state.stage = 'fail';
    return true;
  }
  return false;
}

/* =====================================================================
 * 开始 / 重置 / 状态读取
 * ===================================================================== */
function reset(levelId) {
  Object.assign(state, {
    levelId,
    stage: levelId ? 'ask' : 'select',
    askStep: 0,
    patience: 5,
    score: 0,
    askCorrect: 0,
    savedClues: [],
    revealedZones: {},
    foundFlaws: [],
    selectedLeft: null,
    connected: {},
    rightOrder: [],
    rescueChosen: null,
    rescueCorrect: false,
    failed: false,
  });
}

// 开始一关：重置 + 洗牌右列顺序
function start(levelId) {
  const lv = findLevel(levelId);
  if (!lv) return false;
  reset(levelId);
  const n = lv.connectPairs.length;
  state.rightOrder = shuffle(Array.from({ length: n }, (_, i) => i));
  return true;
}

function markStage(name) {
  state.stage = name;
  return state.stage;
}

// 纯数据视图（可直接 setData，绝不混入函数）
function getStateView() {
  const lv = getLevel();
  return {
    levelId: state.levelId,
    stage: state.stage,
    askStep: state.askStep,
    patience: state.patience,
    score: state.score,
    askCorrect: state.askCorrect,
    savedClues: state.savedClues.slice(),
    maxClues: lv ? lv.interview.maxClues : 0,
    revealedZones: Object.assign({}, state.revealedZones),
    foundFlaws: state.foundFlaws.slice(),
    selectedLeft: state.selectedLeft,
    connected: Object.assign({}, state.connected),
    rightOrder: state.rightOrder.slice(),
    rescueChosen: state.rescueChosen,
    rescueCorrect: state.rescueCorrect,
    failed: state.failed,
    maxScore: lv ? maxScore(lv) : 0,
  };
}
function sync(page) {
  const view = getStateView();
  if (page && typeof page.setData === 'function') page.setData(view);
  return view;
}

/* =====================================================================
 * 审问阶段
 * ===================================================================== */
// qslot 0-2，optIdx 0-2
function answerQuestion(qslot, optIdx) {
  const lv = getLevel();
  if (!lv) return { correct: false };
  const q = lv.interview.questions[qslot];
  if (!q) return { correct: false };
  const opt = q.options[optIdx];
  if (!opt) return { correct: false };

  if (opt.correct) {
    state.score++;
    state.askCorrect++;
  } else {
    state.patience--;
    failIfZero();
  }
  return {
    correct: opt.correct,
    reveal: opt.reveal,
    patience: state.patience,
    score: state.score,
    failed: state.failed,
  };
}

// 收藏线索（上限 maxClues）
function toggleClue(id) {
  const i = state.savedClues.indexOf(id);
  if (i >= 0) {
    state.savedClues.splice(i, 1);
    return { ok: true, saved: false, full: false, savedClues: state.savedClues.slice() };
  }
  const lv = getLevel();
  if (lv && state.savedClues.length >= lv.interview.maxClues) {
    return { ok: false, full: true, saved: false, savedClues: state.savedClues.slice() };
  }
  state.savedClues.push(id);
  return { ok: true, saved: true, full: false, savedClues: state.savedClues.slice() };
}

function advanceAsk() {
  state.askStep++;
  return { askStep: state.askStep };
}
function phoneVerified() {
  state.askStep = 6;
  return { askStep: state.askStep };
}

/* =====================================================================
 * 找茬阶段
 * ===================================================================== */
// 点击正常区域：若该 zone 携 reveal（隐藏点触发点），则解锁并返回提示
function tapZone(zoneId) {
  const lv = getLevel();
  if (!lv) return { revealed: false };
  const z = lv.findFaults.zones.find(x => x.id === zoneId);
  if (!z) return { revealed: false };
  if (z.reveal && !state.revealedZones[zoneId]) {
    state.revealedZones[zoneId] = true;
    return { revealed: true, faultId: z.reveal, hint: z.revealHint || '' };
  }
  return { revealed: false };
}

// 当前可见的错误点（hidden 且未解锁的不显示）
function visibleFaults() {
  const lv = getLevel();
  if (!lv) return [];
  return lv.findFaults.faults.filter(f => !f.hidden || state.revealedZones[f.unlockBy]);
}

function confirmFlaw(faultId) {
  if (state.foundFlaws.indexOf(faultId) >= 0) return { already: true, found: true };
  state.foundFlaws.push(faultId);
  state.score++;
  return { already: false, found: true, score: state.score };
}

/* =====================================================================
 * 连线阶段
 * ===================================================================== */
function selectLeft(pairIdx) {
  if (state.connected[pairIdx]) return { ignore: true };
  state.selectedLeft = pairIdx;
  return { selected: pairIdx };
}

// pairIdx = 右列卡片对应的 pair index（右列卡片渲染时带 pairIndex）
function selectRight(pairIdx) {
  if (state.connected[pairIdx]) return { locked: true, correct: false };
  if (state.selectedLeft === null) return { needLeft: true, correct: false };

  const left = state.selectedLeft;
  state.selectedLeft = null;
  const correct = (left === pairIdx);

  if (correct) {
    state.connected[left] = true;
    state.score++;
  } else {
    state.patience--;
    failIfZero();
  }
  return {
    correct,
    pairIndex: left,
    wrongRight: correct ? null : pairIdx,
    patience: state.patience,
    score: state.score,
    failed: state.failed,
    connectedCount: Object.keys(state.connected).length,
  };
}

function allConnected() {
  const lv = getLevel();
  if (!lv) return false;
  return Object.keys(state.connected).length === lv.connectPairs.length;
}

/* =====================================================================
 * 急救阶段
 * ===================================================================== */
function chooseRescue(i) {
  const lv = getLevel();
  if (!lv) return { correct: false };
  const opt = lv.firstAid.options[i];
  if (!opt) return { correct: false };
  state.rescueChosen = i;
  if (opt.correct) {
    state.rescueCorrect = true;
    state.score++;
  } else {
    state.patience--;
    failIfZero();
  }
  return {
    correct: opt.correct,
    why: opt.why,
    patience: state.patience,
    score: state.score,
    failed: state.failed,
  };
}

/* =====================================================================
 * 结算
 * ===================================================================== */
// 纯函数：根据当前状态计算诊断报告
function computeResult() {
  const lv = getLevel();
  if (!lv) return null;
  const w = lv.result.weights;
  const fCount = state.foundFlaws.length;
  const cCount = Object.keys(state.connected).length;
  const resc = state.rescueCorrect ? 1 : 0;

  const recoveredBy = {
    find: fCount * w.find,
    link: cCount * w.link,
    rescue: resc * w.rescue,
    ask: state.askCorrect * w.ask,
    patience: state.patience * w.patience,
  };
  const recoveredTotal = recoveredBy.find + recoveredBy.link + recoveredBy.rescue + recoveredBy.ask + recoveredBy.patience;
  const loss = Math.max(0, lv.result.baseLoss - recoveredTotal);

  const score = state.score;
  const total = maxScore(lv);
  const ach = lv.result.achievements.find(a => score >= a.min) || lv.result.achievements[lv.result.achievements.length - 1];

  return {
    score,
    maxScore: total,
    achievement: ach.title,
    loss,
    recoveredBy,
    recoveredTotal,
    baseLoss: lv.result.baseLoss,
    foundCount: fCount,
    linkCount: cCount,
    shareText: (lv.result.shareText || '')
      .replace('{flaws}', fCount)
      .replace('{loss}', loss)
      .replace('{score}', score)
      .replace('{total}', total),
  };
}

// 通关 → 写入解锁进度（result 页调用）
function completeLevel() {
  if (state.levelId && progress.completed.indexOf(state.levelId) === -1) {
    progress.completed.push(state.levelId);
    saveProgress();
  }
}

// 当前关卡完成后解锁的下一关（线性链：unlockCondition.id == 当前关卡）
function nextLevelId() {
  if (!state.levelId) return null;
  const lv = LEVELS.find(l => l.unlockCondition && l.unlockCondition.id === state.levelId);
  return lv ? lv.id : null;
}

function isUnlocked(levelId) {
  const lv = findLevel(levelId);
  if (!lv || !lv.unlockCondition) return true;
  return progress.completed.indexOf(lv.unlockCondition.id) !== -1;
}

/* =====================================================================
 * 持久化（仅 wx 环境生效，node 下自动跳过）
 * ===================================================================== */
function storage() {
  return typeof wx !== 'undefined' ? wx : null;
}
function saveProgress() {
  const s = storage();
  if (!s) return;
  try {
    s.setStorageSync(STORAGE_KEY, { completed: progress.completed });
  } catch (e) { /* 忽略存储异常 */ }
}
function loadProgress() {
  const s = storage();
  if (!s) return;
  try {
    const raw = s.getStorageSync(STORAGE_KEY);
    if (raw && Array.isArray(raw.completed)) {
      progress.completed = raw.completed.filter(id => findLevel(id)).slice();
    }
  } catch (e) { /* 忽略存储异常 */ }
}
function unlockAll() {
  progress.completed = LEVELS.map(l => l.id);
  saveProgress();
  return { completed: progress.completed.slice() };
}

/* =====================================================================
 * 导出
 * ===================================================================== */
module.exports = {
  LEVELS,
  state,
  progress,
  STORAGE_KEY,
  findLevel,
  getLevel,
  maxScore,
  start,
  reset,
  markStage,
  getStateView,
  sync,
  answerQuestion,
  toggleClue,
  advanceAsk,
  phoneVerified,
  tapZone,
  visibleFaults,
  confirmFlaw,
  selectLeft,
  selectRight,
  allConnected,
  chooseRescue,
  computeResult,
  completeLevel,
  nextLevelId,
  isUnlocked,
  saveProgress,
  loadProgress,
  unlockAll,
};