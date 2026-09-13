/* =====================================================================
 * js/core/track.js — 事件埋点（本地 storage 环形缓冲）
 * ---------------------------------------------------------------------
 * track(evt, data)：向 wx storage `btb_events` 追加 {evt, data, t}，
 *   上限 300 条环形覆盖；无 wx 时写入内存副本（node 下仍可 count）。
 * count(evt)：返回事件计数（node 下读内存副本，可用）。
 * ===================================================================== */
const KEY = 'btb_events';
const LIMIT = 300;

let mem = [];      // 内存副本（唯一事实源；有 wx 时同步落盘）
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
    const raw = s.getStorageSync(KEY);
    if (Array.isArray(raw)) mem = raw.slice(-LIMIT);
  } catch (e) { /* 忽略 */ }
}

function persist() {
  const s = storage();
  if (!s) return;
  try {
    s.setStorageSync(KEY, mem.slice(-LIMIT));
  } catch (e) { /* 忽略 */ }
}

function track(evt, data) {
  try {
    load();
    mem.push({ evt: String(evt), data: data || {}, t: Date.now() });
    if (mem.length > LIMIT) mem = mem.slice(-LIMIT); // 环形覆盖
    persist();
  } catch (e) { /* no-op */ }
}

function count(evt) {
  try {
    load();
    let n = 0;
    for (const e of mem) if (e.evt === evt) n++;
    return n;
  } catch (e) {
    return 0;
  }
}

function all() {
  load();
  return mem.slice();
}

module.exports = { track, count, all, KEY, LIMIT };
