/*
 * The articulator probe and offline speech.
 *
 * The live probe is run as a browser runs it: the plugin's generated worklet script is evaluated in
 * a stand-in AudioWorkletGlobalScope, the engine it registers renders the score in bellows'
 * KernelEngine one quantum at a time, and the probe processor it registers is called after each
 * quantum with the scope's currentFrame, as an AudioWorkletNode fed from bellows' output is. Its
 * frames are compared with renderSpeech()'s track, which runs the engine from source.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { Bellows, KernelEngine, registerBuiltins, registerEngine, renderOffline, type EngineDef } from 'bellowsjs';
import { voice } from '../../src/plugin';
import { singer } from '../../src/singer';
import { renderSpeech, speechScore } from '../../src/offline';
import { articulatorProbe } from '../../src/probe/probe';
import { ARTICULATOR_PROBE_VERSION, FRAME_STRIDE, FrameRing, PROBE_PROCESSOR, decodeFrame, ringBytes, type ArticulatorFrame } from '../../src/probe/frame';
import { PROBE_TAP } from '../../src/probe/tap';
import { VOCAL_PHONEMES } from '../../src/engines/vocal-phonemes';
import { vocalEngine } from '../../src/engines/vocal';
import { FakeAudioContext, FakeWorkletNode, installFakeAudio } from './fake-context';

const TEXT = 'Shall we meet at noon? Five past twelve.';
const OPTS = { voice: 'narrator-female', seed: 'probe-test', frameRate: 60 } as const;
const SR = 48000;
const BLOCK = 128;

/** The largest difference of the articulators, voicing and timing between frames, and whether sounds and phonemes agree. */
function compare(x: ArticulatorFrame[], y: ArticulatorFrame[]): { worst: number; same: boolean } {
  let worst = 0;
  let same = x.length === y.length;
  const keys = ['time', 'glottal', 'jaw', 'lipAperture', 'lipProtrusion', 'lipWidth', 'labiodental', 'tongueBodyX', 'tongueBodyY', 'tongueTipX', 'tongueTipY', 'velum'] as const;
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    for (const k of keys) worst = Math.max(worst, Math.abs(x[i][k] - y[i][k]));
    if (x[i].sounding !== y[i].sounding || x[i].phoneme !== y[i].phoneme) same = false;
  }
  return { worst, same };
}

class ScopePort {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  readonly posted: unknown[] = [];
  postMessage(msg: unknown): void {
    // a real port sends a copy
    this.posted.push(msg instanceof Float64Array ? msg.slice() : msg);
  }
}

interface ScopedProbe {
  port: ScopePort;
  process(inputs: Float32Array[][]): boolean;
}

/** The plugin's script in a stand-in worklet scope: the engine and the probe processor it registers. */
function workletScope(): {
  engine: EngineDef;
  Probe: new (o: { processorOptions: unknown }) => ScopedProbe;
  setFrame(f: number): void;
  restore(): void;
} {
  const g = globalThis as Record<string, unknown>;
  const names = ['bellowsKernel', 'sampleRate', 'currentFrame', 'AudioWorkletProcessor', 'registerProcessor'];
  const saved = names.map((n) => [n, Object.getOwnPropertyDescriptor(g, n)] as const);
  let frame = 0;
  let engine: EngineDef | null = null;
  let Probe: unknown = null;
  g.bellowsKernel = { version: 1, registerEngine: (d: EngineDef) => (engine = d), registerEffect: () => {} };
  Object.defineProperty(g, 'sampleRate', { value: SR, configurable: true, writable: true });
  Object.defineProperty(g, 'currentFrame', { get: () => frame, configurable: true });
  g.AudioWorkletProcessor = class {
    readonly port = new ScopePort();
  };
  g.registerProcessor = (name: string, ctor: unknown) => {
    if (name === PROBE_PROCESSOR) Probe = ctor;
  };
  new Function(voice.worklet)();
  if (!engine || !Probe) throw new Error('the plugin script registered no engine or no probe');
  return {
    engine,
    Probe: Probe as new (o: { processorOptions: unknown }) => ScopedProbe,
    setFrame: (f) => (frame = f),
    restore: () => {
      for (const [n, d] of saved) {
        if (d) Object.defineProperty(g, n, d);
        else delete g[n];
      }
    },
  };
}

