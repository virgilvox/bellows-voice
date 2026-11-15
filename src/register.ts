/*
 * The voice on the calling thread, for renderOffline() and Node, where no worklet runs it. A page
 * that plays through bellows' worklet does not need this: the plugin (plugin.ts) carries the
 * engine there, and importing this module is what puts a second copy of the DSP in a bundle.
 */

import { registerEngine } from 'bellowsjs';
import { vocalEngine } from './engines/vocal';

/** Register the 'vocal' engine on this thread, for renderOffline(). */
export function registerVoice(): void {
  registerEngine(vocalEngine);
}
