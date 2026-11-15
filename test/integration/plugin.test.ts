/*
 * The voice as a bellows plugin: loaded into the worklet after the kernel, listed without its DSP,
 * and rendering through the worklet exactly what renderOffline renders from the engine's source.
 * The score a render hands the worklet is captured from a stand-in OfflineAudioContext, then
 * rendered both ways: by renderOffline with the engine registered on this thread, and by b.render()
 * through the plugin's script on this thread (no OfflineAudioContext).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Bellows, listEngines, registerBuiltins, renderOffline, type KernelMessage } from 'bellowsjs';
import { voice, VOCAL_ENGINE_INFO } from '../../src/plugin';
import { registerVoice } from '../../src/register';
import { vocalEngine } from '../../src/engines/vocal';
import { singer } from '../../src/singer';
import { FakeAudioContext, FakeWorkletNode, installFakeAudio } from './fake-context';

let modules: string[] = [];
let captured: KernelMessage[] | null = null;

class CapturingOfflineContext {
  readonly destination = { connect(): void {}, disconnect(): void {} };
  readonly sampleRate: number;
  readonly length: number;
  constructor(o: { length: number; sampleRate: number }) {
    this.sampleRate = o.sampleRate;
    this.length = o.length;
  }
  get audioWorklet(): { addModule(url: string): Promise<void> } {
    return { addModule: async (url: string) => void modules.push(url) };
  }
  async startRendering(): Promise<{ getChannelData(c: number): Float32Array }> {
    const silent = new Float32Array(this.length);
    return { getChannelData: () => silent };
  }
}

class CapturingNode extends FakeWorkletNode {
  constructor(ctx: unknown, name: string, opts?: { processorOptions?: { setup?: KernelMessage[] } }) {
    super(ctx, name, opts);
    if (ctx instanceof CapturingOfflineContext) captured = opts?.processorOptions?.setup ?? null;
  }
}

const live: Bellows[] = [];
async function piece(): Promise<Bellows> {
  const b = await Bellows.boot({
    seed: 'voice-plugin',
    workletUrl: 'fake://worklet',
    context: new FakeAudioContext() as unknown as AudioContext,
    plugins: [voice],
  });
  live.push(b);
  const alto = singer(b, { body: 1 }, { accent: 'southern-british' });
  const bass = singer(b, { body: 0, glottis: 0 });
  b.clock.at('1m', (t, step) => {
    if (step !== 0) return;
    alto.sing('far away, the water', [
      { note: 'A4', dur: '8n' }, { note: 'C5', dur: '8n' }, { note: 'B4', dur: '4n' },
      { note: 'A4', dur: '8n' }, { note: 'G4', dur: '8n' }, { note: 'A4', dur: '4n' },
    ], { at: t + 0.3 });
    bass.speak('Good morning. Where are you from?', { at: t + 0.3, accent: 'australian' });
  });
  return b;
}

beforeEach(() => {
  installFakeAudio();
  modules = [];
  captured = null;
});
afterEach(() => {
  for (const b of live.splice(0)) b.dispose();
  delete (globalThis as Record<string, unknown>).OfflineAudioContext;
  (globalThis as Record<string, unknown>).AudioWorkletNode = FakeWorkletNode;
});

describe('the voice plugin', () => {
  it('describes the engine as its definition does, without the DSP', () => {
    const { createVoice: _, ...info } = vocalEngine;
    expect(VOCAL_ENGINE_INFO).toEqual(JSON.parse(JSON.stringify(info)));
    expect(voice.engines).toEqual([VOCAL_ENGINE_INFO]);
    expect(voice.worklet.length).toBeGreaterThan(50_000);
    expect(voice.worklet.startsWith('/*! bellows-voice | MIT')).toBe(true);
  });

  it('loads after the kernel module and lists the vocal engine', async () => {
    await piece();
    expect(listEngines().some((e) => e.id === 'vocal')).toBe(true);
  });

  it('renders through the worklet sample for sample what renderOffline renders from source', async () => {
    (globalThis as Record<string, unknown>).OfflineAudioContext = CapturingOfflineContext;
    (globalThis as Record<string, unknown>).AudioWorkletNode = CapturingNode;
    await (await piece()).render({ seconds: 5, sampleRate: 48000 });
    expect(modules).toHaveLength(2);
    expect(captured).not.toBeNull();

    delete (globalThis as Record<string, unknown>).OfflineAudioContext;
    (globalThis as Record<string, unknown>).AudioWorkletNode = FakeWorkletNode;
    const inProcess = await (await piece()).render({ seconds: 5, sampleRate: 48000 });

    registerBuiltins();
    registerVoice();
    const reference = renderOffline(captured!, { seconds: 5, sampleRate: 48000 });
    let peak = 0;
    let worst = 0;
    for (let i = 0; i < reference.left.length; i++) {
      peak = Math.max(peak, Math.abs(reference.left[i]));
      worst = Math.max(worst, Math.abs(reference.left[i] - inProcess.left[i]), Math.abs(reference.right[i] - inProcess.right[i]));
    }
    expect(peak).toBeGreaterThan(0.02);
    expect(worst).toBe(0);
  });
});
