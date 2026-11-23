/*
 * The articulator probe on the main thread: the voice's mouth as the audio plays, for a host that
 * animates a face, draws the tract or records the motion in sync with what is heard.
 *
 *   const probe = articulatorProbe(b, alto, { rate: 60 });
 *   alto.speak('Hello there.');
 *   function draw() {
 *     const f = probe.heard();          // the frame playing out of the speakers now
 *     if (f) face.jaw = f.jaw / 2;
 *     requestAnimationFrame(draw);
 *   }
 *
 * It sets the singer's `probe` parameter to a slot and adds a small processor to bellows' worklet
 * (probe/processor.ts) that reads the engine's state after every render quantum and sends a frame
 * at `rate`. Without a probe nothing of this runs: the engine compares one number per process call
 * and sends nothing. The frames carry the AudioContext time of the audio they describe, so a host
 * aligns them with getOutputTimestamp(); `heard()` does that.
 */

import type { Bellows } from 'bellowsjs';
import {
  ARTICULATOR_PROBE_VERSION,
  F,
  FRAME_STRIDE,
  FrameRing,
  PROBE_MAX_RATE,
  PROBE_PROCESSOR,
  PROBE_SLOTS,
  decodeFrame,
  ringBytes,
  type ArticulatorFrame,
} from './frame';
import type { ProbeProcessorOptions } from './processor';

export interface ArticulatorProbeOptions {
  /** Frames per second, 1 to 375 (one per render quantum at 48 kHz). Default 60. */
  rate?: number;
  /** Frames kept for reading back, at least 4. Default 256 (over 4 s at 60). */
  capacity?: number;
  /**
   * 'shared' writes frames into a SharedArrayBuffer and sends no messages (needs a cross-origin
   * isolated page); 'port' sends one message per frame; 'auto' (default) is shared where it can be.
   */
  transport?: 'auto' | 'shared' | 'port';
}

/** What a probed singer needs: its channel's params. A Singer is one. */
export interface ProbeTarget {
  readonly channel: number;
  param(name: string, value: number): unknown;
}

export interface ArticulatorProbe {
  /** The frame layout's version (ARTICULATOR_PROBE_VERSION). */
  readonly version: number;
  readonly transport: 'shared' | 'port';
  /** Frames per second. */
  readonly rate: number;
  /** The engine's probe slot, 1 to 8. */
  readonly slot: number;
  /** Frames received so far. */
  readonly count: number;
  /** The newest frame, into `out` when given; null before the first. */
  latest(out?: ArticulatorFrame): ArticulatorFrame | null;
  /**
   * The state at AudioContext time `time`, interpolated between the two frames around it (the
   * phoneme and `sounding` from the earlier). Before the oldest frame kept, the oldest; after the
   * newest, the newest. Null before the first frame.
   */
  at(time: number, out?: ArticulatorFrame): ArticulatorFrame | null;
  /** The context time being heard now: getOutputTimestamp() where there is one, else currentTime less the latencies. */
  heardTime(): number;
  /** at(heardTime()). */
  heard(out?: ArticulatorFrame): ArticulatorFrame | null;
  /** Every frame kept that is newer than `since` (context seconds), oldest first. */
  frames(since?: number): ArticulatorFrame[];
  /** Stop: the processor ends, the singer's slot is freed, no more frames arrive. */
  stop(): void;
}

/* the slots in use, per context: the worklet scope, and so the engine's tap, is one per context */
const used = new WeakMap<object, Set<number>>();

interface ProbeNode {
  port: MessagePort;
  connect(dest: unknown): unknown;
  disconnect(): void;
}

/**
 * Start reading a singer's articulators as it plays. `b` must have the voice plugin loaded
 * (Bellows.boot({ plugins: [voice] }) or await b.use(voice)). Up to eight probes per context.
 */
