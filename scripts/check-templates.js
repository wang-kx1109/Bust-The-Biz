#!/usr/bin/env node
/* =====================================================================
 * scripts/check-templates.js — WXML ↔ 页面 data/方法 交叉校验
 * ---------------------------------------------------------------------
 * 用法：node scripts/check-templates.js
 * 对 miniprogram/pages/* ：
 *  1. 每个 {{...}} 表达式的顶层标识符 ∈ 页面 data keys 或白名单
 *  2. 每个 bindtap/catchtap 处理器 ∈ 页面 Page({...}) 顶层方法
 *  3. 页面四件套（js/json/wxml/wxss）齐全
 *  4. WXSS 无 var()（CSS 变量，小程序兼容性风险）
 *  5. setData 参数不含函数字面量
 * ===================================================================== */
const fs = require('fs');
const path = require('path');

const PAGES = 'miniprogram/pages';
const root = path.join(__dirname, '..');

// game.sync(this) 会注入的视图键（页面 data 声明中不会出现）
const SYNC_KEYS = new Set([
  'levelId', 'stage', 'askStep', 'patience', 'score', 'askCorrect',
  'savedClues', 'maxClues', 'revealedZones', 'foundFlaws', 'selectedLeft',
  'connected', 'rightOrder', 'rescueChosen', 'rescueCorrect', 'failed', 'maxScore',
]);

const WHITELIST = new Set(['item', 'index', 'idx', '*this', 'true', 'false', 'null', 'undefined', 'this', 'length']);

let errors = [];
function err(msg) { errors.push(msg); }

/* ---------- 工具：括号配对 ---------- */
function findBalanced(js, openIdx) {
  const stack = [];
  let inStr = null;
  for (let i = openIdx; i < js.length; i++) {
    const ch = js[i];
    if (inStr) {
      if (ch === '\\') i++;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '{' || ch === '(' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ')' || ch === ']') {
      if (!stack.length) break;
      stack.pop();
      if (!stack.length) return i;
    }
  }
  return -1;
}

/* ---------- 从 page js 提取 data keys 与顶层方法 ---------- */
function parsePage(js) {
  const dataKeys = new Set();
  const methods = new Set(['onLoad', 'onShow', 'onReady', 'onUnload', 'onHide', 'onResize', 'onShareAppMessage', 'noop']);

  const pOpen = js.indexOf('Page({');
  if (pOpen < 0) return { dataKeys, methods };
  const pStart = js.indexOf('{', pOpen);
  const pEnd = findBalanced(js, pStart);
  if (pEnd < 0) return { dataKeys, methods };

  // data: 块
  const dm = js.slice(pStart, pEnd).search(/\bdata\s*:/);
  if (dm >= 0) {
    const dStart = pStart + dm;
    const dOpen = js.indexOf('{', dStart);
    const dEnd = findBalanced(js, dOpen);
    if (dEnd >= 0) {
      const block = js.slice(dOpen + 1, dEnd);
      // 4 空格缩进的 data 成员键
      const re = /\n    ([\w$]+)\s*:/g;
      let m;
      while ((m = re.exec(block))) dataKeys.add(m[1]);
    }
  }

  // 顶层方法（2 空格缩进的行首键）
  const body = js.slice(pStart + 1, pEnd);
  const re = /\n  ([\w$]+)\s*:/g;
  let m;
  while ((m = re.exec(body))) {
    if (m[1] !== 'data') methods.add(m[1]);
  }
  return { dataKeys, methods };
}

/* ---------- 从 WXML 提取表达式用到的顶层标识符 ---------- */
function topIdents(wxml) {
  const idents = new Set();
  const expRe = /\{\{(.+?)\}\}/g;
  let m;
  while ((m = expRe.exec(wxml))) {
    const expr = m[1]
      .replace(/"[^"]*"/g, '')   // 剥离双引号字符串
      .replace(/'[^']*'/g, '')   // 单引号
      .replace(/`[^`]*`/g, '');  // 反引号
    const idRe = /[A-Za-z_$][\w$]*/g;
    let im;
    while ((im = idRe.exec(expr))) {
      const before = expr[im.index - 1];
      if (before === '.') continue; // 成员访问：只认根标识符
      idents.add(im[0]);
    }
  }
  return idents;
}

/* ---------- 处理器 ---------- */
function handlers(wxml) {
  const hs = new Set();
  const re = /\b(?:bind|catch)(?:tap|longtap|touchstart|touchend|capturetap)\s*=\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(wxml))) hs.add(m[1]);
  return hs;
}

/* ---------- 主校验 ---------- */
const pageDirs = fs.readdirSync(path.join(root, PAGES));
let checked = 0;

for (const dir of pageDirs) {
  const base = path.join(root, PAGES, dir);
  const n = `pages/${dir}/`;

  const js = path.join(base, `${dir}.js`);
  const jso = path.join(base, `${dir}.json`);
  const wxml = path.join(base, `${dir}.wxml`);
  const wxss = path.join(base, `${dir}.wxss`);

  for (const f of [js, jso, wxml, wxss]) {
    if (!fs.existsSync(f)) err(`${n}${path.basename(f)} 缺失`);
  }
  if (!fs.existsSync(js) || !fs.existsSync(wxml)) continue;

  const jsText = fs.readFileSync(js, 'utf8');
  const wxmlText = fs.readFileSync(wxml, 'utf8');
  const { dataKeys, methods } = parsePage(jsText);

  // 1) 表达式标识符
  for (const id of topIdents(wxml)) {
    if (dataKeys.has(id) || SYNC_KEYS.has(id)) continue;
    // 拆点路径也可能整体作为白名单项（如 item.lockText 只出 item）
    const noun = id.split('.')[0];
    if (WHITELIST.has(noun) || WHITELIST.has(id)) continue;
    err(`${n}WXML 标识符 {{${id}}} 未在 data 或 sync 视图中声明`);
  }

  // 2) 处理器
  for (const h of handlers(wxml)) {
    if (!methods.has(h)) err(`${n}WXML bindtap 处理器 ${h} 未在 Page 中定义`);
  }

  // 3) WXSS 无 var()
  if (fs.existsSync(wxss)) {
    const css = fs.readFileSync(wxss, 'utf8');
    if (/\bvar\(/.test(css)) err(`${n}wxss 使用了 CSS 变量 var()，小程序部分基础库不支持`);
  }

  // 4) setData 无函数字面量
  const fnRe = /setData\(\{[\s\S]{0,60}?(function\s*\(|\=\>)/;
  if (fnRe.test(jsText)) err(`${n}setData 参数含函数字面量（不允许函数进 setData）`);

  // 5) JSON 可解析
  if (fs.existsSync(jso)) {
    try { JSON.parse(fs.readFileSync(jso, 'utf8')); }
    catch (e) { err(`${n}.json 解析失败：${e.message}`); }
  }
  checked++;
}

/* ---------- 结果 ---------- */
if (errors.length) {
  console.error(`❌ check-templates.js 发现 ${errors.length} 个问题：`);
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
}
console.log(`✅ check-templates.js 通过（${checked} 个页面，绑定/标识符/样式全部一致）`);