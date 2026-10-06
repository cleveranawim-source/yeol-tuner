// CPU cost benchmark for detectPitch — quantifies the heat fix.
// Run: node scripts/bench-pitch.mjs
import { detectPitch } from '../src/pitch.js';

const SAMPLE_RATE = 48000;
const SIZE = 4096;

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

function roomNoise(amplitude = 0.01, seed = 5) {
  const out = new Float32Array(SIZE);
  let state = seed;
  for (let i = 0; i < SIZE; i += 1) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    out[i] = amplitude * ((state / 4294967296) * 2 - 1);
  }
  return out;
}

function bench(label, signal, min, max, iterations = 300) {
  // warmup
  for (let i = 0; i < 30; i += 1) detectPitch(signal, SAMPLE_RATE, min, max);
  const startedAt = performance.now();
  for (let i = 0; i < iterations; i += 1) detectPitch(signal, SAMPLE_RATE, min, max);
  const ms = (performance.now() - startedAt) / iterations;
  console.log(`${label.padEnd(38)} ${ms.toFixed(3)} ms/call`);
  return ms;
}

console.log('— per-call cost —');
const guitarPluck = bench('guitar E2 pluck (early exit)', pluck(82.41), 59, 455);
const guitarNoise = bench('guitar room-noise only (full scan)', roomNoise(), 59, 455);
const bassPluck = bench('bass B0 pluck (decimated)', pluck(30.87), 26, 140);
const bassNoise = bench('bass room-noise only (decimated)', roomNoise(), 26, 140);

console.log('\n— estimated CPU duty while idle in a noisy room —');
const oldIdle = (guitarNoise / 35) * 100;
const newIdle = (guitarNoise / 190) * 100;
console.log(`guitar idle before (35ms cadence):  ${oldIdle.toFixed(1)}% of one core`);
console.log(`guitar idle after  (190ms cadence): ${newIdle.toFixed(1)}% of one core`);
const oldBassIdle = ((bassNoise * 4) / 35) * 100; // decimation ≈ 4x per-call savings
const newBassIdle = (bassNoise / 190) * 100;
console.log(`bass idle before (est., no decim):  ${oldBassIdle.toFixed(1)}% of one core`);
console.log(`bass idle after:                    ${newBassIdle.toFixed(1)}% of one core`);
