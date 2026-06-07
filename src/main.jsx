import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Mic, MicOff, Music, RotateCcw, Settings, Volume2 } from 'lucide-react';
import './styles.css';

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

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function frequencyToNote(frequency) {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const noteName = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  const noteFreq = 440 * Math.pow(2, (midi - 69) / 12);
  return { name: `${noteName}${octave}`, freq: noteFreq, midi };
}

function centsOff(input, target) {
  return Math.round(1200 * Math.log2(input / target));
}

function getInstrumentShape(instrumentKey) {
  if (['violin', 'viola', 'cello', 'doubleBass'].includes(instrumentKey)) return 'bowed';
  if (instrumentKey === 'banjo') return 'banjo';
  if (instrumentKey === 'mandolin') return 'mandolin';
  if (instrumentKey === 'ukulele') return 'ukulele';
  if (instrumentKey === 'bass') return 'bass';
  return 'guitar';
}

function InstrumentVisual({ instrumentKey, instrument, strings, activeString }) {
  const shape = getInstrumentShape(instrumentKey);
  const activeIndex = Math.max(0, strings.findIndex((string) => string.id === activeString.id));

  return (
    <div className={`instrument-visual ${shape}`} aria-label={`${instrument.label} 현 위치`}>
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
}

function autoCorrelate(buffer, sampleRate) {
  const size = buffer.length;
  let rms = 0;

  for (let i = 0; i < size; i += 1) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / size);
  if (rms < 0.015) return null;

  let start = 0;
  let end = size - 1;
  const threshold = 0.2;

  for (let i = 0; i < size / 2; i += 1) {
    if (Math.abs(buffer[i]) < threshold) {
      start = i;
      break;
    }
  }

  for (let i = 1; i < size / 2; i += 1) {
    if (Math.abs(buffer[size - i]) < threshold) {
      end = size - i;
      break;
    }
  }

  const sliced = buffer.slice(start, end);
  const correlations = new Array(sliced.length).fill(0);

  for (let offset = 0; offset < sliced.length; offset += 1) {
    for (let i = 0; i < sliced.length - offset; i += 1) {
      correlations[offset] += Math.abs(sliced[i] - sliced[i + offset]);
    }
  }

  let bestOffset = -1;
  let bestCorrelation = Number.POSITIVE_INFINITY;
  for (let offset = Math.floor(sampleRate / 700); offset < Math.floor(sampleRate / 60); offset += 1) {
    if (correlations[offset] < bestCorrelation) {
      bestCorrelation = correlations[offset];
      bestOffset = offset;
    }
  }

  if (bestOffset <= 0) return null;

  const prev = correlations[bestOffset - 1] ?? bestCorrelation;
  const next = correlations[bestOffset + 1] ?? bestCorrelation;
  const shift = (next - prev) / (2 * (2 * bestCorrelation - next - prev));
  const frequency = sampleRate / (bestOffset + (Number.isFinite(shift) ? shift : 0));

  if (!Number.isFinite(frequency) || frequency < 35 || frequency > 700) return null;
  return frequency;
}

