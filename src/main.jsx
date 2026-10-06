import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Mic, MicOff, Music, Play, RotateCcw, Settings, Square, Timer, Vibrate, Volume2, Zap } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { detectPitch } from './pitch.js';
import './styles.css';

// 화면 유지: 웹 표준 wakeLock은 iOS 웹뷰에서 무시되므로 네이티브 플러그인으로
// OS의 화면 자동잠금을 직접 제어한다. 튜너 청취/메트로놈 재생 중 하나라도
// 활성이면 화면을 켜 두고, 둘 다 꺼지면 원래대로 되돌린다.
const keepAwakeOwners = { tuner: false, metronome: false };
function setKeepAwake(owner, active) {
  keepAwakeOwners[owner] = active;
  const stayAwake = keepAwakeOwners.tuner || keepAwakeOwners.metronome;
  (stayAwake ? KeepAwake.keepAwake() : KeepAwake.allowSleep()).catch(() => {});
}

const INSTRUMENTS = {
  guitar: {
    label: 'Guitar',
    tunings: {
      standard: {
        label: 'Standard',
        strings: [
          { id: 'guitar-standard-E2', name: '6E', note: 'E2', freq: 82.41 },
          { id: 'guitar-standard-A2', name: '5A', note: 'A2', freq: 110.0 },
          { id: 'guitar-standard-D3', name: '4D', note: 'D3', freq: 146.83 },
          { id: 'guitar-standard-G3', name: '3G', note: 'G3', freq: 196.0 },
          { id: 'guitar-standard-B3', name: '2B', note: 'B3', freq: 246.94 },
          { id: 'guitar-standard-E4', name: '1E', note: 'E4', freq: 329.63 }
        ]
      },
      dropD: {
        label: 'Drop D',
        strings: [
          { id: 'guitar-dropD-D2', name: '6D', note: 'D2', freq: 73.42 },
          { id: 'guitar-dropD-A2', name: '5A', note: 'A2', freq: 110.0 },
          { id: 'guitar-dropD-D3', name: '4D', note: 'D3', freq: 146.83 },
          { id: 'guitar-dropD-G3', name: '3G', note: 'G3', freq: 196.0 },
          { id: 'guitar-dropD-B3', name: '2B', note: 'B3', freq: 246.94 },
          { id: 'guitar-dropD-E4', name: '1E', note: 'E4', freq: 329.63 }
        ]
      }
    }
  },
  bass: {
    label: 'Bass Guitar',
    tunings: {
      standard: {
        label: 'Standard',
        strings: [
          { id: 'bass-standard-E1', name: '4E', note: 'E1', freq: 41.2 },
          { id: 'bass-standard-A1', name: '3A', note: 'A1', freq: 55.0 },
          { id: 'bass-standard-D2', name: '2D', note: 'D2', freq: 73.42 },
          { id: 'bass-standard-G2', name: '1G', note: 'G2', freq: 98.0 }
        ]
      },
      fiveString: {
        label: '5-String',
        strings: [
          { id: 'bass-five-B0', name: '5B', note: 'B0', freq: 30.87 },
          { id: 'bass-five-E1', name: '4E', note: 'E1', freq: 41.2 },
          { id: 'bass-five-A1', name: '3A', note: 'A1', freq: 55.0 },
          { id: 'bass-five-D2', name: '2D', note: 'D2', freq: 73.42 },
          { id: 'bass-five-G2', name: '1G', note: 'G2', freq: 98.0 }
        ]
      },
      dropD: {
        label: 'Drop D',
        strings: [
          { id: 'bass-dropD-D1', name: '4D', note: 'D1', freq: 36.71 },
          { id: 'bass-dropD-A1', name: '3A', note: 'A1', freq: 55.0 },
          { id: 'bass-dropD-D2', name: '2D', note: 'D2', freq: 73.42 },
          { id: 'bass-dropD-G2', name: '1G', note: 'G2', freq: 98.0 }
        ]
      }
    }
  },
  cello: {
    label: 'Cello',
    tunings: {
      standard: {
        label: 'Standard',
        strings: [
          { id: 'cello-standard-C2', name: '4C', note: 'C2', freq: 65.41 },
          { id: 'cello-standard-G2', name: '3G', note: 'G2', freq: 98.0 },
          { id: 'cello-standard-D3', name: '2D', note: 'D3', freq: 146.83 },
          { id: 'cello-standard-A3', name: '1A', note: 'A3', freq: 220.0 }
        ]
      }
    }
  },
  viola: {
    label: 'Viola',
    tunings: {
      standard: {
        label: 'Standard',
        strings: [
          { id: 'viola-standard-C3', name: '4C', note: 'C3', freq: 130.81 },
          { id: 'viola-standard-G3', name: '3G', note: 'G3', freq: 196.0 },
          { id: 'viola-standard-D4', name: '2D', note: 'D4', freq: 293.66 },
          { id: 'viola-standard-A4', name: '1A', note: 'A4', freq: 440.0 }
        ]
      }
    }
  },
  violin: {
    label: 'Violin',
    tunings: {
      standard: {
        label: 'Standard',
        strings: [
          { id: 'violin-standard-G3', name: '4G', note: 'G3', freq: 196.0 },
          { id: 'violin-standard-D4', name: '3D', note: 'D4', freq: 293.66 },
          { id: 'violin-standard-A4', name: '2A', note: 'A4', freq: 440.0 },
          { id: 'violin-standard-E5', name: '1E', note: 'E5', freq: 659.25 }
        ]
      }
    }
  },
  doubleBass: {
    label: 'Double Bass',
    tunings: {
      standard: {
        label: 'Standard',
        strings: [
          { id: 'double-bass-standard-E1', name: '4E', note: 'E1', freq: 41.2 },
          { id: 'double-bass-standard-A1', name: '3A', note: 'A1', freq: 55.0 },
          { id: 'double-bass-standard-D2', name: '2D', note: 'D2', freq: 73.42 },
          { id: 'double-bass-standard-G2', name: '1G', note: 'G2', freq: 98.0 }
        ]
      },
      solo: {
        label: 'Solo',
        strings: [
          { id: 'double-bass-solo-F#1', name: '4F#', note: 'F#1', freq: 46.25 },
          { id: 'double-bass-solo-B1', name: '3B', note: 'B1', freq: 61.74 },
          { id: 'double-bass-solo-E2', name: '2E', note: 'E2', freq: 82.41 },
          { id: 'double-bass-solo-A2', name: '1A', note: 'A2', freq: 110.0 }
        ]
      }
    }
  },
  ukulele: {
    label: 'Ukulele',
    tunings: {
      standard: {
        label: 'Standard',
        strings: [
          { id: 'ukulele-standard-G4', name: '4G', note: 'G4', freq: 392.0 },
          { id: 'ukulele-standard-C4', name: '3C', note: 'C4', freq: 261.63 },
          { id: 'ukulele-standard-E4', name: '2E', note: 'E4', freq: 329.63 },
          { id: 'ukulele-standard-A4', name: '1A', note: 'A4', freq: 440.0 }
        ]
      },
      lowG: {
        label: 'Low G',
        strings: [
          { id: 'ukulele-lowG-G3', name: '4G', note: 'G3', freq: 196.0 },
          { id: 'ukulele-lowG-C4', name: '3C', note: 'C4', freq: 261.63 },
          { id: 'ukulele-lowG-E4', name: '2E', note: 'E4', freq: 329.63 },
          { id: 'ukulele-lowG-A4', name: '1A', note: 'A4', freq: 440.0 }
        ]
      }
    }
  },
  mandolin: {
    label: 'Mandolin',
    tunings: {
      standard: {
        label: 'Standard',
        strings: [
          { id: 'mandolin-standard-G3', name: '4G', note: 'G3', freq: 196.0 },
          { id: 'mandolin-standard-D4', name: '3D', note: 'D4', freq: 293.66 },
          { id: 'mandolin-standard-A4', name: '2A', note: 'A4', freq: 440.0 },
          { id: 'mandolin-standard-E5', name: '1E', note: 'E5', freq: 659.25 }
        ]
      }
    }
  },
  banjo: {
    label: 'Banjo',
    tunings: {
      openG: {
        label: 'Open G',
        strings: [
          { id: 'banjo-openG-G4', name: '5G', note: 'G4', freq: 392.0 },
          { id: 'banjo-openG-D3', name: '4D', note: 'D3', freq: 146.83 },
          { id: 'banjo-openG-G3', name: '3G', note: 'G3', freq: 196.0 },
          { id: 'banjo-openG-B3', name: '2B', note: 'B3', freq: 246.94 },
          { id: 'banjo-openG-D4', name: '1D', note: 'D4', freq: 293.66 }
        ]
      }
    }
  }
};

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

