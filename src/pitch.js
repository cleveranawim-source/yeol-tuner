// YIN pitch detection (de Cheveigné & Kawahara, 2002).
// Cumulative mean normalized difference + absolute threshold picks the FIRST
// dip (the fundamental period) instead of the global minimum, which is what
// makes it robust against the octave-down errors AMDF-style detectors suffer
// on harmonic-rich strings like a guitar low E.

export const DEFAULT_MIN_FREQUENCY = 26; // below 5-string bass B0 (30.87 Hz) with detune margin
export const DEFAULT_MAX_FREQUENCY = 950; // above violin E5 (659.25 Hz) with sharp margin

export function detectPitch(buffer, sampleRate, minFrequency, maxFrequency, options = {}) {
  const threshold = options.threshold ?? 0.15;
  const fallbackClarity = options.fallbackThreshold ?? 0.35;
  // 게이트는 "정말 무음인가"만 거른다. 소리/소음 구분은 진폭이 아니라
  // 아래 CMNDF 주기성 판정이 하므로, 게이트가 낮아도 오검출로 이어지지 않는다.
  // (통기타 여운, 앰프 없는 일렉기타 같은 조용한 입력을 살리는 핵심)
  const rmsGate = options.rmsGate ?? 0.001;

  const size = buffer.length;
  let energy = 0;
  for (let i = 0; i < size; i += 1) {
    energy += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(energy / size);
  if (rms < rmsGate) return null;

  const minFreq = Math.max(DEFAULT_MIN_FREQUENCY, minFrequency ?? DEFAULT_MIN_FREQUENCY);
  const maxFreq = Math.max(minFreq + 1, Math.min(DEFAULT_MAX_FREQUENCY, maxFrequency ?? DEFAULT_MAX_FREQUENCY));

  // Low ranges (bass, cello) suffer most from broadband noise: a short moving
  // average barely touches the harmonics that matter there but attenuates the
  // high-frequency noise that jitters the difference function.
  let samples = buffer;
  let rate = sampleRate;
  if (maxFreq <= 420) {
    const span = maxFreq <= 160 ? 8 : 4;
    const smoothed = new Float32Array(size);
    let windowSum = 0;
    for (let i = 0; i < size; i += 1) {
      windowSum += buffer[i];
      if (i >= span) windowSum -= buffer[i - span];
      smoothed[i] = windowSum / Math.min(i + 1, span);
    }
    samples = smoothed;
    // 베이스 대역은 MA-8 저역통과가 이미 걸려 있어 2배 데시메이션이 안전하다.
    // 창 길이와 최대 lag이 함께 절반이 되어 연산량이 약 4배 줄어든다 (발열 대책).
    if (maxFreq <= 160) {
      const half = size >> 1;
      const decimated = new Float32Array(half);
      for (let i = 0; i < half; i += 1) {
        decimated[i] = smoothed[i * 2];
      }
      samples = decimated;
      rate = sampleRate / 2;
    }
  }

  const length = samples.length;
  const maxLag = Math.min(Math.floor(rate / minFreq), Math.floor(length / 2));
  const minLag = Math.max(2, Math.floor(rate / maxFreq));
  if (maxLag - minLag < 4) return null;
  const window = Math.min(Math.floor(length / 2), length - maxLag);

  const cmndf = new Float32Array(maxLag + 1);
  cmndf[0] = 1;
  let cumulative = 0;
  let bestTau = -1;
  let bestValue = Number.POSITIVE_INFINITY;
  let pickedTau = -1;
  const minimaTaus = [];
  const minimaValues = [];

  for (let tau = 1; tau <= maxLag; tau += 1) {
    let diff = 0;
    for (let i = 0; i < window; i += 1) {
      const delta = samples[i] - samples[i + tau];
      diff += delta * delta;
    }
    cumulative += diff;
    const value = cumulative > 0 ? (diff * tau) / cumulative : 1;
    cmndf[tau] = value;

    if (tau < minLag) continue;

    if (value < bestValue) {
      bestValue = value;
      bestTau = tau;
    }

    // 약신호 폴백용 로컬 미니멈 수집 (tau-1이 양옆보다 낮으면 딥의 바닥)
    if (tau >= minLag + 2 && cmndf[tau - 1] < 0.45 && cmndf[tau - 1] < value && cmndf[tau - 1] <= cmndf[tau - 2]) {
      minimaTaus.push(tau - 1);
      minimaValues.push(cmndf[tau - 1]);
    }

    if (pickedTau < 0) {
      if (value < threshold) pickedTau = tau;
    } else if (value <= cmndf[pickedTau]) {
      pickedTau = tau; // still descending into the dip
    } else {
      break; // passed the local minimum of the first dip
    }
  }

  let tau = pickedTau;
  if (tau <= 0 && bestValue <= fallbackClarity) {
    // 임계값을 넘는 딥이 없는 약한 신호: 전역 최솟값만 믿으면 2배 주기
    // (옥타브 아래) 딥을 고르기 쉽다. 최솟값의 1.25배 안에 드는
    // 가장 짧은 주기의 로컬 미니멈을 골라 옥타브 오류를 막는다.
    const limit = Math.max(threshold, bestValue * 1.25);
    tau = bestTau;
    for (let i = 0; i < minimaTaus.length; i += 1) {
      if (minimaValues[i] <= limit) {
        tau = Math.min(tau, minimaTaus[i]);
        break; // 오름차순이라 첫 통과가 가장 짧은 주기
      }
    }
  }
  if (tau <= 0) return null;

  // Parabolic interpolation around the minimum for sub-sample period accuracy.
  const left = cmndf[tau - 1];
  const center = cmndf[tau];
  const right = tau + 1 <= maxLag && cmndf[tau + 1] > 0 ? cmndf[tau + 1] : center;
  const denom = left + right - 2 * center;
  let shift = denom !== 0 ? (left - right) / (2 * denom) : 0;
  if (!Number.isFinite(shift) || Math.abs(shift) > 1) shift = 0;

  const frequency = rate / (tau + shift);
  if (!Number.isFinite(frequency) || frequency < minFreq || frequency > maxFreq) return null;
  if (options.refine === false) return frequency;
  // 2단계: 찾은 주기 근처만, 기본음 위주로 다시 잰다 (원본 버퍼·원래 샘플레이트 사용).
  const refined = refinePitch(buffer, sampleRate, frequency);
  return refined >= minFreq && refined <= maxFreq ? refined : frequency;
}

// 실제 현은 비조화성 때문에 위 배음일수록 조금씩 높다(k번째 배음 ≈ k·f0·√(1+Bk²)).
// YIN은 모든 배음을 함께 보고 주기를 정하므로, 배음이 센 튕긴 직후엔 3~7센트,
// 울림이 이어지는 동안에도 1센트쯤 높게 읽는다(1.3.0 실측). 그래서 1단계가 찾은
// 주기 근처(±2.5%)만, 기본음의 2.2배에서 자른 4차 저역통과 신호로 다시 재
// 기본음 기준 값을 얻는다. 옥타브 판단은 1단계 것을 그대로 쓰고 바꾸지 않는다.
export function refinePitch(buffer, sampleRate, coarse) {
  const size = buffer.length;
  const period = sampleRate / coarse;
  const lagMin = Math.floor(period * 0.975);
  const lagMax = Math.ceil(period * 1.025);
  // 필터가 자리 잡는 시간(차단 주파수 2주기)과 비교할 한 주기가 버퍼에 다 들어가야 한다.
  // 5현 베이스 B0(주기 1555샘플)처럼 그게 안 되면 차단 주파수를 올려 자리 잡는 시간을 줄인다.
  const room = size - lagMax - 1 - Math.ceil(period);
  if (room <= 0) return coarse;
  const cutoff = Math.min(Math.max(coarse * 2.2, (2 * sampleRate) / room), coarse * 4, sampleRate * 0.45);
  const w0 = (2 * Math.PI * cutoff) / sampleRate;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  let filtered = buffer;
  // 버터워스 4차 = 바이쿼드 2단(Q 0.5412, 1.3066)
  for (const q of [0.5412, 1.3066]) {
    const alpha = sin / (2 * q);
    const a0 = 1 + alpha;
    const b0 = (1 - cos) / 2 / a0;
    const b1 = (1 - cos) / a0;
    const a1 = (-2 * cos) / a0;
    const a2 = (1 - alpha) / a0;
    const out = new Float32Array(size);
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < size; i += 1) {
      const x0 = filtered[i];
      const y0 = b0 * x0 + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
      out[i] = y0;
      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
    }
    filtered = out;
  }

  // 필터가 자리 잡는 앞부분은 건너뛴다.
  const start = Math.min(Math.ceil((2 * sampleRate) / cutoff), room);
  const window = Math.min(size - start - lagMax - 1, 2048);
  if (window < period || lagMax - lagMin < 2) return coarse;

  // 정규화 상호상관: 소리가 줄어드는(감쇠) 것에 흔들리지 않는다.
  const correlations = new Float32Array(lagMax - lagMin + 1);
  let bestIndex = -1;
  let best = -Infinity;
  for (let lag = lagMin; lag <= lagMax; lag += 1) {
    let xy = 0;
    let xx = 0;
    let yy = 0;
    for (let i = start; i < start + window; i += 1) {
      const a = filtered[i];
      const b = filtered[i + lag];
      xy += a * b;
      xx += a * a;
      yy += b * b;
    }
    const value = xx > 0 && yy > 0 ? xy / Math.sqrt(xx * yy) : 0;
    correlations[lag - lagMin] = value;
    if (value > best) {
      best = value;
      bestIndex = lag - lagMin;
    }
  }
  // 범위 끝에 걸리거나 주기성이 약하면(잡음) 1단계 값을 쓴다.
  if (bestIndex <= 0 || bestIndex >= correlations.length - 1 || best < 0.5) return coarse;

  const left = correlations[bestIndex - 1];
  const right = correlations[bestIndex + 1];
  const denom = left + right - 2 * best;
  const shift = denom !== 0 ? (left - right) / (2 * denom) : 0;
  if (!Number.isFinite(shift) || Math.abs(shift) > 1) return coarse;
  const refined = sampleRate / (lagMin + bestIndex + shift);
  return Math.abs(1200 * Math.log2(refined / coarse)) <= 30 ? refined : coarse;
}
