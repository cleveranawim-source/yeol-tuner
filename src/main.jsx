import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, ChevronDown, Lock, Mic, MicOff, Music, Play, RefreshCw, Square, Vibrate, Volume2, Zap } from 'lucide-react';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
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

// 진동: 네이티브(iOS/Android)는 Capacitor Haptics, 웹은 navigator.vibrate 폴백.
function vibrateFallback(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* 미지원 환경 */
  }
}

function hapticTap(strong = false) {
  Haptics.impact({ style: strong ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => vibrateFallback(strong ? 30 : 15));
}

function hapticSuccess() {
  Haptics.notification({ type: NotificationType.Success }).catch(() => vibrateFallback([30, 60, 30]));
}

// 언어: 설정 창에서 고른 값이 있으면 그것을, 없으면 기기 언어(한국어면 한국어, 그 밖엔 영어).
function detectLanguage() {
  try {
    const stored = localStorage.getItem('yeolTuner.language');
    if (stored === 'ko' || stored === 'en') return stored;
  } catch {
    /* 저장소 접근 불가 */
  }
  const languages = [...(navigator.languages ?? []), navigator.language].filter(Boolean);
  return languages.some((language) => language.toLowerCase().startsWith('ko')) ? 'ko' : 'en';
}

// 짧은 이름표(Tuner, Auto, Mic on…)는 두 언어 모두 영어, 안내 문장만 언어를 따른다.
const STRINGS = {
  ko: {
    viewLabel: '모드 전환',
    openSettings: '악기와 튜닝 설정 열기',
    tunerLabel: '튜닝 상태',
    locked: (note) => `${note} 고정`,
    backToAuto: 'Auto로',
    guideIdle: '줄을 튕겨 보세요',
    guideGood: '정확해요',
    guideFlatNear: '줄을 조금 조여요',
    guideFlatFar: '줄을 조여요',
    guideSharpNear: '줄을 조금 풀어요',
    guideSharpFar: '줄을 풀어요',
    now: '지금',
    heard: '감지',
    target: '목표',
    stringsLabel: '줄 선택',
    stringsHint: '줄 — 누르면 그 줄만 맞춰요',
    stringAria: (num, note, done) => `${num}번 줄 ${note}${done ? ', 맞춤' : ''}`,
    progress: (done, total) => `${done}/${total} 완료`,
    complete: (total) => `튜닝 완료 · ${total}줄 모두 맞았어요`,
    input: '입력',
    errors: {
      permission: '마이크 권한이 꺼져 있어요. 휴대폰 설정에서 YEOL Tuner의 마이크를 허용해 주세요.',
      noMic: '사용할 수 있는 마이크를 찾지 못했어요.',
      generic: '마이크를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.'
    },
    sheetTitle: '악기와 튜닝',
    done: '완료',
    instrument: '악기',
    tuning: '튜닝',
    reference: '기준음 A4',
    referenceDown: '기준음 1 Hz 낮추기',
    referenceUp: '기준음 1 Hz 높이기',
    referenceHint: '오케스트라·앙상블은 보통 442 Hz에 맞춰요.',
    feedback: '알림',
    tuneHaptic: '맞았을 때 진동',
    tuneHapticHint: '줄이 맞으면 "톡" 하고 알려 줘요',
    language: '언어 · Language',
    metronomeLabel: '메트로놈',
    beatDisplay: '박자 표시',
    slower: '1 느리게',
    faster: '1 빠르게',
    tempo: '템포 (BPM)',
    beatsLabel: '마디당 박자 수',
    beats: (count) => `${count}박`,
    fewerBeats: '박자 줄이기',
    moreBeats: '박자 늘리기',
    feedbackModes: '박자 피드백 방식',
    sound: '소리',
    vibration: '진동',
    flash: '번쩍임',
    start: '시작',
    stop: '정지'
  },
  en: {
    viewLabel: 'Switch mode',
    openSettings: 'Open instrument and tuning settings',
    tunerLabel: 'Tuning status',
    locked: (note) => `${note} only`,
    backToAuto: 'Back to Auto',
    guideIdle: 'Pluck a string',
    guideGood: 'In tune',
    guideFlatNear: 'Tighten a little',
    guideFlatFar: 'Tighten',
    guideSharpNear: 'Loosen a little',
    guideSharpFar: 'Loosen',
    now: 'Now',
    heard: 'Heard',
    target: 'Target',
    stringsLabel: 'Choose a string',
    stringsHint: 'Strings — tap one to tune it alone',
    stringAria: (num, note, done) => `String ${num}, ${note}${done ? ', in tune' : ''}`,
    progress: (done, total) => `${done}/${total} tuned`,
    complete: (total) => `All ${total} strings in tune`,
    input: 'Input',
    errors: {
      permission: 'Microphone access is off. Allow it for YEOL Tuner in your device settings.',
      noMic: 'No microphone was found.',
      generic: 'Could not start the microphone. Please try again.'
    },
    sheetTitle: 'Instrument & tuning',
    done: 'Done',
    instrument: 'Instrument',
    tuning: 'Tuning',
    reference: 'Reference A4',
    referenceDown: 'Lower reference by 1 Hz',
    referenceUp: 'Raise reference by 1 Hz',
    referenceHint: 'Orchestras and ensembles often tune to 442 Hz.',
    feedback: 'Feedback',
    tuneHaptic: 'Vibrate when in tune',
    tuneHapticHint: 'A gentle tap when a string is in tune',
    language: 'Language · 언어',
    metronomeLabel: 'Metronome',
    beatDisplay: 'Beats',
    slower: '1 slower',
    faster: '1 faster',
    tempo: 'Tempo (BPM)',
    beatsLabel: 'Beats per bar',
    beats: (count) => `${count} beat${count === 1 ? '' : 's'}`,
    fewerBeats: 'Fewer beats',
    moreBeats: 'More beats',
    feedbackModes: 'Beat feedback',
    sound: 'Sound',
    vibration: 'Vibrate',
    flash: 'Flash',
    start: 'Start',
    stop: 'Stop'
  }
};

// 빠르기말: 경계값은 흔히 쓰는 메트로놈 표기를 따랐다(자료마다 조금씩 다르다).
const TEMPO_MARKINGS = [
  { max: 59, name: 'Largo', ko: '아주 느리게', en: 'very slow' },
  { max: 65, name: 'Larghetto', ko: '꽤 느리게', en: 'rather slow' },
  { max: 75, name: 'Adagio', ko: '느리게', en: 'slow' },
  { max: 107, name: 'Andante', ko: '걷는 빠르기', en: 'walking pace' },
  { max: 119, name: 'Moderato', ko: '보통 빠르기', en: 'moderate' },
  { max: 167, name: 'Allegro', ko: '빠르게', en: 'fast' },
  { max: 199, name: 'Presto', ko: '매우 빠르게', en: 'very fast' },
  { max: Number.POSITIVE_INFINITY, name: 'Prestissimo', ko: '가장 빠르게', en: 'as fast as possible' }
];

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

// 설정 창의 악기 카드 순서(자주 쓰는 순)와 한국어 이름.
const INSTRUMENT_ORDER = ['guitar', 'bass', 'ukulele', 'violin', 'viola', 'cello', 'doubleBass', 'mandolin', 'banjo'];
const INSTRUMENT_NAMES_KO = {
  guitar: '기타',
  bass: '베이스 기타',
  ukulele: '우쿨렐레',
  violin: '바이올린',
  viola: '비올라',
  cello: '첼로',
  doubleBass: '더블베이스',
  mandolin: '만돌린',
  banjo: '밴조'
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
// 락 중 화면 갱신: 이만큼 벗어났을 때만, 이 간격으로 천천히 따라간다.
const LOCKED_DEADBAND_CENTS = 0.6;
const LOCKED_UPDATE_INTERVAL_MS = 450;
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
// 나가는 기준을 7¢로 두면 "−6 cents"와 "정확해요"가 함께 보였다(1.3.0 실측).
// 표시값은 스무딩돼 정착 상태 흔들림이 ±0.2¢ 안팎이라 1.5¢ 차이면 깜빡이지 않는다.
const IN_TUNE_EXIT_CENTS = 5.5;

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
// 그림 전체(.art-stage)를 transform으로 축소해 악기별 비율은 그대로 두고 높이만 줄인다.
const InstrumentVisual = memo(function InstrumentVisual({ instrumentKey, strings, activeString }) {
  const shape = getInstrumentShape(instrumentKey);
  const activeIndex = Math.max(0, strings.findIndex((string) => string.id === activeString.id));

  return (
    <div className={`instrument-visual ${shape} ${instrumentKey}`} aria-hidden="true">
      <div className="instrument-art" style={{ '--string-count': strings.length }}>
        <div className="art-stage">
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
              />
            ))}
          </div>
          <div className="body">
            <span className="sound-hole" />
          </div>
        </div>
      </div>
    </div>
  );
});

