// Synthetic-signal accuracy test: new YIN detector vs. the previous AMDF detector.
// Run: node scripts/test-pitch.mjs
import { detectPitch } from '../src/pitch.js';

const SAMPLE_RATE = 48000;
const SIZE = 4096;

// --- previous detector (copied from main.jsx before the rewrite) ---
function legacyAutoCorrelate(buffer, sampleRate, frequencyRange = { min: 28, max: 700 }) {
  const size = buffer.length;
  let rms = 0;
  for (let i = 0; i < size; i += 1) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / size);
  if (rms < 0.0032) return null;

  let start = 0;
  let end = size - 1;
  const threshold = 0.08;
  for (let i = 0; i < size / 2; i += 1) {
    if (Math.abs(buffer[i]) < threshold) { start = i; break; }
  }
  for (let i = 1; i < size / 2; i += 1) {
    if (Math.abs(buffer[size - i]) < threshold) { end = size - i; break; }
  }

  const sliced = buffer.slice(start, end);
  const minFrequency = Math.max(28, frequencyRange.min);
  const maxFrequency = Math.min(700, frequencyRange.max);
  if (sliced.length < Math.floor(sampleRate / maxFrequency) * 2) return null;

  let bestOffset = -1;
  let bestCorrelation = Number.POSITIVE_INFINITY;
  const minOffset = Math.floor(sampleRate / maxFrequency);
  const maxOffset = Math.min(Math.floor(sampleRate / minFrequency), sliced.length - 1);

  const correlationAt = (offset) => {
    let correlation = 0;
    const sampleCount = sliced.length - offset;
    for (let i = 0; i < sampleCount; i += 1) correlation += Math.abs(sliced[i] - sliced[i + offset]);
    return correlation / Math.max(1, sampleCount);
  };

  for (let offset = minOffset; offset < maxOffset; offset += 1) {
    const correlation = correlationAt(offset);
    if (correlation < bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }
  if (bestOffset <= 0) return null;
  if (bestCorrelation > Math.max(0.09, rms * 2.8)) return null;

  const prev = bestOffset > minOffset ? correlationAt(bestOffset - 1) : bestCorrelation;
  const next = bestOffset < maxOffset - 1 ? correlationAt(bestOffset + 1) : bestCorrelation;
  const shift = (next - prev) / (2 * (2 * bestCorrelation - next - prev));
  const frequency = sampleRate / (bestOffset + (Number.isFinite(shift) ? shift : 0));
  if (!Number.isFinite(frequency) || frequency < minFrequency || frequency > maxFrequency) return null;
  return frequency;
}

// --- signal generators ---
function sine(freq, amplitude = 0.3) {
  const out = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i += 1) out[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE);
  return out;
}

// Plucked-string-like tone: strong upper harmonics (2nd harmonic louder than
// the fundamental), slight decay — the classic case for octave errors.
function pluck(freq, amplitude = 0.3) {
  const out = new Float32Array(SIZE);
  const harmonics = [0.6, 1.0, 0.55, 0.4, 0.28, 0.18, 0.1];
  for (let i = 0; i < SIZE; i += 1) {
    const t = i / SAMPLE_RATE;
    let sample = 0;
    for (let h = 0; h < harmonics.length; h += 1) {
      sample += harmonics[h] * Math.sin(2 * Math.PI * freq * (h + 1) * t + h * 0.7);
    }
    out[i] = amplitude * sample * Math.exp(-1.2 * t) * 0.35;
  }
  return out;
}

// 폰 마이크는 ~100Hz 아래를 급격히 깎는다: 저음현은 기본음이 거의 없이
// 배음만 들어온다. 주기성 기반 검출이 이 경우에도 옳은 음을 잡아야 한다.
function pluckMissingFundamental(freq, amplitude = 0.25) {
  const out = new Float32Array(SIZE);
  const harmonics = [0, 1.0, 0.6, 0.45, 0.3, 0.18];
  for (let i = 0; i < SIZE; i += 1) {
    const t = i / SAMPLE_RATE;
    let sample = 0;
    for (let h = 0; h < harmonics.length; h += 1) {
      sample += harmonics[h] * Math.sin(2 * Math.PI * freq * (h + 1) * t + h * 0.7);
    }
    out[i] = amplitude * sample * 0.35;
  }
  return out;
}

function scale(signal, factor) {
  const out = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i += 1) out[i] = signal[i] * factor;
  return out;
}

function rmsOf(signal) {
  let energy = 0;
  for (let i = 0; i < SIZE; i += 1) energy += signal[i] * signal[i];
  return Math.sqrt(energy / SIZE);
}

function whiteNoise(amplitude = 0.05, seed = 1) {
  const out = new Float32Array(SIZE);
  let state = seed;
  for (let i = 0; i < SIZE; i += 1) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    out[i] = amplitude * ((state / 4294967296) * 2 - 1);
  }
  return out;
}

function mix(a, b) {
  const out = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i += 1) out[i] = a[i] + b[i];
  return out;
}

const cents = (got, want) => 1200 * Math.log2(got / want);