// 오케스트라·앙상블 관례에 맞춘 기준음(A4) 범위. 국내 오케스트라는 442Hz가 일반적.
const REFERENCE_PITCHES = Array.from({ length: 11 }, (_, i) => 435 + i);
const DEFAULT_REFERENCE_PITCH = 440;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ACTIVE_PITCH_ANALYSIS_INTERVAL_MS = 45;
const IDLE_PITCH_ANALYSIS_INTERVAL_MS = 95;
// AGC가 증폭한 실내 소음만 들리는 상태(음정 없음)에서는 분석 주기를 크게 늦춰
// CPU·발열을 줄인다. 줄을 튕기면 RMS가 잡음 바닥 위로 튀어 즉시 고속 복귀.
const NOISY_IDLE_ANALYSIS_INTERVAL_MS = 190;
// 화면 갱신은 DSP와 분리해 최대 이 간격으로만 리렌더한다. 실제 줄은 감쇠·비브라토로
// 매 프레임 흔들려 값이 계속 미세하게 바뀌므로, 시간 상한으로 리렌더/리페인트 빈도를
// 고정해야 발열이 잡힌다 (사람 눈엔 ~14Hz 니들이면 충분히 부드럽다).
const UI_UPDATE_INTERVAL_MS = 70;
// 튕긴 직후(어택)는 줄 장력 변화로 실제 음이 잠깐 높게 시작한다: 이 구간은 표시하지 않는다.
const ATTACK_MASK_MS = 130;
// 가장 가까운 줄과의 거리(센트)에 따라 표시 안정화 강도를 바꾼다:
// 멀면 기민하게 따라가고, 가까울수록 무겁게 눌러 바늘이 진득해진다.
const NEAR_CENTS = 5;
const MID_CENTS = 12;
// 락인(안착): 이 범위 안에서 이 시간만큼 머물면 바늘을 고정하고,
// 이탈 범위를 두 프레임 연속 벗어나야 다시 풀어준다.
const LOCK_ENTER_CENTS = 4;
const LOCK_EXIT_CENTS = 7;
const LOCK_AFTER_MS = 600;
// 마지막 검출 후 이 시간 동안은 고속 분석을 유지한다 (여운 추적).
const ACTIVE_HOLD_MS = 1200;
// 줄을 다시 튕기지 않아도 줄감개를 돌릴 시간을 주도록, 소리가 사라진 뒤에도
// 마지막 측정값을 잠시 화면에 들고 있는다.
const HOLD_LAST_READING_MS = 2600;
// "정말 무음"만 거르는 낮은 게이트. 소리/소음 구분은 검출기의 주기성 판정이 한다.
const SIGNAL_GATE = 0.001;
// 한 프레임만 크게 튄 값(노이즈·옥타브 글리치)은 버리고, 두 프레임 연속이면 실제 음 변경으로 확정
const PITCH_JUMP_CENTS = 80;
const PITCH_CONFIRM_CENTS = 60;
const IN_TUNE_ENTER_CENTS = 4;
const IN_TUNE_EXIT_CENTS = 7;