// memo: 줄 버튼은 감지 대상 줄·완료 표시가 바뀔 때만(=드물게) 리렌더된다.
const StringRow = memo(function StringRow({ strings, mode, selectedId, currentId, doneIds, onSelect, t }) {
  const doneCount = strings.filter((string) => doneIds.has(string.id)).length;
  return (
    <section className="strings" aria-label={t.stringsLabel}>
      <div className="strings-head">
        <span>{t.stringsHint}</span>
        {doneCount > 0 && <span className="strings-progress">{t.progress(doneCount, strings.length)}</span>}
      </div>
      <div className="strings-row" style={{ '--string-count': strings.length }}>
        {strings.map((string) => {
          const selected = mode === 'manual' && selectedId === string.id;
          const current = !selected && currentId === string.id;
          const done = doneIds.has(string.id);
          const number = string.name.match(/^\d+/)?.[0] ?? '';
          return (
            <button
              key={string.id}
              className={`string-button ${selected ? 'selected' : ''} ${current ? 'current' : ''}`}
              onClick={() => onSelect(string.id)}
              aria-pressed={selected}
              aria-label={t.stringAria(number, string.note, done)}
            >
              {done && <span className="string-done"><Check aria-hidden="true" /></span>}
              {selected && <span className="string-lock"><Lock aria-hidden="true" /></span>}
              <small>{number}</small>
              <strong>{string.note}</strong>
            </button>
          );
        })}
      </div>
    </section>
  );
});