function App() {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');
  const [needsGestureStart, setNeedsGestureStart] = useState(false);
  const [frequency, setFrequency] = useState(null);
  const [volume, setVolume] = useState(0);
  const [instrumentKey, setInstrumentKey] = useState('guitar');
  const [tuningKey, setTuningKey] = useState('standard');
  const [selectedStringId, setSelectedStringId] = useState('guitar-standard-E2');
  const [mode, setMode] = useState('auto');

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const bufferRef = useRef(null);
  const isStartingRef = useRef(false);
  const userStoppedRef = useRef(false);
  const silentFramesRef = useRef(0);

  const instrument = INSTRUMENTS[instrumentKey];
  const availableTuningKeys = Object.keys(instrument.tunings);
  const activeTuningKey = instrument.tunings[tuningKey] ? tuningKey : availableTuningKeys[0];
  const tuning = instrument.tunings[activeTuningKey];

  const selectedString = useMemo(() => {
    return tuning.strings.find((string) => string.id === selectedStringId) ?? tuning.strings[0];
  }, [selectedStringId, tuning]);

  const detected = useMemo(() => {
    if (!frequency) return null;
    const nearest = frequencyToNote(frequency);
    const target = mode === 'auto'
      ? tuning.strings.reduce((best, string) => {
          const distance = Math.abs(centsOff(frequency, string.freq));
          return distance < best.distance ? { string, distance } : best;
        }, { string: tuning.strings[0], distance: Number.POSITIVE_INFINITY }).string
      : selectedString;
    return {
      frequency,
      nearest,
      target,
      cents: centsOff(frequency, target.freq)
    };
  }, [frequency, mode, selectedString, tuning.strings]);

  const displayCents = detected ? Math.max(-50, Math.min(50, detected.cents)) : 0;
  const visualString = detected?.target ?? selectedString;
  const tuneTone = !detected
    ? 'idle'
    : Math.abs(detected.cents) <= 4
      ? 'good'
      : detected.cents < 0
        ? 'flat'
        : 'sharp';
  const tuneState = !detected
    ? '대기 중'
    : Math.abs(detected.cents) <= 4
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
    : Math.abs(detected.cents) <= 4
      ? { mark: '✓', label: '좋아요, 거의 정확해요', sub: `${detected.target.name} ${detected.target.freq.toFixed(2)} Hz` }
      : detected.cents < 0
        ? { mark: '♭', label: '줄을 조금 더 조여요', sub: `${Math.abs(detected.cents)} cents 낮아요` }
        : { mark: '♯', label: '줄을 조금 풀어요', sub: `${detected.cents} cents 높아요` };

  async function startListening(options = {}) {
    if (isListening || isStartingRef.current) return;

    isStartingRef.current = true;
    const isAutoStart = options.auto === true;
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      analyser.fftSize = 4096;
      source.connect(analyser);
      bufferRef.current = new Float32Array(analyser.fftSize);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      streamRef.current = stream;
      userStoppedRef.current = false;
      setNeedsGestureStart(false);
      setIsListening(true);
      tick();
    } catch (err) {
      setNeedsGestureStart(true);
      if (!isAutoStart) {
        setError('마이크 권한을 허용해야 튜닝을 시작할 수 있어요.');
      }
      setIsListening(false);
    } finally {
      isStartingRef.current = false;
    }
  }

  function stopListening(options = {}) {
    if (options.user === true) {
      userStoppedRef.current = true;
      setNeedsGestureStart(false);
    }
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    frameRef.current = null;
    setIsListening(false);
    setFrequency(null);
    setVolume(0);
  }

  function tick() {
    const analyser = analyserRef.current;
    const buffer = bufferRef.current;
    const audioContext = audioContextRef.current;
    if (!analyser || !buffer || !audioContext) return;

    analyser.getFloatTimeDomainData(buffer);
    let rms = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      rms += buffer[i] * buffer[i];
    }
    setVolume(Math.min(1, Math.sqrt(rms / buffer.length) * 8));

    const pitch = autoCorrelate(buffer, audioContext.sampleRate);
    if (pitch) {
      silentFramesRef.current = 0;
      setFrequency((previous) => pitch ? (previous ? previous * 0.84 + pitch * 0.16 : pitch) : previous);
    } else {
      silentFramesRef.current += 1;
      if (silentFramesRef.current > 18) {
        setFrequency(null);
      }
    }
    frameRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    return () => stopListening();
  }, []);

  useEffect(() => {
    startListening({ auto: true });
  }, []);

  useEffect(() => {
    if (!needsGestureStart || isListening) return undefined;

    const handleFirstGesture = () => {
      if (!userStoppedRef.current) {
        startListening({ auto: true });
      }
    };

    window.addEventListener('pointerdown', handleFirstGesture, { once: true });
    window.addEventListener('touchstart', handleFirstGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };
  }, [needsGestureStart, isListening]);

  useEffect(() => {
    const firstTuningKey = Object.keys(INSTRUMENTS[instrumentKey].tunings)[0];
    setTuningKey(firstTuningKey);
    setSelectedStringId(INSTRUMENTS[instrumentKey].tunings[firstTuningKey].strings[0].id);
    setFrequency(null);
  }, [instrumentKey]);

  useEffect(() => {
    const safeTuningKey = INSTRUMENTS[instrumentKey].tunings[tuningKey] ? tuningKey : Object.keys(INSTRUMENTS[instrumentKey].tunings)[0];
    setSelectedStringId(INSTRUMENTS[instrumentKey].tunings[safeTuningKey].strings[0].id);
    setFrequency(null);
  }, [instrumentKey, tuningKey]);

  return (
    <main className={`app ${needsGestureStart && !isListening ? 'tap-ready' : ''}`}>
      <section className="topbar" aria-label="튜너 설정">
        <div className="brand">
          <span className="brand-mark"><Music aria-hidden="true" /></span>
          <span className="brand-name">YEOL Tuner</span>
        </div>

        <div className="controls">
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

          <div className="segmented" aria-label="튜닝 방식">
            <button className={mode === 'auto' ? 'active' : ''} onClick={() => setMode('auto')}>Auto</button>
            <button className={mode === 'manual' ? 'active' : ''} onClick={() => setMode('manual')}>Manual</button>
          </div>
        </div>
      </section>

      <section className="hero" aria-label="튜닝 상태">
        <div className="tuner-console">
          <div className="readout">
            <p className="eyebrow">{isListening ? 'Listening' : needsGestureStart ? 'Tap to start' : 'Ready'}</p>
            <h1>{detected?.target.note ?? selectedString.note}</h1>
            <p className={`status ${tuneTone}`}>{tuneState}</p>
          </div>

          <InstrumentVisual
            instrumentKey={instrumentKey}
            instrument={instrument}
            strings={tuning.strings}
            activeString={visualString}
          />

          <div className="meter" role="meter" aria-valuemin="-50" aria-valuemax="50" aria-valuenow={displayCents}>
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
                <div className="needle" style={{ '--needle-position': `${displayCents + 50}%` }} />
              </div>
            </div>
            <div className="cents">
              <span>{detected ? `${detected.cents > 0 ? '+' : ''}${detected.cents}` : '--'}</span>
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
            <button className="icon-button" aria-label="측정값 초기화" onClick={() => setFrequency(null)} title="측정값 초기화">
              <RotateCcw aria-hidden="true" />
            </button>
          </div>

          {error && <p className="error">{error}</p>}
        </div>
      </section>

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
          <strong className="level"><Volume2 aria-hidden="true" />{Math.round(volume * 100)}%</strong>
        </div>
      </section>

      <section className="strings" aria-label={`${instrument.label} 줄 선택`}>
        {tuning.strings.map((string) => {
          const active = mode === 'manual' && selectedString.id === string.id;
          const current = detected?.target.id === string.id;
          return (
            <button
              key={string.id}
              className={`${active ? 'selected' : ''} ${current ? 'current' : ''}`}
              onClick={() => {
                setMode('manual');
                setSelectedStringId(string.id);
              }}
            >
              <strong>{string.name}</strong>
              <span>{string.note}</span>
              <small>{string.freq.toFixed(2)} Hz</small>
            </button>
          );
        })}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