function frequencyToNote(frequency, referencePitch = DEFAULT_REFERENCE_PITCH) {
  const midi = Math.round(69 + 12 * Math.log2(frequency / referencePitch));
  const noteName = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  const noteFreq = referencePitch * Math.pow(2, (midi - 69) / 12);
  return { name: `${noteName}${octave}`, freq: noteFreq, midi };
}

function centsOff(input, target) {
  return 1200 * Math.log2(input / target);
}

function getInstrumentShape(instrumentKey) {
  if (['violin', 'viola', 'cello', 'doubleBass'].includes(instrumentKey)) return 'bowed';
  if (instrumentKey === 'banjo') return 'banjo';
  if (instrumentKey === 'mandolin') return 'mandolin';
  if (instrumentKey === 'ukulele') return 'ukulele';
  if (instrumentKey === 'bass') return 'bass';
  return 'guitar';
}

// memo: 악기 그림은 가장 큰 DOM 서브트리다. 주파수가 갱신되어도 같은 줄을 잡고
// 있으면 props가 안 바뀌므로 리렌더/리페인트를 건너뛴다 (발열 핵심).
const InstrumentVisual = memo(function InstrumentVisual({ instrumentKey, instrument, strings, activeString }) {
  const shape = getInstrumentShape(instrumentKey);
  const activeIndex = Math.max(0, strings.findIndex((string) => string.id === activeString.id));

  return (
    <div className={`instrument-visual ${shape} ${instrumentKey}`} aria-label={`${instrument.label} 현 위치`}>
      <div className="instrument-label">
        <span>{instrument.label}</span>
        <strong>{activeString.name}</strong>
      </div>
      <div className="instrument-art" style={{ '--string-count': strings.length }}>
        <div className="head">
          <span className="scroll" />
          <span className="peg peg-a" />
          <span className="peg peg-b" />
          <span className="peg peg-c" />
          <span className="peg peg-d" />
        </div>
        <div className="neck">
          {strings.map((string, index) => (
            <span
              key={string.id}
              className={`visual-string ${index === activeIndex ? 'active' : ''}`}
              style={{ '--string-index': index }}
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="body">
          <span className="sound-hole" />
        </div>
      </div>
    </div>
  );
});

// memo: 줄 선택 버튼 6개도 매 프레임 재조정되던 서브트리다. 감지 대상 줄이
// 바뀔 때만(=드물게) 리렌더된다.
const StringGrid = memo(function StringGrid({ strings, label, mode, selectedId, currentId, onSelect }) {
  return (
    <section className="strings" aria-label={`${label} 줄 선택`}>
      {strings.map((string) => {
        const active = mode === 'manual' && selectedId === string.id;
        const current = currentId === string.id;
        return (
          <button
            key={string.id}
            className={`${active ? 'selected' : ''} ${current ? 'current' : ''}`}
            onClick={() => onSelect(string.id)}
          >
            <strong>{string.name}</strong>
            <span>{string.note}</span>
            <small>{string.freq.toFixed(2)} Hz</small>
          </button>
        );
      })}
    </section>
  );
});

const METRONOME_DEFAULTS = { bpm: 100, beats: 4, sound: true, haptic: false, flash: false };
const METRONOME_MIN_BPM = 40;
const METRONOME_MAX_BPM = 240;

function loadMetronomeSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem('yeolTuner.metronome') ?? '{}');
    return { ...METRONOME_DEFAULTS, ...raw, bpm: Math.max(METRONOME_MIN_BPM, Math.min(METRONOME_MAX_BPM, raw.bpm ?? METRONOME_DEFAULTS.bpm)) };
  } catch {
    return { ...METRONOME_DEFAULTS };
  }
}