function SettingsSheet({
  t, lang, instrumentKey, tuningKey, referencePitch, tuneHaptic,
  onInstrument, onTuning, onReference, onTuneHaptic, onLanguage, onClose
}) {
  const instrument = INSTRUMENTS[instrumentKey];

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="sheet-layer">
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-title">
          <h2 id="sheet-title">{t.sheetTitle}</h2>
          <button className="sheet-done" onClick={onClose}>{t.done}</button>
        </div>

        <p className="sheet-label">{t.instrument}</p>
        <div className="instrument-grid">
          {INSTRUMENT_ORDER.map((key) => {
            const item = INSTRUMENTS[key];
            const firstTuning = Object.values(item.tunings)[0];
            return (
              <button key={key} className={key === instrumentKey ? 'on' : ''} aria-pressed={key === instrumentKey} onClick={() => onInstrument(key)}>
                <span>
                  <strong>{item.label}</strong>
                  {lang === 'ko' && <small>{INSTRUMENT_NAMES_KO[key]}</small>}
                </span>
                <code>{firstTuning.strings.map((string) => string.note.replace(/\d+$/, '')).join(' ')}</code>
              </button>
            );
          })}
        </div>

        <p className="sheet-label">{t.tuning}</p>
        <div className="chip-row">
          {Object.entries(instrument.tunings).map(([key, value]) => (
            <button key={key} className={`chip ${key === tuningKey ? 'on' : ''}`} aria-pressed={key === tuningKey} onClick={() => onTuning(key)}>
              {value.label}
            </button>
          ))}
        </div>

        <p className="sheet-label">{t.reference}</p>
        <div className="chip-row">
          <div className="stepper">
            <button onClick={() => onReference(referencePitch - 1)} disabled={referencePitch <= REFERENCE_PITCHES[0]} aria-label={t.referenceDown}>−</button>
            <strong>{referencePitch} Hz</strong>
            <button onClick={() => onReference(referencePitch + 1)} disabled={referencePitch >= REFERENCE_PITCHES[REFERENCE_PITCHES.length - 1]} aria-label={t.referenceUp}>+</button>
          </div>
          {[440, 442].map((hz) => (
            <button key={hz} className={`chip ${referencePitch === hz ? 'on' : ''}`} aria-pressed={referencePitch === hz} onClick={() => onReference(hz)}>
              {hz}
            </button>
          ))}
        </div>
        <p className="sheet-hint">{t.referenceHint}</p>

        <p className="sheet-label">{t.feedback}</p>
        <button className="toggle-row" role="switch" aria-checked={tuneHaptic} onClick={() => onTuneHaptic(!tuneHaptic)}>
          <Vibrate aria-hidden="true" />
          <span>
            <strong>{t.tuneHaptic}</strong>
            <small>{t.tuneHapticHint}</small>
          </span>
          <span className={`switch ${tuneHaptic ? 'on' : ''}`} aria-hidden="true" />
        </button>

        <p className="sheet-label">{t.language}</p>
        <div className="chip-row">
          <button className={`chip ${lang === 'ko' ? 'on' : ''}`} aria-pressed={lang === 'ko'} onClick={() => onLanguage('ko')}>한국어</button>
          <button className={`chip ${lang === 'en' ? 'on' : ''}`} aria-pressed={lang === 'en'} onClick={() => onLanguage('en')}>English</button>
        </div>

        <p className="sheet-version">YEOL Tuner v{APP_VERSION}</p>
      </div>
    </div>
  );
}

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