/** Render a score through the worklet script's engine with probes attached, quantum by quantum. */
function liveRun(processorOptions: Array<Record<string, unknown>>): { probes: ScopedProbe[]; left: Float32Array } {
  const scope = workletScope();
  try {
    const score = speechScore(TEXT, OPTS, 1);
    registerBuiltins();
    registerEngine(scope.engine);
    const engine = new KernelEngine(SR);
    for (const m of score.messages) engine.apply(m);
    const probes = processorOptions.map((o) => new scope.Probe({ processorOptions: o }));
    const blocks = Math.ceil((score.seconds * SR) / BLOCK);
    const left = new Float32Array(blocks * BLOCK);
    const l = new Float32Array(BLOCK);
    const r = new Float32Array(BLOCK);
    for (let b = 0; b < blocks; b++) {
      engine.process(l, r);
      left.set(l, b * BLOCK);
      scope.setFrame(b * BLOCK);
      for (const p of probes) p.process([[l]]);
    }
    return { probes, left };
  } finally {
    scope.restore();
  }
}

const portFrames = (p: ScopedProbe) => p.port.posted.filter((m): m is Float64Array => m instanceof Float64Array).map((m) => decodeFrame(m));

afterEach(() => {
  delete (globalThis as Record<string, unknown>).crossOriginIsolated;
});

describe('renderSpeech', () => {
  it('gives the same bytes, spans and track for the same seed, and different audio for another', () => {
    const a = renderSpeech(TEXT, OPTS);
    const b = renderSpeech(TEXT, OPTS);
    expect(Buffer.from(a.wav()).equals(Buffer.from(b.wav()))).toBe(true);
    expect(Buffer.from(a.samples.buffer).equals(Buffer.from(b.samples.buffer))).toBe(true);
    expect(b.spans).toEqual(a.spans);
    expect(b.track).toEqual(a.track);
    const c = renderSpeech(TEXT, { ...OPTS, seed: 'another' });
    expect(c.spans).toEqual(a.spans);
    expect(Buffer.from(c.samples.buffer).equals(Buffer.from(a.samples.buffer))).toBe(false);
  });

  it('times the track at the frame rate, on the spans, with the mouth following the sounds', () => {
    const out = renderSpeech(TEXT, OPTS);
    const peak = out.samples.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    expect(peak).toBeGreaterThan(0.02);
    expect(out.samples.length).toBe(Math.ceil((out.spans[out.spans.length - 1].end + 0.4) * SR));
    // one frame per 1/60 s, each at the end of the quantum it was read after
    expect(out.track.length).toBeGreaterThan(60 * (out.samples.length / SR) - 2);
    for (let i = 1; i < out.track.length; i++) {
      const dt = out.track[i].time - out.track[i - 1].time;
      expect(dt).toBeGreaterThan(1 / 60 - BLOCK / SR - 1e-9);
      expect(dt).toBeLessThan(1 / 60 + BLOCK / SR + 1e-9);
      expect(Math.round(out.track[i].time * SR) % BLOCK).toBe(0);
    }
    expect(out.track[0].sounding).toBe(false);
    expect(out.track[0].phoneme).toBe('');
    const sounding = out.track.filter((f) => f.sounding);
    expect(sounding.length).toBeGreaterThan(out.track.length / 2);
    // every sound the probe reports is a phoneme of the plan or a sound the engine holds between them
    const planned = new Set(out.spans.map((s) => s.ipa));
    const heard = new Set(sounding.map((f) => f.phoneme));
    // (and the breaths between phrases, which the engine makes as a beat)
    for (const p of heard) expect((VOCAL_PHONEMES as readonly string[]).includes(p) || p === 'beat:in' || p === 'beat:in>').toBe(true);
    expect([...heard].filter((p) => planned.has(p)).length).toBeGreaterThan(planned.size * 0.7);
    // the lips close for the /m/ of "meet" and open for the vowel of "noon"
    const during = (ipa: string) => sounding.filter((f) => f.phoneme === ipa);
    expect(Math.min(...during('m').map((f) => f.lipAperture))).toBeLessThan(0.1);
    expect(Math.max(...during('u').map((f) => f.lipProtrusion))).toBeGreaterThan(0.5);
    expect(Math.max(...sounding.map((f) => f.glottal))).toBeGreaterThan(0.3);
  });
});