function Metronome() {
  const [settings, setSettings] = useState(loadMetronomeSettings);
  const [isRunning, setIsRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);

  const audioCtxRef = useRef(null);
  const timerRef = useRef(null);
  const nextNoteTimeRef = useRef(0);
  const beatIndexRef = useRef(0);
  const settingsRef = useRef(settings);
  const flashRef = useRef(null);
  const tapTimesRef = useRef([]);

  useEffect(() => {
    settingsRef.current = settings;
    localStorage.setItem('yeolTuner.metronome', JSON.stringify(settings));
  }, [settings]);

  const update = (patch) => setSettings((prev) => ({ ...prev, ...patch }));
  const clampBpm = (value) => Math.max(METRONOME_MIN_BPM, Math.min(METRONOME_MAX_BPM, Math.round(value)));

  function triggerHaptic(accent) {
    // 네이티브(iOS/Android)는 Capacitor Haptics, 웹은 navigator.vibrate 폴백.
    Haptics.impact({ style: accent ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {
      try {
        navigator.vibrate?.(accent ? 30 : 15);
      } catch {
        /* 미지원 환경 */
      }
    });
  }

  function triggerFlash(accent) {
    flashRef.current?.animate(
      [{ opacity: accent ? 1 : 0.72 }, { opacity: 0 }],
      { duration: 150, easing: 'ease-out' }
    );
  }

  function scheduleBeat(beatNumber, time) {
    const ctx = audioCtxRef.current;
    const accent = beatNumber === 0 && settingsRef.current.beats > 1;
    if (settingsRef.current.sound) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = accent ? 1568 : 1047;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.33, time + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.055);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.08);
    }
    // 진동·번쩍임·비트 표시는 오디오 예약 시각에 맞춰 지연 실행
    const delay = Math.max(0, (time - ctx.currentTime) * 1000);
    window.setTimeout(() => {
      if (!timerRef.current) return; // 정지 후 도착한 예약은 무시
      setCurrentBeat(beatNumber);
      if (settingsRef.current.flash) triggerFlash(accent);
      if (settingsRef.current.haptic) triggerHaptic(accent);
    }, delay);
  }

  // 표준 룩어헤드 스케줄러: setTimeout(25ms)으로 돌면서 120ms 앞까지
  // AudioContext 시계에 예약 → JS 타이머 지터와 무관하게 박자가 정확하다.
  function schedulerLoop() {
    const ctx = audioCtxRef.current;
    while (nextNoteTimeRef.current < ctx.currentTime + 0.12) {
      scheduleBeat(beatIndexRef.current, nextNoteTimeRef.current);
      nextNoteTimeRef.current += 60 / settingsRef.current.bpm;
      beatIndexRef.current = (beatIndexRef.current + 1) % settingsRef.current.beats;
    }
    // 120ms 앞까지 예약하므로 50ms 폴링으로 충분하다 (웨이크업 절반으로 발열↓).
    timerRef.current = window.setTimeout(schedulerLoop, 50);
  }

  async function start() {
    if (timerRef.current) return;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContextCtor();
    if (audioCtxRef.current.state !== 'running') {
      try {
        await audioCtxRef.current.resume();
      } catch {
        /* 시작 버튼이 사용자 제스처이므로 보통 성공한다 */
      }
    }
    beatIndexRef.current = 0;
    nextNoteTimeRef.current = audioCtxRef.current.currentTime + 0.06;
    setIsRunning(true);
    schedulerLoop();
    setKeepAwake('metronome', true);
  }

  function stop() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setIsRunning(false);
    setCurrentBeat(-1);
    setKeepAwake('metronome', false);
  }

  function tapTempo() {
    const now = performance.now();
    const taps = tapTimesRef.current.filter((t) => now - t < 3000);
    taps.push(now);
    tapTimesRef.current = taps;
    if (taps.length >= 2) {
      const intervals = taps.slice(1).map((t, i) => t - taps[i]);
      const average = intervals.reduce((sum, v) => sum + v, 0) / intervals.length;
      update({ bpm: clampBpm(60000 / average) });
    }
  }

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      audioCtxRef.current?.close().catch(() => {});
      setKeepAwake('metronome', false);
    };
  }, []);

  return (
    <div className="tuner-console metronome-console">
      <div className="readout">
        <p className="eyebrow">{isRunning ? 'Playing' : 'Metronome'}</p>
        <h1>{settings.bpm}</h1>
        <p className="status idle">BPM</p>
      </div>

      <div className="beat-dots" aria-label="박자 표시">
        {Array.from({ length: settings.beats }).map((_, index) => (
          <span
            key={index}
            className={`beat-dot ${index === currentBeat ? 'on' : ''} ${index === 0 && settings.beats > 1 ? 'accent' : ''}`}
          />
        ))}
      </div>

      <div className="bpm-controls">
        <button className="bpm-step" onClick={() => update({ bpm: clampBpm(settings.bpm - 1) })} aria-label="1 느리게">−1</button>
        <input
          type="range"
          min={METRONOME_MIN_BPM}
          max={METRONOME_MAX_BPM}
          value={settings.bpm}
          onChange={(event) => update({ bpm: clampBpm(Number(event.target.value)) })}
          aria-label="템포 (BPM)"
        />
        <button className="bpm-step" onClick={() => update({ bpm: clampBpm(settings.bpm + 1) })} aria-label="1 빠르게">+1</button>
      </div>

      <div className="metro-row">
        <div className="beats-stepper" aria-label="마디당 박자 수">
          <button onClick={() => update({ beats: Math.max(1, settings.beats - 1) })} aria-label="박자 줄이기">−</button>
          <span>{settings.beats}박</span>
          <button onClick={() => update({ beats: Math.min(8, settings.beats + 1) })} aria-label="박자 늘리기">+</button>
        </div>
        <button className="tap-tempo" onClick={tapTempo}>TAP</button>
      </div>

      <div className="metro-toggles" aria-label="박자 피드백 방식">
        <button className={settings.sound ? 'on' : ''} onClick={() => update({ sound: !settings.sound })} aria-pressed={settings.sound}>
          <Volume2 aria-hidden="true" />소리
        </button>
        <button className={settings.haptic ? 'on' : ''} onClick={() => update({ haptic: !settings.haptic })} aria-pressed={settings.haptic}>
          <Vibrate aria-hidden="true" />진동
        </button>
        <button className={settings.flash ? 'on' : ''} onClick={() => update({ flash: !settings.flash })} aria-pressed={settings.flash}>
          <Zap aria-hidden="true" />번쩍임
        </button>
      </div>

      <div className="actions">
        <button className={`mic ${isRunning ? 'live' : ''}`} onClick={isRunning ? stop : start}>
          {isRunning ? <Square aria-hidden="true" /> : <Play aria-hidden="true" />}
          {isRunning ? '정지' : '시작'}
        </button>
      </div>

      <div ref={flashRef} className="metro-flash" aria-hidden="true" />
    </div>
  );
}