function Metronome({ t, lang }) {
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
      if (settingsRef.current.haptic) hapticTap(accent);
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

  const marking = TEMPO_MARKINGS.find((item) => settings.bpm <= item.max);

  return (
    <>
      <section className="tuner-console metronome-console" aria-label={t.metronomeLabel}>
        <div className="console-top">
          <span className="eyebrow">
            {isRunning && <span className="live-dot gold" aria-hidden="true" />}
            {isRunning ? 'Playing' : 'Metronome'}
          </span>
        </div>

        <div className="bpm-readout">{settings.bpm}</div>
        <p className="tempo-name">{marking.name} <span>· {marking[lang]} · BPM</span></p>

        <div className="beat-dots" style={{ '--beat-count': settings.beats }} aria-label={t.beatDisplay}>
          {Array.from({ length: settings.beats }).map((_, index) => (
            <span
              key={index}
              className={`beat-dot ${index === currentBeat ? 'on' : ''} ${index === 0 && settings.beats > 1 ? 'accent' : ''}`}
            >
              {index + 1}
            </span>
          ))}
        </div>

        <div className="bpm-controls">
          <button className="bpm-step" onClick={() => update({ bpm: clampBpm(settings.bpm - 1) })} aria-label={t.slower}>−1</button>
          <input
            type="range"
            min={METRONOME_MIN_BPM}
            max={METRONOME_MAX_BPM}
            value={settings.bpm}
            onChange={(event) => update({ bpm: clampBpm(Number(event.target.value)) })}
            aria-label={t.tempo}
          />
          <button className="bpm-step" onClick={() => update({ bpm: clampBpm(settings.bpm + 1) })} aria-label={t.faster}>+1</button>
        </div>

        <div className="metro-row">
          <div className="beats-stepper" aria-label={t.beatsLabel}>
            <button onClick={() => update({ beats: Math.max(1, settings.beats - 1) })} aria-label={t.fewerBeats}>−</button>
            <span>{t.beats(settings.beats)}</span>
            <button onClick={() => update({ beats: Math.min(8, settings.beats + 1) })} aria-label={t.moreBeats}>+</button>
          </div>
          <button className="tap-tempo" onClick={tapTempo}>TAP</button>
        </div>

        <div className="metro-toggles" aria-label={t.feedbackModes}>
          <button className={settings.sound ? 'on' : ''} onClick={() => update({ sound: !settings.sound })} aria-pressed={settings.sound}>
            <Volume2 aria-hidden="true" />{t.sound}
          </button>
          <button className={settings.haptic ? 'on' : ''} onClick={() => update({ haptic: !settings.haptic })} aria-pressed={settings.haptic}>
            <Vibrate aria-hidden="true" />{t.vibration}
          </button>
          <button className={settings.flash ? 'on' : ''} onClick={() => update({ flash: !settings.flash })} aria-pressed={settings.flash}>
            <Zap aria-hidden="true" />{t.flash}
          </button>
        </div>

        <div ref={flashRef} className="metro-flash" aria-hidden="true" />
      </section>

      <div className="flex-spacer" />

      <button className={`big-action ${isRunning ? 'stop' : ''}`} onClick={isRunning ? stop : start}>
        {isRunning ? <Square aria-hidden="true" /> : <Play aria-hidden="true" />}
        {isRunning ? t.stop : t.start}
      </button>
    </>
  );
}