export function articulatorProbe(b: Bellows, target: ProbeTarget, opts: ArticulatorProbeOptions = {}): ArticulatorProbe {
  const ctx = b.ctx;
  const rate = Math.min(Math.max(opts.rate ?? 60, 1), PROBE_MAX_RATE);
  const capacity = Math.max(4, Math.floor(opts.capacity ?? 256));
  const g = globalThis as { crossOriginIsolated?: boolean; SharedArrayBuffer?: unknown; AudioWorkletNode?: unknown };
  const canShare = typeof g.SharedArrayBuffer === 'function' && g.crossOriginIsolated === true;
  const want = opts.transport ?? 'auto';
  if (want === 'shared' && !canShare) {
    throw new Error('bellows-voice: a shared probe needs SharedArrayBuffer, which needs a cross-origin isolated page; use transport "port"');
  }
  const transport: 'shared' | 'port' = want === 'port' || !canShare ? 'port' : 'shared';
  if (typeof g.AudioWorkletNode !== 'function') throw new Error('bellows-voice: articulatorProbe() needs AudioWorkletNode');

  let slots = used.get(ctx);
  if (!slots) used.set(ctx, (slots = new Set()));
  let slot = 0;
  for (let s = 1; s <= PROBE_SLOTS; s++) {
    if (!slots.has(s)) {
      slot = s;
      break;
    }
  }
  if (slot === 0) throw new Error(`bellows-voice: ${PROBE_SLOTS} probes are running on this context already; stop one first`);

  const buffer = transport === 'shared' ? new SharedArrayBuffer(ringBytes(capacity)) : new ArrayBuffer(ringBytes(capacity));
  const ring = new FrameRing(buffer, capacity);
  const processorOptions: ProbeProcessorOptions = { version: ARTICULATOR_PROBE_VERSION, slot, rate };
  if (transport === 'shared') {
    processorOptions.buffer = buffer as SharedArrayBuffer;
    processorOptions.capacity = capacity;
  }
  const Node = g.AudioWorkletNode as new (c: unknown, name: string, o: unknown) => ProbeNode;
  let node: ProbeNode;
  try {
    node = new Node(ctx, PROBE_PROCESSOR, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], processorOptions });
  } catch (err) {
    throw new Error(
      'bellows-voice: the probe processor is not in this context\'s worklet. Load the voice first: ' +
        'Bellows.boot({ plugins: [voice] }) or await b.use(voice). (' + String(err) + ')',
    );
  }
  slots.add(slot);
  if (transport === 'port') {
    node.port.onmessage = (e: MessageEvent) => {
      const d = e.data as unknown;
      if (d instanceof Float64Array && d.length === FRAME_STRIDE) ring.write(d);
    };
  }
  // fed from bellows' output, so it renders after the kernel in each quantum; its own output is silent
  b.analyser.connect(node as unknown as AudioNode);
  node.connect(ctx.destination);
  target.param('probe', slot);

  const a = new Float64Array(FRAME_STRIDE);
  const c = new Float64Array(FRAME_STRIDE);
  let stopped = false;

  /* the oldest frame number still readable */
  const oldest = () => Math.max(0, ring.count - capacity + 1);

  const probe: ArticulatorProbe = {
    version: ARTICULATOR_PROBE_VERSION,
    transport,
    rate,
    slot,
    get count() {
      return ring.count;
    },
    latest(out) {
      const n = ring.count - 1;
      return n >= 0 && ring.read(n, a) ? decodeFrame(a, 0, out) : null;
    },
    at(time, out) {
      let hi = ring.count - 1;
      if (hi < 0 || !ring.read(hi, a)) return null;
      if (time >= a[F.time]) return decodeFrame(a, 0, out);
      let lo = oldest();
      if (!ring.read(lo, a)) return null;
      if (time <= a[F.time]) return decodeFrame(a, 0, out);
      // frames are in time order: t(lo) < time < t(hi)
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (!ring.read(mid, a)) return null;
        if (a[F.time] <= time) lo = mid;
        else hi = mid;
      }
      if (!ring.read(lo, a) || !ring.read(hi, c)) return null;
      const u = (time - a[F.time]) / (c[F.time] - a[F.time]);
      for (let i = F.glottal; i < FRAME_STRIDE; i++) a[i] += (c[i] - a[i]) * u;
      a[F.time] = time;
      return decodeFrame(a, 0, out);
    },
    heardTime() {
      const x = ctx as AudioContext & { getOutputTimestamp?: () => { contextTime?: number }; outputLatency?: number };
      const ts = typeof x.getOutputTimestamp === 'function' ? x.getOutputTimestamp() : undefined;
      if (ts && typeof ts.contextTime === 'number' && ts.contextTime > 0) return ts.contextTime;
      return x.currentTime - (x.outputLatency ?? 0) - (x.baseLatency ?? 0);
    },
    heard(out) {
      return probe.at(probe.heardTime(), out);
    },
    frames(since = -Infinity) {
      const list: ArticulatorFrame[] = [];
      for (let n = oldest(); n < ring.count; n++) {
        if (ring.read(n, a) && a[F.time] > since) list.push(decodeFrame(a));
      }
      return list;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      node.port.postMessage('stop');
      node.port.onmessage = null;
      try {
        b.analyser.disconnect(node as unknown as AudioNode);
      } catch {
        // already gone with its context
      }
      node.disconnect();
      target.param('probe', 0);
      slots!.delete(slot);
    },
  };
  return probe;
}