describe('the articulator probe', () => {
  it('in the worklet gives the frames renderSpeech gives, through a port and through a shared ring', () => {
    const capacity = 1024;
    const buffer = new SharedArrayBuffer(ringBytes(capacity));
    const { probes, left } = liveRun([
      { version: ARTICULATOR_PROBE_VERSION, slot: 1, rate: 60 },
      { version: ARTICULATOR_PROBE_VERSION, slot: 1, rate: 60, buffer, capacity },
    ]);
    const live = portFrames(probes[0]);
    const ring = new FrameRing(buffer, capacity);
    const raw = new Float64Array(FRAME_STRIDE);
    const shared: ArticulatorFrame[] = [];
    for (let n = 0; n < ring.count; n++) if (ring.read(n, raw)) shared.push(decodeFrame(raw));
    // the shared ring posts nothing
    expect(probes[1].port.posted).toHaveLength(0);
    expect(shared).toEqual(live);

    const offline = renderSpeech(TEXT, OPTS);
    // the live probe also reads after the render's last quantum, which renderSpeech leaves out
    expect(live.length - offline.track.length).toBeGreaterThanOrEqual(0);
    expect(live.length - offline.track.length).toBeLessThanOrEqual(1);
    const { worst, same } = compare(live.slice(0, offline.track.length), offline.track);
    expect(same).toBe(true);
    // the stated tolerance: the same quantum and within 1e-6 in every value. Measured: 0.
    expect(worst).toBeLessThanOrEqual(1e-6);
    // and the worklet's engine rendered what the source engine rendered
    let diff = 0;
    for (let i = 0; i < offline.samples.length; i++) diff = Math.max(diff, Math.abs(left[i] - offline.samples[i]));
    expect(diff).toBe(0);
  });

  it('with no probe slot, the engine never writes the tap', () => {
    const before = Float64Array.from(PROBE_TAP);
    const score = speechScore(TEXT, OPTS, 0);
    registerBuiltins();
    registerEngine(vocalEngine);
    const out = renderOffline(score.messages, { seconds: score.seconds, sampleRate: SR });
    expect(out.left.some((x) => x !== 0)).toBe(true);
    expect(Array.from(PROBE_TAP)).toEqual(Array.from(before));
  });

  it('stops: after a stop message the processor posts nothing and ends', () => {
    const scope = workletScope();
    try {
      const p = new scope.Probe({ processorOptions: { version: ARTICULATOR_PROBE_VERSION, slot: 2, rate: 375 } });
      const l = new Float32Array(BLOCK);
      expect(p.process([[l]])).toBe(true);
      expect(p.port.posted).toHaveLength(1);
      p.port.onmessage!({ data: 'stop' });
      for (let b = 1; b < 10; b++) {
        scope.setFrame(b * BLOCK);
        expect(p.process([[l]])).toBe(false);
      }
      expect(p.port.posted).toHaveLength(1);
      const bad = new scope.Probe({ processorOptions: { version: 99, slot: 1, rate: 60 } });
      expect(bad.process([[l]])).toBe(false);
    } finally {
      scope.restore();
    }
  });
});

