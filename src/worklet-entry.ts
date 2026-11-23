/*
 * The voice's worklet module. Bundled into one self-contained script by scripts/gen-plugin.mjs and
 * added after bellows' kernel module (Bellows.boot({ plugins: [voice] })), it registers the 'vocal'
 * engine through the hook the kernel leaves on the AudioWorkletGlobalScope, and the articulator
 * probe's processor (probe/processor.ts), which reads the engine's state in this same scope.
 */

import type { KernelHook } from 'bellowsjs';
import { vocalEngine } from './engines/vocal';
import { registerProbeProcessor } from './probe/processor';

const hook = (globalThis as Record<string, unknown>).bellowsKernel as KernelHook | undefined;
if (!hook || typeof hook.registerEngine !== 'function') {
  throw new Error('bellows-voice: the bellows kernel must load first. Use Bellows.boot({ plugins: [voice] }) or b.use(voice).');
}
hook.registerEngine(vocalEngine);
registerProbeProcessor();
