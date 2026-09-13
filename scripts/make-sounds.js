#!/usr/bin/env node
/* =====================================================================
 * scripts/make-sounds.js — 零依赖合成音效（PCM WAV）
 * ---------------------------------------------------------------------
 * 用法：node scripts/make-sounds.js
 * 输出：minigame/assets/sounds/{bell,correct,wrong,heart,click,fanfare}.wav
 * 规格：22050Hz / 16-bit / 单声道，自行写 WAV 头。
 * 全部确定性合成（无随机数），重复运行产物字节级一致。
 * ===================================================================== */
const fs = require('fs');
const path = require('path');

const SR = 22050;
const TAU = Math.PI * 2;
const OUT_DIR = path.join(__dirname, '..', 'minigame', 'assets', 'sounds');

// 采样函数 fn(t) -> [-1,1]，写成 16-bit mono WAV
function writeWav(name, durSec, fn) {
  const n = Math.max(1, Math.round(SR * durSec));
  const dataLen = n * 2;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);        // fmt 块大小
  buf.writeUInt16LE(1, 20);         // PCM
  buf.writeUInt16LE(1, 22);         // 单声道
  buf.writeUInt32LE(SR, 24);        // 采样率
  buf.writeUInt32LE(SR * 2, 28);    // 字节率
  buf.writeUInt16LE(2, 32);         // 块对齐
  buf.writeUInt16LE(16, 34);        // 位深
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, fn(i / SR)));
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const p = path.join(OUT_DIR, name);
  fs.writeFileSync(p, buf);
  console.log(`  ✓ ${p}  (${durSec.toFixed(2)}s, ${n} samples, ${buf.length} bytes)`);
}

/* ---------- 1. bell：锣（~0.9s） ----------
 * 基频 ~520Hz，含 2.76 / 5.4 倍频分量，指数衰减，tanh 软限幅 */
function synthBell(t) {
  const env = Math.exp(-t * 4.2);
  const v = Math.sin(TAU * 520 * t)
    + 0.45 * Math.sin(TAU * 520 * 2.76 * t)
    + 0.22 * Math.sin(TAU * 520 * 5.4 * t);
  return Math.tanh(v * env * 1.4) * 0.9;
}

/* ---------- 2. correct：答对（~0.45s） ----------
 * E5 → A5 两音上行，每个音正弦 + 指数衰减 */
function synthCorrect(t) {
  const note = (f, t0, dur) => {
    const lt = t - t0;
    if (lt < 0 || lt > dur) return 0;
    return Math.sin(TAU * f * lt) * Math.exp(-lt * 9) * Math.min(1, lt / 0.008);
  };
  return note(659.25, 0, 0.24) + note(880, 0.2, 0.25); // E5 -> A5
}

/* ---------- 3. wrong：答错（~0.35s） ----------
 * ~160Hz 方波低鸣 + 低频分量，快速衰减 */
function synthWrong(t) {
  const env = Math.exp(-t * 11);
  return (Math.sign(Math.sin(TAU * 160 * t)) * 0.6 + Math.sin(TAU * 80 * t) * 0.3) * env * 0.8;
}

/* ---------- 4. heart：心碎（~0.35s） ----------
 * 120 → 55Hz 下扫正弦"咚"（相位连续积分） */
function synthHeart(t) {
  const sweepT = 0.28;
  const k = 65 / sweepT; // 每秒下滑 Hz 数
  const ph = TAU * (120 * t - 0.5 * k * t * t); // 相位连续积分（120→55Hz 下扫）
  const env = Math.exp(-t * 8) * Math.min(1, t / 0.006);
  return Math.sin(ph) * env * 0.9;
}

/* ---------- 5. click：点击（~0.07s） ----------
 * 短促 2kHz 脉冲（+少量 4kHz 泛音） */
function synthClick(t) {
  const env = Math.exp(-t * 90) * Math.min(1, t / 0.002);
  return (Math.sin(TAU * 2000 * t) * 0.7 + Math.sin(TAU * 4000 * t) * 0.2) * env;
}

/* ---------- 6. fanfare：号角（~0.9s） ----------
 * C5-E5-G5-C6 琶音，谐波叠加 + 轻颤音，末音长 held */
function synthFanfare(t) {
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  const step = 0.15;
  let v = 0;
  for (let i = 0; i < notes.length; i++) {
    const lt = t - i * step;
    if (lt < 0) continue;
    const isLast = i === notes.length - 1;
    const dur = isLast ? 0.4 : 0.22;
    if (lt > dur) continue;
    const f = notes[i];
    const vib = 1 + 0.006 * Math.sin(TAU * 5.5 * lt); // 轻颤音
    const rel = isLast ? Math.exp(-lt * 3.0) : Math.exp(-lt * 7);
    v += (Math.sin(TAU * f * vib * lt)
      + 0.35 * Math.sin(TAU * f * 2 * vib * lt)
      + 0.12 * Math.sin(TAU * f * 3 * vib * lt))
      * Math.min(1, lt / 0.01) * rel;
  }
  return Math.tanh(v * 0.55) * 0.95;
}

/* ---------- 主流程 ---------- */
console.log('合成音效 → minigame/assets/sounds/');
writeWav('bell.wav', 0.9, synthBell);
writeWav('correct.wav', 0.45, synthCorrect);
writeWav('wrong.wav', 0.35, synthWrong);
writeWav('heart.wav', 0.35, synthHeart);
writeWav('click.wav', 0.07, synthClick);
writeWav('fanfare.wav', 0.9, synthFanfare);
console.log('完成：6 个 WAV');
