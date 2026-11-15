/*
 * The voice as a bellows plugin: the engine's worklet script and its description, plain data for
 * Bellows.boot({ plugins: [voice] }) or b.use(voice). Neither imports the engine's DSP, so a page
 * carries the voice once, inside the script, and only if it uses it.
 */

import type { BellowsPlugin } from 'bellowsjs';
import { workletCode } from './worklet-code.gen';
import { VOCAL_ENGINE_INFO } from './catalog.gen';

export { VOCAL_ENGINE_INFO };

export const voice: BellowsPlugin = {
  id: 'bellows-voice',
  worklet: workletCode,
  engines: [VOCAL_ENGINE_INFO],
};