// --- test cases: every open string of every instrument in the app ---
const STRINGS = [
  ['bass B0', 30.87, { min: 26, max: 140 }],
  ['bass E1', 41.2, { min: 28, max: 140 }],
  ['bass A1', 55.0, { min: 28, max: 140 }],
  ['cello C2', 65.41, { min: 47, max: 304 }],
  ['guitar E2', 82.41, { min: 59, max: 455 }],
  ['guitar A2', 110.0, { min: 59, max: 455 }],
  ['viola C3', 130.81, { min: 94, max: 608 }],
  ['guitar D3', 146.83, { min: 59, max: 455 }],
  ['guitar G3', 196.0, { min: 59, max: 455 }],
  ['cello A3', 220.0, { min: 47, max: 304 }],
  ['guitar B3', 246.94, { min: 59, max: 455 }],
  ['ukulele C4', 261.63, { min: 188, max: 608 }],
  ['guitar E4', 329.63, { min: 59, max: 455 }],
  ['violin A4', 440.0, { min: 141, max: 910 }],
  ['violin E5', 659.25, { min: 141, max: 910 }]
];

let pass = 0;
let fail = 0;
const lines = [];

function check(label, got, want, tolCents) {
  if (got == null) {
    fail += 1;
    lines.push(`  FAIL ${label}: no detection (expected ${want.toFixed(2)} Hz)`);
    return;
  }
  const err = cents(got, want);
  if (Math.abs(err) <= tolCents) {
    pass += 1;
    lines.push(`  ok   ${label}: ${got.toFixed(2)} Hz (${err >= 0 ? '+' : ''}${err.toFixed(1)}¢)`);
  } else {
    fail += 1;
    lines.push(`  FAIL ${label}: ${got.toFixed(2)} Hz, off by ${err.toFixed(1)}¢ (expected ${want.toFixed(2)} Hz)`);
  }
}

function expectNull(label, got) {
  if (got == null) {
    pass += 1;
    lines.push(`  ok   ${label}: correctly rejected`);
  } else {
    fail += 1;
    lines.push(`  FAIL ${label}: false detection ${got.toFixed(2)} Hz`);
  }
}

let legacyOctaveErrors = 0;
let newOctaveErrors = 0;

lines.push('— pure sine, exact pitch —');
for (const [label, freq, range] of STRINGS) {
  check(`sine ${label}`, detectPitch(sine(freq), SAMPLE_RATE, range.min, range.max), freq, 2);
}

lines.push('— plucked tone (harmonic-rich), exact pitch —');
for (const [label, freq, range] of STRINGS) {
  const signal = pluck(freq);
  const got = detectPitch(signal, SAMPLE_RATE, range.min, range.max);
  check(`pluck ${label}`, got, freq, 4);
  if (got != null && Math.abs(cents(got, freq)) > 80) newOctaveErrors += 1;
  const legacy = legacyAutoCorrelate(signal, SAMPLE_RATE, range);
  if (legacy != null && Math.abs(cents(legacy, freq)) > 80) legacyOctaveErrors += 1;
}

lines.push('— plucked tone, detuned ±30¢ —');
for (const [label, freq, range] of STRINGS) {
  const flat = freq * Math.pow(2, -30 / 1200);
  const sharp = freq * Math.pow(2, 30 / 1200);
  check(`pluck ${label} -30¢`, detectPitch(pluck(flat), SAMPLE_RATE, range.min, range.max), flat, 4);
  check(`pluck ${label} +30¢`, detectPitch(pluck(sharp), SAMPLE_RATE, range.min, range.max), sharp, 4);
}

lines.push('— noisy pluck (SNR ~10 dB) —');
for (const [label, freq, range] of STRINGS) {
  const signal = mix(pluck(freq), whiteNoise(0.03, 7));
  check(`noisy ${label}`, detectPitch(signal, SAMPLE_RATE, range.min, range.max), freq, 6);
}

lines.push('— quiet input (acoustic ring-out / unplugged electric) —');
let legacyQuietMisses = 0;
let newQuietMisses = 0;
for (const [label, freq, range] of STRINGS) {
  const base = pluck(freq);
  for (const targetRms of [0.004, 0.0015]) {
    const signal = scale(base, targetRms / rmsOf(base));
    const got = detectPitch(signal, SAMPLE_RATE, range.min, range.max);
    check(`quiet(${targetRms}) ${label}`, got, freq, 5);
    if (got == null) newQuietMisses += 1;
    if (legacyAutoCorrelate(signal, SAMPLE_RATE, range) == null) legacyQuietMisses += 1;
  }
}

lines.push('— missing fundamental (phone mic low-end rolloff) —');
for (const [label, freq, range] of STRINGS.filter(([, f]) => f < 150)) {
  check(`no-fund ${label}`, detectPitch(pluckMissingFundamental(freq), SAMPLE_RATE, range.min, range.max), freq, 4);
}

lines.push('— rejection cases —');
expectNull('silence', detectPitch(new Float32Array(SIZE), SAMPLE_RATE, 59, 455));
expectNull('white noise only', detectPitch(whiteNoise(0.08, 3), SAMPLE_RATE, 59, 455));
expectNull('very quiet noise', detectPitch(whiteNoise(0.004, 11), SAMPLE_RATE, 59, 455));

console.log(lines.join('\n'));
console.log(`\nlegacy detector octave errors on plucked tones: ${legacyOctaveErrors}/${STRINGS.length}`);
console.log(`new detector octave errors on plucked tones:    ${newOctaveErrors}/${STRINGS.length}`);
console.log(`legacy detector misses on quiet inputs: ${legacyQuietMisses}/${STRINGS.length * 2}`);
console.log(`new detector misses on quiet inputs:    ${newQuietMisses}/${STRINGS.length * 2}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