function App() {
  const [view, setView] = useState('tuner');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');
  const [needsGestureStart, setNeedsGestureStart] = useState(false);
  const [frequency, setFrequency] = useState(null);
  const [level, setLevel] = useState(0);
  const [instrumentKey, setInstrumentKey] = useState('guitar');
  const [tuningKey, setTuningKey] = useState('standard');
  const [selectedStringId, setSelectedStringId] = useState('guitar-standard-E2');
  const [mode, setMode] = useState('auto');
  const [referencePitch, setReferencePitch] = useState(() => {
    const stored = Number(localStorage.getItem('yeolTuner.referencePitch'));
    return REFERENCE_PITCHES.includes(stored) ? stored : DEFAULT_REFERENCE_PITCH;
  });
  const [lang, setLang] = useState(detectLanguage);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tuneHaptic, setTuneHaptic] = useState(() => localStorage.getItem('yeolTuner.tuneHaptic') !== 'off');
  // 이번에 맞춘 줄(✓). 악기·튜닝·기준음을 바꾸거나 앱을 다시 열면 비운다.
  const [doneIds, setDoneIds] = useState(() => new Set());
  const [showComplete, setShowComplete] = useState(false);
  const t = STRINGS[lang];

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
  // tick()은 마운트 시점 클로저로 돌기 때문에 바뀌는 값은 ref로 읽는다.
  const modeRef = useRef('auto');
  const selectedIdRef = useRef(null);
  const tuneHapticRef = useRef(tuneHaptic);

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
  modeRef.current = mode;
  selectedIdRef.current = selectedString.id;

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

  // ±4¢에서 들어와 ±5.5¢에서 나가는 히스테리시스로 경계 플리커를 막는다.
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
  const guideText = !detected
    ? t.guideIdle
    : isInTune
      ? t.guideGood
      : detected.cents < 0
        ? (Math.abs(detected.cents) <= MID_CENTS ? t.guideFlatNear : t.guideFlatFar)
        : (detected.cents <= MID_CENTS ? t.guideSharpNear : t.guideSharpFar);
  const guideMark = tuneTone === 'good' ? <Check aria-hidden="true" /> : tuneTone === 'flat' ? '♭' : tuneTone === 'sharp' ? '♯' : null;

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

  // 안정적 참조여야 StringRow의 memo가 유지된다.
  // 고정된 줄을 한 번 더 누르면 Auto로 돌아간다.
  const selectString = useCallback((id) => {
    if (modeRef.current === 'manual' && selectedIdRef.current === id) {
      setMode('auto');
      return;
    }
    setMode('manual');
    setSelectedStringId(id);
  }, []);

  // 바늘이 안착(락인)한 순간 = 그 줄이 맞은 순간. tick()에서 호출되므로 ref와
  // setState만 쓴다. 한 줄만 맞추는 중이면 그 줄일 때만 인정한다.
  function handleLockIn(stringId) {
    if (modeRef.current === 'manual' && stringId !== selectedIdRef.current) return;
    if (tuneHapticRef.current) hapticTap(true);
    setDoneIds((previous) => {
      if (previous.has(stringId)) return previous;
      const next = new Set(previous);
      next.add(stringId);
      return next;
    });
  }

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

    // 입력 레벨 표시는 장식용이므로 최대 ~6.5Hz로만 갱신하고 막대 5칸으로 양자화한다.
    // (연주 중 매 프레임 % 변화가 그 자체로 전체 리렌더를 유발하던 발열 원인 제거)
    if (now - lastVolumeAtRef.current > 150) {
      lastVolumeAtRef.current = now;
      const percent = signalLevel * 2800;
      const bars = percent < 4 ? 0 : Math.min(5, Math.ceil(percent / 20));
      setLevel((previous) => (previous === bars ? previous : bars));
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

        // 락 해제는 날것의 값으로 빠르게: ±7¢ 밖이 두 프레임 연속이면 푼다
        // (줄감개를 돌려 음이 벗어나면 바늘이 곧바로 따라가야 한다).
        if (lockActiveRef.current) {
          if (distance > LOCK_EXIT_CENTS) {
            unlockStrikesRef.current += 1;
            if (unlockStrikesRef.current >= 2) {
              lockActiveRef.current = false;
              lockSinceRef.current = 0;
              unlockStrikesRef.current = 0;
            }
          } else {
            unlockStrikesRef.current = 0;
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

        // 락 진입(안착 = ✓·진동)은 화면과 같은 걸러진 값으로 판단한다: ±4¢ 안에서 0.6초.
        // 날것의 값으로 보면 떨림(비브라토) 때문에 "정확해요"가 떠 있어도 ✓가 안 왔다(1.3.0 실측).
        if (!lockActiveRef.current && !masked) {
          let settledDistance = Number.POSITIVE_INFINITY;
          let settledId = null;
          for (const string of stringsRef.current) {
            const off = Math.abs(centsOff(smoothedPitchRef.current, string.freq));
            if (off < settledDistance) {
              settledDistance = off;
              settledId = string.id;
            }
          }
          if (settledDistance <= LOCK_ENTER_CENTS) {
            if (!lockSinceRef.current) lockSinceRef.current = now;
            if (now - lockSinceRef.current >= LOCK_AFTER_MS) {
              lockActiveRef.current = true;
              unlockStrikesRef.current = 0;
              handleLockIn(settledId);
            }
          } else {
            lockSinceRef.current = 0;
          }
        }
      }

      // 어택 마스크 중엔 화면에 내보내지 않는다(튕길 때 바늘이 위로 튀는 현상 제거).
      // 락 중엔 떨림은 이미 무거운 스무딩(α 0.06)이 걸러 주므로, 데드밴드는 작게 두고
      // 대신 드물게(0.45초마다)만 갱신한다. 예전처럼 1.5¢ 데드밴드로 붙잡으면 안착 순간의
      // 값(튕긴 직후라 1~2¢ 높음)이 계속 남아, −6¢ 줄이 "정확해요"로 보였다(1.3.0 실측).
      const nextPitch = smoothedPitchRef.current;
      const published = publishedPitchRef.current;
      const locked = lockActiveRef.current;
      const deadband = locked ? LOCKED_DEADBAND_CENTS : 0.3;
      const interval = locked ? LOCKED_UPDATE_INTERVAL_MS : UI_UPDATE_INTERVAL_MS;
      const movedEnough = !published || Math.abs(centsOff(nextPitch, published)) > deadband;
      if (!masked && movedEnough && now - lastFreqPublishAtRef.current >= interval) {
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
          setError('permission');
        } else if (err?.name === 'NotFoundError' || err?.name === 'NotSupportedError') {
          setError('noMic');
        } else {
          setError('generic');
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
    setLevel(0);
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

  useEffect(() => {
    tuneHapticRef.current = tuneHaptic;
    localStorage.setItem('yeolTuner.tuneHaptic', tuneHaptic ? 'on' : 'off');
  }, [tuneHaptic]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // 악기·튜닝·기준음이 바뀌면 줄 목록(목표 주파수)이 새로 만들어지므로 ✓를 비운다.
  useEffect(() => {
    setDoneIds(new Set());
    setShowComplete(false);
  }, [calibratedStrings]);

  // 모든 줄이 ✓가 되면 「튜닝 완료」를 잠깐 보여 주고 성공 진동을 준다.
  useEffect(() => {
    if (doneIds.size === 0 || !calibratedStrings.every((string) => doneIds.has(string.id))) return undefined;
    setShowComplete(true);
    if (tuneHapticRef.current) hapticSuccess();
    const timer = window.setTimeout(() => setShowComplete(false), 4000);
    return () => clearTimeout(timer);
  }, [doneIds, calibratedStrings]);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  function changeLanguage(next) {
    setLang(next);
    try {
      localStorage.setItem('yeolTuner.language', next);
    } catch {
      /* 저장소 접근 불가 */
    }
  }

  function changeTuneHaptic(next) {
    setTuneHaptic(next);
    if (next) hapticTap(true); // 켜는 순간 어떤 느낌인지 한 번 보여 준다.
  }

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

  const centsText = !detected ? '--' : `${roundedCents > 0 ? '+' : roundedCents < 0 ? '−' : ''}${Math.abs(roundedCents)}`;
  const targetFrequency = (detected?.target ?? selectedString).freq.toFixed(2);

  return (
    <main className={`app view-${view} ${needsGestureStart ? 'tap-ready' : ''}`}>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark"><img src="/icon-192.png" alt="" aria-hidden="true" /></span>
          <span className="brand-name">YEOL Tuner</span>
        </div>
        <div className="segmented view-switch" aria-label={t.viewLabel}>
          <button className={view === 'tuner' ? 'active' : ''} aria-pressed={view === 'tuner'} onClick={() => setView('tuner')}>Tuner</button>
          <button className={view === 'metronome' ? 'active' : ''} aria-pressed={view === 'metronome'} onClick={() => setView('metronome')}>Metronome</button>
        </div>
      </header>

      {view === 'metronome' ? (
        <Metronome t={t} lang={lang} />
      ) : (
        <>
          <button className="settings-chip" onClick={() => setSheetOpen(true)} aria-label={t.openSettings} aria-haspopup="dialog">
            <Music aria-hidden="true" />
            <span className="settings-text">
              {instrument.label}<i>·</i>{tuning.label}<i>·</i>A4 {referencePitch} Hz
            </span>
            <ChevronDown className="chevron" aria-hidden="true" />
          </button>

          <section className={`tuner-console ${isInTune ? 'good' : ''}`} aria-label={t.tunerLabel}>
            <div className="console-top">
              {showComplete ? (
                <span className="complete-banner" role="status"><Check aria-hidden="true" />{t.complete(calibratedStrings.length)}</span>
              ) : (
                <>
                  <span className="eyebrow">
                    {isListening && !needsGestureStart && <span className="live-dot" aria-hidden="true" />}
                    {needsGestureStart ? 'Tap to start' : isListening ? 'Listening' : 'Ready'}
                  </span>
                  {mode === 'auto' ? (
                    <span className="mode-chip"><RefreshCw aria-hidden="true" />Auto</span>
                  ) : (
                    <span className="mode-chips">
                      <span className="mode-chip manual"><Lock aria-hidden="true" />{t.locked(selectedString.note)}</span>
                      <button className="mode-chip ghost" onClick={() => setMode('auto')}><RefreshCw aria-hidden="true" />{t.backToAuto}</button>
                    </span>
                  )}
                </>
              )}
            </div>

            <h1 className="note-name">{detected?.target.note ?? selectedString.note}</h1>
            <p className={`guide ${tuneTone}`} aria-live="polite">
              {guideMark && <span className="guide-mark">{guideMark}</span>}
              {guideText}
            </p>

            <InstrumentVisual
              instrumentKey={instrumentKey}
              strings={calibratedStrings}
              activeString={visualString}
            />

            <div className="meter" role="meter" aria-valuemin="-50" aria-valuemax="50" aria-valuenow={roundedCents}>
              <div className="meter-scale" aria-hidden="true">
                <span>-50</span>
                <span>-25</span>
                <span>0</span>
                <span>+25</span>
                <span>+50</span>
              </div>
              <div className="rail">
                <div
                  className={`rail-track ${tuneTone}`}
                  style={{ '--needle-position': `${displayCents + 50}%`, '--fill-scale': Math.abs(displayCents) / 50 }}
                >
                  <span className="in-tune-zone" />
                  <span className="rail-fill flat" />
                  <span className="rail-fill sharp" />
                  <div className={`needle ${tuneTone}`} />
                </div>
              </div>
            </div>

            <div className={`cents ${tuneTone}`}>
              <span>{centsText}</span>
              <small>cents</small>
            </div>
            <p className="detail-line">
              <span>{t.now} <em>{frequency ? frequency.toFixed(2) : '--'}</em></span>
              <span>{t.heard} <em>{detected?.nearest.name ?? '--'}</em></span>
              <span>{t.target} <em>{targetFrequency} Hz</em></span>
            </p>

            {error && <p className="error">{t.errors[error]}</p>}
          </section>

          <div className="flex-spacer" />

          <StringRow
            strings={calibratedStrings}
            mode={mode}
            selectedId={selectedString.id}
            currentId={detected?.target.id ?? null}
            doneIds={doneIds}
            onSelect={selectString}
            t={t}
          />

          <div className="bottom-bar">
            <span className="input-level" aria-label={`${t.input} ${level}/5`}>
              <Mic aria-hidden="true" />
              <span className="level-bars" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((index) => <i key={index} className={index < level ? 'on' : ''} />)}
              </span>
              {t.input}
            </span>
            <button className={`mic-button ${isListening ? 'live' : ''}`} onClick={isListening ? () => stopListening({ user: true }) : () => startListening()}>
              {isListening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
              {isListening ? 'Mic off' : 'Mic on'}
            </button>
          </div>
        </>
      )}

      {sheetOpen && (
        <SettingsSheet
          t={t}
          lang={lang}
          instrumentKey={instrumentKey}
          tuningKey={activeTuningKey}
          referencePitch={referencePitch}
          tuneHaptic={tuneHaptic}
          onInstrument={setInstrumentKey}
          onTuning={setTuningKey}
          onReference={setReferencePitch}
          onTuneHaptic={changeTuneHaptic}
          onLanguage={changeLanguage}
          onClose={closeSheet}
        />
      )}
    </main>
  );
}

const container = document.getElementById('root');
if (!container.__appRoot) {
  container.__appRoot = createRoot(container);
}
container.__appRoot.render(<App />);