function App() {
  const [view, setView] = useState('tuner');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');
  const [needsGestureStart, setNeedsGestureStart] = useState(false);
  const [frequency, setFrequency] = useState(null);
  const [volume, setVolume] = useState(0);
  const [instrumentKey, setInstrumentKey] = useState('guitar');
  const [tuningKey, setTuningKey] = useState('standard');
  const [selectedStringId, setSelectedStringId] = useState('guitar-standard-E2');
  const [mode, setMode] = useState('auto');
  const [referencePitch, setReferencePitch] = useState(() => {
    const stored = Number(localStorage.getItem('yeolTuner.referencePitch'));
    return REFERENCE_PITCHES.includes(stored) ? stored : DEFAULT_REFERENCE_PITCH;
  });

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const bufferRef = useRef(null);
  const isStartingRef = useRef(false);
  const isListeningRef = useRef(false);
  const userStoppedRef = useRef(false);
  const lastPitchAtRef = useRef(0);
  const smoothedPitchRef = useRef(null);
  const jumpCandidateRef = useRef(null);
  const rawPitchHistoryRef = useRef([]);
  const noiseFloorRef = useRef(SIGNAL_GATE);
  const publishedPitchRef = useRef(null);
  const lastFreqPublishAtRef = useRef(0);
  const lastVolumeAtRef = useRef(0);
  const stringsRef = useRef([]);
  const onsetAtRef = useRef(0);
  const missedFramesRef = useRef(3);
  const lockActiveRef = useRef(false);
  const lockSinceRef = useRef(0);
  const unlockStrikesRef = useRef(0);
  const tuningRangeRef = useRef({ min: 26, max: 950 });
  const inTuneRef = useRef(false);

  const instrument = INSTRUMENTS[instrumentKey];
  const activeTuningKey = instrument.tunings[tuningKey] ? tuningKey : Object.keys(instrument.tunings)[0];
  const tuning = instrument.tunings[activeTuningKey];

  // 기준음(A4)을 바꾸면 모든 현의 목표 주파수가 함께 이동한다 (평균율 비율 유지).
  const calibratedStrings = useMemo(
    () => tuning.strings.map((string) => ({ ...string, freq: string.freq * (referencePitch / DEFAULT_REFERENCE_PITCH) })),
    [tuning, referencePitch]
  );

  const tuningRange = useMemo(() => {
    const freqs = calibratedStrings.map((string) => string.freq);
    return {
      min: Math.max(26, Math.min(...freqs) * 0.72),
      max: Math.min(950, Math.max(...freqs) * 1.38)
    };
  }, [calibratedStrings]);

  // tick()은 마운트 시점 클로저로 돌기 때문에 분석 범위는 ref로 전달해야
  // 악기/튜닝을 바꿔도 즉시 반영된다 (이전 버전의 스테일 클로저 버그 수정).
  useEffect(() => {
    tuningRangeRef.current = tuningRange;
  }, [tuningRange]);

  // 바늘 안정화(락인)가 목표 줄과의 거리를 알 수 있도록 현재 튜닝을 ref로 전달.
  useEffect(() => {
    stringsRef.current = calibratedStrings;
  }, [calibratedStrings]);

  const selectedString = useMemo(() => {
    return calibratedStrings.find((string) => string.id === selectedStringId) ?? calibratedStrings[0];
  }, [selectedStringId, calibratedStrings]);

  const detected = useMemo(() => {
    if (!frequency) return null;
    const nearest = frequencyToNote(frequency, referencePitch);
    const target = mode === 'auto'
      ? calibratedStrings.reduce((best, string) => {
          const distance = Math.abs(centsOff(frequency, string.freq));
          return distance < best.distance ? { string, distance } : best;
        }, { string: calibratedStrings[0], distance: Number.POSITIVE_INFINITY }).string
      : selectedString;
    return {
      frequency,
      nearest,
      target,
      cents: centsOff(frequency, target.freq)
    };
  }, [frequency, mode, selectedString, calibratedStrings, referencePitch]);

  // ±4¢에서 들어와 ±7¢에서 나가는 히스테리시스로 경계 플리커를 막는다.
  if (!detected) {
    inTuneRef.current = false;
  } else {
    const distance = Math.abs(detected.cents);
    inTuneRef.current = inTuneRef.current ? distance <= IN_TUNE_EXIT_CENTS : distance <= IN_TUNE_ENTER_CENTS;
  }
  const isInTune = inTuneRef.current;

  const displayCents = detected ? Math.max(-50, Math.min(50, detected.cents)) : 0;
  const roundedCents = detected ? Math.round(detected.cents) : 0;
  const visualString = detected?.target ?? selectedString;
  const tuneTone = !detected ? 'idle' : isInTune ? 'good' : detected.cents < 0 ? 'flat' : 'sharp';
  const tuneState = !detected
    ? '대기 중'
    : isInTune
      ? '정확해요'
      : Math.abs(detected.cents) <= 12
        ? detected.cents < 0
          ? '조금 올려요'
          : '조금 내려요'
        : detected.cents < 0
          ? '음을 올려요'
          : '음을 낮춰요';
  const actionGuide = !detected
    ? { mark: '0', label: '소리가 들리면 자동으로 잡아요', sub: '가운데에서 대기 중' }
    : isInTune
      ? { mark: '✓', label: '좋아요, 거의 정확해요', sub: `${detected.target.name} ${detected.target.freq.toFixed(2)} Hz` }
      : detected.cents < 0
        ? { mark: '♭', label: '줄을 조금 더 조여요', sub: `${Math.abs(roundedCents)} cents 낮아요` }
        : { mark: '♯', label: '줄을 조금 풀어요', sub: `${roundedCents} cents 높아요` };

  function resetMeasurement() {
    smoothedPitchRef.current = null;
    jumpCandidateRef.current = null;
    rawPitchHistoryRef.current = [];
    publishedPitchRef.current = null;
    lastPitchAtRef.current = 0;
    onsetAtRef.current = 0;
    missedFramesRef.current = 3;
    lockActiveRef.current = false;
    lockSinceRef.current = 0;
    unlockStrikesRef.current = 0;
    setFrequency(null);
  }

  // 안정적 참조여야 StringGrid의 memo가 유지된다.
  const selectString = useCallback((id) => {
    setMode('manual');
    setSelectedStringId(id);
  }, []);

  function tick() {
    const analyser = analyserRef.current;
    const buffer = bufferRef.current;
    const audioContext = audioContextRef.current;
    if (!analyser || !buffer || !audioContext) return;

    analyser.getFloatTimeDomainData(buffer);
    let energy = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      energy += buffer[i] * buffer[i];
    }
    const signalLevel = Math.sqrt(energy / buffer.length);
    const now = performance.now();

    // 입력 레벨 표시는 장식용이므로 최대 ~6.5Hz로만 갱신하고 5% 단위로 양자화한다.
    // (연주 중 매 프레임 % 변화가 그 자체로 전체 리렌더를 유발하던 발열 원인 제거)
    if (now - lastVolumeAtRef.current > 150) {
      lastVolumeAtRef.current = now;
      const volumeStep = Math.min(100, Math.round((signalLevel * 2800) / 5) * 5);
      setVolume((previous) => (previous === volumeStep ? previous : volumeStep));
    }

    const range = tuningRangeRef.current;
    const pitch = detectPitch(buffer, audioContext.sampleRate, range.min, range.max, { rmsGate: SIGNAL_GATE });

    if (pitch) {
      // 무음(검출기가 3프레임 이상 놓친 상태) 뒤 첫 검출 = 새로 튕긴 것.
      // 벽시계 시간이 아닌 프레임 수 기준이라 타이머가 느려져도 오판하지 않는다.
      if (missedFramesRef.current >= 3) {
        onsetAtRef.current = now;
        lockActiveRef.current = false;
        lockSinceRef.current = 0;
        unlockStrikesRef.current = 0;
      }
      missedFramesRef.current = 0;
      lastPitchAtRef.current = now;
      const masked = now - onsetAtRef.current < ATTACK_MASK_MS;

      // 최근 3프레임 미디언: 단발성 튐(노이즈 프레임)을 제거해 표시 정밀도를 높인다.
      const history = rawPitchHistoryRef.current;
      history.push(pitch);
      if (history.length > 3) history.shift();
      const median = history.length === 3 ? [...history].sort((a, b) => a - b)[1] : pitch;

      const previous = smoothedPitchRef.current;
      if (previous && Math.abs(centsOff(median, previous)) > PITCH_JUMP_CENTS) {
        const candidate = jumpCandidateRef.current;
        if (candidate && Math.abs(centsOff(median, candidate)) < PITCH_CONFIRM_CENTS) {
          smoothedPitchRef.current = median;
          jumpCandidateRef.current = null;
          // 다른 줄/음으로 넘어감 = 새 어택으로 취급
          onsetAtRef.current = now;
          lockActiveRef.current = false;
          lockSinceRef.current = 0;
        } else {
          jumpCandidateRef.current = median;
        }
      } else {
        jumpCandidateRef.current = null;

        // 가장 가까운 줄과의 거리(센트)가 표시 안정화 강도를 정한다.
        let distance = Number.POSITIVE_INFINITY;
        for (const string of stringsRef.current) {
          const off = Math.abs(centsOff(median, string.freq));
          if (off < distance) distance = off;
        }

        // 락인 상태 기계: ±4¢ 안에서 0.6초 → 안착. ±7¢ 두 프레임 연속 → 해제.
        if (distance <= LOCK_ENTER_CENTS) {
          if (!lockSinceRef.current) lockSinceRef.current = now;
          if (now - lockSinceRef.current >= LOCK_AFTER_MS) lockActiveRef.current = true;
          unlockStrikesRef.current = 0;
        } else {
          lockSinceRef.current = 0;
          if (lockActiveRef.current) {
            if (distance > LOCK_EXIT_CENTS) {
              unlockStrikesRef.current += 1;
              if (unlockStrikesRef.current >= 2) {
                lockActiveRef.current = false;
                unlockStrikesRef.current = 0;
              }
            } else {
              unlockStrikesRef.current = 0;
            }
          }
        }

        if (previous) {
          // 어택 중엔 빠르게 수렴(표시는 안 함), 이후엔 목표에 가까울수록 무겁게:
          // 원거리는 기민, 근접은 진득, 락 상태는 거의 고정.
          const alpha = masked
            ? 0.6
            : lockActiveRef.current
              ? 0.06
              : distance <= NEAR_CENTS
                ? 0.1
                : distance <= MID_CENTS
                  ? 0.25
                  : 0.45;
          smoothedPitchRef.current = previous * (1 - alpha) + median * alpha;
        } else {
          smoothedPitchRef.current = median;
        }
      }

      // 어택 마스크 중엔 화면에 내보내지 않는다(튕길 때 바늘이 위로 튀는 현상 제거).
      // 데드밴드: 락 중엔 미세 진동(±1.5¢)을 무시해 바늘이 앉아 있게 한다.
      const nextPitch = smoothedPitchRef.current;
      const published = publishedPitchRef.current;
      const deadband = lockActiveRef.current ? 1.5 : 0.3;
      const movedEnough = !published || Math.abs(centsOff(nextPitch, published)) > deadband;
      if (!masked && movedEnough && now - lastFreqPublishAtRef.current >= UI_UPDATE_INTERVAL_MS) {
        publishedPitchRef.current = nextPitch;
        lastFreqPublishAtRef.current = now;
        setFrequency(nextPitch);
      }
    } else {
      jumpCandidateRef.current = null;
      rawPitchHistoryRef.current = [];
      if (missedFramesRef.current < 100) missedFramesRef.current += 1;
      // 음정이 없을 때만 잡음 바닥을 학습한다: 내려갈 땐 즉시, 올라갈 땐 천천히.
      const floor = noiseFloorRef.current;
      noiseFloorRef.current = signalLevel < floor ? signalLevel : floor + (signalLevel - floor) * 0.03;
      // 검출이 끊겨도 바로 지우지 않고 마지막 값을 들고 있는다(홀드).
      if (smoothedPitchRef.current && now - lastPitchAtRef.current > HOLD_LAST_READING_MS) {
        smoothedPitchRef.current = null;
        publishedPitchRef.current = null;
        lockActiveRef.current = false;
        lockSinceRef.current = 0;
        setFrequency(null);
      }
    }

    // 3단 분석 주기: 연주 중(또는 직후)엔 고속, 소음만 들리면 저속(발열 방지),
    // 완전 무음이면 게이트에서 일찍 끝나 저렴하므로 중간 주기.
    const strongSignal = signalLevel > Math.max(SIGNAL_GATE, noiseFloorRef.current * 2.2);
    const recentlyActive = now - lastPitchAtRef.current < ACTIVE_HOLD_MS;
    const analysisInterval = pitch || strongSignal || recentlyActive
      ? ACTIVE_PITCH_ANALYSIS_INTERVAL_MS
      : signalLevel >= SIGNAL_GATE
        ? NOISY_IDLE_ANALYSIS_INTERVAL_MS
        : IDLE_PITCH_ANALYSIS_INTERVAL_MS;
    frameRef.current = window.setTimeout(tick, analysisInterval);
  }

  async function startListening(options = {}) {
    if (isListeningRef.current || isStartingRef.current) return;

    isStartingRef.current = true;
    const isAutoStart = options.auto === true;
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        const unsupported = new Error('mediaDevices unsupported');
        unsupported.name = 'NotSupportedError';
        throw unsupported;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          // AGC를 켜 둔다: YIN(CMNDF)은 진폭 정규화가 되어 있어 게인 출렁임에
          // 영향을 받지 않고, OS가 조용한 입력(통기타 여운, 앰프 없는 일렉)을
          // 증폭해 주어 감도가 올라간다.
          autoGainControl: true
        }
      });
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextCtor();
      if (audioContext.state === 'suspended') {
        try {
          await audioContext.resume();
        } catch {
          // 제스처 핸들러에서 다시 resume한다.
        }
      }
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);

      // 전화 수신 등으로 OS가 마이크를 회수하면 탭 한 번으로 재시작할 수 있게 한다.
      const [track] = stream.getAudioTracks();
      track?.addEventListener('ended', () => {
        if (!userStoppedRef.current) {
          stopListening();
          setNeedsGestureStart(true);
        }
      });

      bufferRef.current = new Float32Array(analyser.fftSize);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      streamRef.current = stream;
      userStoppedRef.current = false;
      resetMeasurement();
      // iOS는 제스처 밖에서 만든 AudioContext가 suspended로 남을 수 있다.
      // 이때 스트림은 살아 있으므로 "탭해서 시작" 상태로 두고 탭에서 resume한다.
      setNeedsGestureStart(audioContext.state !== 'running');
      isListeningRef.current = true;
      setIsListening(true);
      setKeepAwake('tuner', true);
      if (frameRef.current) clearTimeout(frameRef.current);
      tick();
    } catch (err) {
      setNeedsGestureStart(true);
      isListeningRef.current = false;
      setIsListening(false);
      if (!isAutoStart) {
        if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
          setError('마이크 권한이 꺼져 있어요. 휴대폰 설정에서 YEOL Tuner의 마이크를 허용해 주세요.');
        } else if (err?.name === 'NotFoundError' || err?.name === 'NotSupportedError') {
          setError('사용할 수 있는 마이크를 찾지 못했어요.');
        } else {
          setError('마이크를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
        }
      }
    } finally {
      isStartingRef.current = false;
    }
  }

  function stopListening(options = {}) {
    if (options.user === true) {
      userStoppedRef.current = true;
      setNeedsGestureStart(false);
    }
    if (frameRef.current) clearTimeout(frameRef.current);
    frameRef.current = null;
    setKeepAwake('tuner', false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    isListeningRef.current = false;
    setIsListening(false);
    resetMeasurement();
    setVolume(0);
  }

  useEffect(() => {
    return () => stopListening();
  }, []);

  // 메트로놈 클릭이 마이크에 들어가 튜닝을 방해하므로 두 모드는 배타적으로 동작한다.
  useEffect(() => {
    if (view === 'metronome') {
      stopListening();
    } else if (!userStoppedRef.current) {
      startListening({ auto: true });
    }
  }, [view]);

  useEffect(() => {
    localStorage.setItem('yeolTuner.referencePitch', String(referencePitch));
    resetMeasurement();
  }, [referencePitch]);

  // 어떤 이유로든 사용자 제스처가 필요해지면(권한 대기, suspended 컨텍스트,
  // 마이크 회수) 다음 탭에서 복구를 시도한다. once 리스너가 아니어서 실패해도
  // 다음 탭에서 다시 시도할 수 있다.
  useEffect(() => {
    if (!needsGestureStart) return undefined;

    const handleGesture = () => {
      if (userStoppedRef.current) return;
      const audioContext = audioContextRef.current;
      if (isListeningRef.current && audioContext) {
        audioContext.resume().then(() => {
          if (audioContext.state === 'running') setNeedsGestureStart(false);
        }).catch(() => {});
      } else if (!isListeningRef.current) {
        startListening({ auto: true });
      }
    };

    window.addEventListener('pointerdown', handleGesture);
    return () => {
      window.removeEventListener('pointerdown', handleGesture);
    };
  }, [needsGestureStart]);

  // 백그라운드 전환 시 분석을 멈춰 배터리를 아끼고, 복귀 시 iOS 인터럽션으로
  // 멎은 AudioContext를 되살리거나 회수된 마이크를 다시 연다.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (frameRef.current) {
          clearTimeout(frameRef.current);
          frameRef.current = null;
        }
        return;
      }
      if (userStoppedRef.current) return;

      const stream = streamRef.current;
      const track = stream?.getAudioTracks()[0];
      if (!isListeningRef.current || !stream || !track || track.readyState === 'ended') {
        stopListening();
        startListening({ auto: true });
        return;
      }
      const audioContext = audioContextRef.current;
      if (audioContext && audioContext.state !== 'running') {
        audioContext.resume().then(() => {
          if (audioContext.state !== 'running') setNeedsGestureStart(true);
        }).catch(() => setNeedsGestureStart(true));
      }
      if (!frameRef.current) tick();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    const firstTuningKey = Object.keys(INSTRUMENTS[instrumentKey].tunings)[0];
    setTuningKey(firstTuningKey);
  }, [instrumentKey]);

  useEffect(() => {
    const safeTuningKey = INSTRUMENTS[instrumentKey].tunings[tuningKey] ? tuningKey : Object.keys(INSTRUMENTS[instrumentKey].tunings)[0];
    setSelectedStringId(INSTRUMENTS[instrumentKey].tunings[safeTuningKey].strings[0].id);
    resetMeasurement();
  }, [instrumentKey, tuningKey]);

  return (
    <main className={`app ${needsGestureStart ? 'tap-ready' : ''}`}>
      <section className="topbar" aria-label="튜너 설정">
        <div className="brand">
          <span className="brand-mark"><img src="/icon-192.png" alt="" aria-hidden="true" /></span>
          <span className="brand-name">YEOL Tuner</span>
        </div>

        <div className="controls">
          <div className="segmented view-switch" aria-label="모드 전환">
            <button className={view === 'tuner' ? 'active' : ''} onClick={() => setView('tuner')}>
              <Music aria-hidden="true" />Tuner
            </button>
            <button className={view === 'metronome' ? 'active' : ''} onClick={() => setView('metronome')}>
              <Timer aria-hidden="true" />Metronome
            </button>
          </div>

          {view === 'tuner' && (
            <>
              <label className="select-wrap">
                <Settings aria-hidden="true" />
                <select value={instrumentKey} onChange={(event) => setInstrumentKey(event.target.value)} aria-label="악기 선택">
                  {Object.entries(INSTRUMENTS).map(([key, value]) => (
                    <option key={key} value={key}>{value.label}</option>
                  ))}
                </select>
              </label>

              <label className="select-wrap">
                <Settings aria-hidden="true" />
                <select value={activeTuningKey} onChange={(event) => setTuningKey(event.target.value)} aria-label="튜닝 선택">
                  {Object.entries(instrument.tunings).map(([key, value]) => (
                    <option key={key} value={key}>{value.label}</option>
                  ))}
                </select>
              </label>

              <label className="select-wrap">
                <Settings aria-hidden="true" />
                <select value={referencePitch} onChange={(event) => setReferencePitch(Number(event.target.value))} aria-label="기준 주파수 (A4)">
                  {REFERENCE_PITCHES.map((hz) => (
                    <option key={hz} value={hz}>{`A4 ${hz} Hz`}</option>
                  ))}
                </select>
              </label>

              <div className="segmented" aria-label="튜닝 방식">
                <button className={mode === 'auto' ? 'active' : ''} onClick={() => setMode('auto')}>Auto</button>
                <button className={mode === 'manual' ? 'active' : ''} onClick={() => setMode('manual')}>Manual</button>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="hero" aria-label={view === 'tuner' ? '튜닝 상태' : '메트로놈'}>
        {view === 'metronome' ? (
          <Metronome />
        ) : (
        <div className="tuner-console">
          <div className="readout">
            <p className="eyebrow">{needsGestureStart ? 'Tap to start' : isListening ? 'Listening' : 'Ready'}</p>
            <h1>{detected?.target.note ?? selectedString.note}</h1>
            <p className={`status ${tuneTone}`}>{tuneState}</p>
          </div>

          <InstrumentVisual
            instrumentKey={instrumentKey}
            instrument={instrument}
            strings={calibratedStrings}
            activeString={visualString}
          />

          <div className="meter" role="meter" aria-valuemin="-50" aria-valuemax="50" aria-valuenow={roundedCents}>
            <div className="meter-scale">
              <span>-50</span>
              <span>-25</span>
              <span>0</span>
              <span>+25</span>
              <span>+50</span>
            </div>
            <div className="rail">
              <div className="center-line" />
              <div className="needle-track">
                <div className={`needle ${tuneTone}`} style={{ '--needle-position': `${displayCents + 50}%` }} />
              </div>
            </div>
            <div className="cents">
              <span>{detected ? `${roundedCents > 0 ? '+' : ''}${roundedCents}` : '--'}</span>
              <small>cents</small>
            </div>
            <div className={`action-guide ${tuneTone}`} aria-live="polite">
              <strong>{actionGuide.mark}</strong>
              <span>{actionGuide.label}</span>
              <small>{actionGuide.sub}</small>
            </div>
          </div>

          <div className="actions">
            <button className={`mic ${isListening ? 'live' : ''}`} onClick={isListening ? () => stopListening({ user: true }) : () => startListening()}>
              {isListening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
              {isListening ? 'Mic off' : 'Mic on'}
            </button>
            <button className="icon-button" aria-label="측정값 초기화" onClick={resetMeasurement} title="측정값 초기화">
              <RotateCcw aria-hidden="true" />
            </button>
          </div>

          {error && <p className="error">{error}</p>}
        </div>
        )}
      </section>

      {view === 'tuner' && (
      <section className="details" aria-label="측정 정보">
        <div>
          <span>현재 주파수</span>
          <strong>{frequency ? `${frequency.toFixed(2)} Hz` : '--'}</strong>
        </div>
        <div>
          <span>감지 음</span>
          <strong>{detected?.nearest.name ?? '--'}</strong>
        </div>
        <div>
          <span>목표 주파수</span>
          <strong>{detected?.target.freq.toFixed(2) ?? selectedString.freq.toFixed(2)} Hz</strong>
        </div>
        <div>
          <span>입력 레벨</span>
          <strong className="level"><Volume2 aria-hidden="true" />{volume}%</strong>
        </div>
      </section>
      )}

      {view === 'tuner' && (
        <StringGrid
          strings={calibratedStrings}
          label={instrument.label}
          mode={mode}
          selectedId={selectedString.id}
          currentId={detected?.target.id ?? null}
          onSelect={selectString}
        />
      )}

      <footer className="app-version">YEOL Tuner v{APP_VERSION}</footer>
    </main>
  );
}

const container = document.getElementById('root');
if (!container.__appRoot) {
  container.__appRoot = createRoot(container);
}
container.__appRoot.render(<App />);