describe('articulatorProbe() on the main thread', () => {
  const made: Array<{ name: string; opts: { processorOptions?: Record<string, unknown> }; node: RecordingNode }> = [];
  class RecordingNode extends FakeWorkletNode {
    constructor(ctx: unknown, name: string, opts?: { processorOptions?: Record<string, unknown> }) {
      super(ctx, name, opts);
      made.push({ name, opts: opts ?? {}, node: this });
    }
  }

  async function boot(): Promise<Bellows> {
    installFakeAudio();
    (globalThis as Record<string, unknown>).AudioWorkletNode = RecordingNode;
    made.length = 0;
    return Bellows.boot({ seed: 'probe', workletUrl: 'fake://worklet', context: new FakeAudioContext() as unknown as AudioContext, plugins: [voice] });
  }

  /** The kernel's port: what bellows posted to its worklet. */
  const kernelPosts = () => made.filter((m) => m.name !== PROBE_PROCESSOR).flatMap((m) => m.node.port.posted as Array<Record<string, unknown>>);
  const probeParams = () => kernelPosts().filter((m) => m.type === 'channelParam' && m.name === 'probe').map((m) => m.value);

  it('is off by default: a singer that speaks makes no probe node and sets no probe slot', async () => {
    const b = await boot();
    singer(b, 'narrator-male').speak('Nothing to watch here.');
    expect(made.some((m) => m.name === PROBE_PROCESSOR)).toBe(false);
    expect(probeParams()).toEqual([]);
    expect(JSON.stringify(kernelPosts())).not.toContain('"probe"');
    b.dispose();
  });

  it('starts a processor on a slot, reads frames back by time, and frees the slot on stop', async () => {
    const b = await boot();
    const alto = singer(b, 'narrator-female');
    const probe = articulatorProbe(b, alto, { rate: 100 });
    expect(probe.transport).toBe('port');
    expect(probe.slot).toBe(1);
    expect(probe.version).toBe(ARTICULATOR_PROBE_VERSION);
    const node = made.find((m) => m.name === PROBE_PROCESSOR)!;
    expect(node.opts.processorOptions).toEqual({ version: ARTICULATOR_PROBE_VERSION, slot: 1, rate: 100 });
    expect(probeParams()).toEqual([1]);
    expect(probe.latest()).toBeNull();

    const send = (time: number, jaw: number, phoneme: number) => {
      const f = new Float64Array(FRAME_STRIDE);
      f[0] = time;
      f[1] = 1;
      f[2] = phoneme;
      f[4] = jaw;
      node.node.port.onmessage!({ data: f } as MessageEvent);
    };
    send(1.0, 0.2, VOCAL_PHONEMES.indexOf('m'));
    send(1.01, 1.2, VOCAL_PHONEMES.indexOf('a'));
    send(1.02, 1.6, VOCAL_PHONEMES.indexOf('a'));
    expect(probe.count).toBe(3);
    expect(probe.latest()!.jaw).toBe(1.6);
    const mid = probe.at(1.005)!;
    expect(mid.jaw).toBeCloseTo(0.7, 12);
    expect(mid.phoneme).toBe('m');
    expect(probe.at(0.5)!.jaw).toBe(0.2);
    expect(probe.at(5)!.jaw).toBe(1.6);
    expect(probe.frames(1.0).map((f) => f.jaw)).toEqual([1.2, 1.6]);

    const second = articulatorProbe(b, singer(b, 'narrator-male'));
    expect(second.slot).toBe(2);
    probe.stop();
    expect(node.node.port.posted).toContain('stop');
    expect(probeParams()).toEqual([1, 2, 0]);
    expect(articulatorProbe(b, alto).slot).toBe(1);
    b.dispose();
  });

  it('asks for a shared ring only where the page is cross-origin isolated', async () => {
    const b = await boot();
    expect(() => articulatorProbe(b, singer(b), { transport: 'shared' })).toThrow(/cross-origin isolated/);
    (globalThis as Record<string, unknown>).crossOriginIsolated = true;
    const p = articulatorProbe(b, singer(b), { capacity: 16 });
    expect(p.transport).toBe('shared');
    const opts = made.find((m) => m.name === PROBE_PROCESSOR)!.opts.processorOptions!;
    expect(opts.buffer).toBeInstanceOf(SharedArrayBuffer);
    expect(opts.capacity).toBe(16);
    // the processor writes the ring; the main thread reads it without a message
    const ring = new FrameRing(opts.buffer as SharedArrayBuffer, 16);
    const f = new Float64Array(FRAME_STRIDE);
    f[0] = 2;
    f[4] = 0.9;
    ring.write(f);
    expect(p.latest()!.jaw).toBe(0.9);
    b.dispose();
  });
});
