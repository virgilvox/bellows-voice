/*
 * The probe's AudioWorkletProcessor, registered by the plugin's script beside the engine, so it reads
 * the engine's tap (tap.ts) in the same scope. articulatorProbe() (probe.ts) makes its node and feeds
 * it bellows' output, which makes the browser render it after the kernel in every quantum: the state
 * it reads is the state at the end of that quantum.
 *
 * Frames go out through a shared ring when the main thread passed one (a SharedArrayBuffer, which
 * needs a cross-origin isolated page) and allocate nothing; otherwise each frame is one message on
 * the node's port. A 'stop' message ends the processor, after which it posts nothing.
 */

import { ARTICULATOR_PROBE_VERSION, FrameRing, PROBE_MAX_RATE, PROBE_PROCESSOR, PROBE_SLOTS } from './frame';
import { ProbeSampler } from './sampler';

/** What articulatorProbe() hands the processor. */
export interface ProbeProcessorOptions {
  version: number;
  slot: number;
  rate: number;
  /** A ring (frame.ts) to write, shared with the main thread; left out, frames are posted. */
  buffer?: SharedArrayBuffer;
  capacity?: number;
}

interface WorkletScope {
  sampleRate: number;
  currentFrame: number;
  AudioWorkletProcessor?: new () => { readonly port: MessagePort };
  registerProcessor?: (name: string, ctor: unknown) => void;
}

/** Register the probe's processor, when this scope can (an AudioWorkletGlobalScope, or bellows' stand-in for one). */
export function registerProbeProcessor(): void {
  const g = globalThis as unknown as WorkletScope;
  const Base = g.AudioWorkletProcessor;
  if (typeof Base !== 'function' || typeof g.registerProcessor !== 'function') return;

  class ProbeProcessor extends Base {
    private readonly sampler: ProbeSampler | null = null;
    private readonly ring: FrameRing | null = null;
    private alive = true;

    constructor(options?: { processorOptions?: ProbeProcessorOptions }) {
      super();
      this.port.onmessage = (e: MessageEvent) => {
        if (e.data === 'stop') this.alive = false;
      };
      const o = options?.processorOptions;
      if (!o || o.version !== ARTICULATOR_PROBE_VERSION) {
        this.port.postMessage({ type: 'error', message: 'bellows-voice: probe options of an unknown version' });
        this.alive = false;
        return;
      }
      const slot = Math.round(o.slot);
      const rate = Math.min(Math.max(o.rate, 1), PROBE_MAX_RATE);
      if (!(slot >= 1 && slot <= PROBE_SLOTS)) {
        this.port.postMessage({ type: 'error', message: 'bellows-voice: no probe slot ' + String(o.slot) });
        this.alive = false;
        return;
      }
      this.sampler = new ProbeSampler(slot, rate, g.sampleRate);
      if (o.buffer && o.capacity) this.ring = new FrameRing(o.buffer, o.capacity);
    }

    process(inputs: Float32Array[][]): boolean {
      const s = this.sampler;
      if (!this.alive || !s) return false;
      const ch = inputs[0]?.[0];
      const end = g.currentFrame + (ch ? ch.length : 128);
      if (s.tick(end)) {
        if (this.ring) this.ring.write(s.frame);
        else this.port.postMessage(s.frame);
      }
      return true;
    }
  }

  g.registerProcessor(PROBE_PROCESSOR, ProbeProcessor);
}
