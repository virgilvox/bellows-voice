/*
 * Where a probed voice leaves its state for the probe to read: one row per probe slot, on the thread
 * the voice renders on. In the worklet that is the plugin's scope, shared by the engine and the
 * probe's processor (both in the plugin's one script); for an offline render it is the calling
 * thread, shared by the engine and renderSpeech().
 *
 * A row is FRAME_STRIDE float64 values laid out as a frame (frame.ts), except that its first value
 * is a count of writes instead of a time and its second is unused: the sampler tells whether the
 * voice rendered since it last looked by whether the count moved. The voice writes only while its
 * `probe` parameter names the slot, so with no probe the engine never touches this.
 */

import { ART } from '../engines/vocal-articulators';
import { VOCAL_NEUTRAL } from '../engines/vocal-tables.gen';
import { F, FRAME_STRIDE, PROBE_SLOTS } from './frame';

export const PROBE_TAP = new Float64Array(PROBE_SLOTS * FRAME_STRIDE);

/** The articulators a frame carries, in frame order from F.jaw. */
export const PROBE_ARTICULATORS: readonly number[] = [
  ART.jaw,
  ART.lipAp,
  ART.lipProt,
  ART.lipWidth,
  ART.labiodental,
  ART.tbX,
  ART.tbY,
  ART.ttX,
  ART.ttY,
  ART.velum,
];

/** Put a slot's row back to before any sound: no phoneme, no voicing, the rest posture. The count stays. */
export function clearTapRow(slot: number): void {
  const o = (slot - 1) * FRAME_STRIDE;
  const t = PROBE_TAP;
  t[o + F.phoneme] = -1;
  t[o + F.glottal] = 0;
  for (let j = 0; j < PROBE_ARTICULATORS.length; j++) t[o + F.jaw + j] = VOCAL_NEUTRAL[PROBE_ARTICULATORS[j]];
}
