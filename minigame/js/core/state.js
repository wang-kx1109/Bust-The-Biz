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
 *  patienceMax(关卡 patienceMax||5) / patience(=patienceMax)
 *  score / askCorrect
 *  savedClues[] / revealedZones{} / foundFlaws[]
 *  selectedLeft(连线选中的左卡片 index) / connected{} / rightOrder[]（右列洗牌顺序）
 *  rescueChosen / rescueCorrect / failed / failedAt
 *  revived(复活过?) / hintsUsed(提示次数) / hinted[](已提示过的错误点) / askRetries[](追问标记 per qslot)
 *  photos[]（拍照取证：{faultId|null, title?, t}，胶卷格上限 photoMax=getPhotoMax(关卡)）
 * ===================================================================== */
const LEVELS = require('../data/levels.js');

const STORAGE_KEY = 'btb_progress';
const MAX_HINTS = 2;

const state = {
  levelId: null,
  stage: 'select',
  askStep: 0,
  patienceMax: 5,
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
  failedAt: null,      // 失败时所在阶段（复活回到这里）
  revived: false,      // 本关是否已用复活
  hintsUsed: 0,        // 本关已用提示次数（上限 MAX_HINTS）
  hinted: [],          // 已提示过的错误点 id（不重复提示）
  askRetries: [],      // qslot -> true（retryable 关卡答错后给一次追问）
  photos: [],          // 拍下的照片（取证）：{faultId|null, title?, t}
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
    state.failedAt = state.stage;
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
  const lv = levelId ? findLevel(levelId) : null;
  const pm = lv && lv.patienceMax ? lv.patienceMax : 5;
  Object.assign(state, {
    levelId,
    stage: levelId ? 'ask' : 'select',
    askStep: 0,
    patienceMax: pm,
    patience: pm,
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
    failedAt: null,
    revived: false,
    hintsUsed: 0,
    hinted: [],
    askRetries: [],
    photos: [],
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
    patienceMax: state.patienceMax,
    patience: state.patience,
    score: state.score,
    askCorrect: state.askCorrect,
    savedClues: state.savedClues.slice(),
    maxClues: lv ? lv.interview.maxClues : 0,
    revealedZones: Object.assign({}, state.revealedZones),
    foundFlaws: state.foundFlaws.slice(),
    photos: state.photos.slice(),
    photoMax: lv ? getPhotoMax(lv) : 0,
    selectedLeft: state.selectedLeft,
    connected: Object.assign({}, state.connected),
    rightOrder: state.rightOrder.slice(),
    rescueChosen: state.rescueChosen,
    rescueCorrect: state.rescueCorrect,
    failed: state.failed,
    revived: state.revived,
    hintsUsed: state.hintsUsed,
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
// retryable 关卡：每题答错首给一次追问（返回 retry:true，场景保持本题可再答）
function answerQuestion(qslot, optIdx) {
  const lv = getLevel();
  if (!lv) return { correct: false, retry: false };
  const q = lv.interview.questions[qslot];
  if (!q) return { correct: false, retry: false };
  const opt = q.options[optIdx];
  if (!opt) return { correct: false, retry: false };

  if (opt.correct) {
    if (state.askRetries[qslot]) state.askRetries[qslot] = false; // 清掉该题追问标记
    state.score++;
    state.askCorrect++;
    return {
      correct: true,
      retry: false,
      reveal: opt.reveal,
      patience: state.patience,
      score: state.score,
      failed: state.failed,
    };
  }
  // 答错：retryable 且该题尚未追问过 → 给一次追问机会
  const retry = !!(lv.retryable && !state.askRetries[qslot]);
  if (retry) state.askRetries[qslot] = true;
  state.patience--;
  failIfZero();
  return {
    correct: false,
    retry,
    reveal: opt.reveal,
    patience: state.patience,
    score: state.score,
    failed: state.failed,
  };
}

// 复活（激励视频奖励）：仅 failed 且本关未复活过可用一次
function revive() {
  if (!state.failed || state.revived) return { ok: false };
  state.revived = true;
  state.failed = false;
  state.patience = Math.min(state.patienceMax, 2);
  state.stage = state.failedAt || 'ask';
  return { ok: true, patience: state.patience, stage: state.stage };
}

// 提示：每关上限 MAX_HINTS 次；候选 = 可见错误点中未找到且未提示过的，取第一个（确定性）
function useHint() {
  if (state.hintsUsed >= MAX_HINTS) return { ok: false, reason: 'limit' };
  const cand = visibleFaults().filter(f =>
    state.foundFlaws.indexOf(f.id) < 0 && state.hinted.indexOf(f.id) < 0);
  if (!cand.length) return { ok: false, reason: 'none' };
  state.hintsUsed++;
  state.hinted.push(cand[0].id);
  return { ok: true, faultId: cand[0].id };
}

// 已收藏线索中携带 faultId 的 → 对应错误点 id（场景据此高亮 glow）
function clueGlowFaults() {
  const lv = getLevel();
  if (!lv || !lv.interview || !Array.isArray(lv.interview.envClues)) return [];
  return state.savedClues
    .map(id => lv.interview.envClues.find(c => c.id === id))
    .filter(c => c && c.faultId)
    .map(c => c.faultId);
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

// 胶卷格上限：关卡可配 photoMax，默认 = 错误点数 + 1
function getPhotoMax(lv) {
  return lv.photoMax || (lv.findFaults.faults.length + 1);
}

// 拍照取证：拍到错误点 = 确认该错误。
// 注意：确认动作由 confirmFlaw 完成，分数即时入账；之后 discardPhoto 只腾胶卷格，
// 不返还分数、也不回退 foundFlaws —— 删掉证据照片不影响已认定的错误。
function photographFault(faultId) {
  if (state.foundFlaws.indexOf(faultId) >= 0) return { ok: false, already: true };
  const lv = getLevel();
  if (lv && state.photos.length >= getPhotoMax(lv)) return { ok: false, reason: 'full' };
  state.photos.push({ faultId, t: Date.now() });
  const r = confirmFlaw(faultId);
  return { ok: true, already: false, score: r.score, found: faultId };
}

// 拍到无关内容 → 废片：同样占一格胶卷
function takeJunkPhoto(title) {
  const lv = getLevel();
  if (lv && state.photos.length >= getPhotoMax(lv)) return { ok: false, reason: 'full' };
  state.photos.push({ faultId: null, title: String(title || '店内随拍'), t: Date.now() });
  return { ok: true };
}

// 删照片腾胶卷格。语义：不返还已得分（见 photographFault 注释），
// 也不回退 foundFlaws —— 腾格后已找到的错误点仍是 already 状态。
function discardPhoto(index) {
  if (index < 0 || index >= state.photos.length) return { ok: false };
  state.photos.splice(index, 1);
  return { ok: true, photos: state.photos.slice() };
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
  revive,
  useHint,
  clueGlowFaults,
  MAX_HINTS,
  toggleClue,
  advanceAsk,
  phoneVerified,
  tapZone,
  visibleFaults,
  confirmFlaw,
  getPhotoMax,
  photographFault,
  takeJunkPhoto,
  discardPhoto,
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