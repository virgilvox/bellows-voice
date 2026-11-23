/*
 * The probe's clock: called once per render quantum, after the kernel rendered it, it says whether a
 * frame is due and fills it. The worklet's processor (processor.ts) and renderSpeech() (offline.ts)
 * run the same rule, so a probe and an offline render of the same score give frames at the same
 * times with the same values.
 *
 * Frame k is due at sample ceil(k * sampleRate / rate) of the context's clock and is taken at the
 * first quantum end at or after it, stamped with that quantum end's time. A late or slow quantum
 * skips frames rather than bunching them, so the rate never exceeds `rate`.
 */

import { F, FRAME_STRIDE } from './frame';
import { PROBE_TAP, clearTapRow } from './tap';

export class ProbeSampler {
  /** The frame last taken. */
  readonly frame = new Float64Array(FRAME_STRIDE);
  private readonly row: number;
  private readonly period: number;
  private next = 0;
  private stamp: number;

  constructor(
    readonly slot: number,
    readonly rate: number,
    readonly sampleRate: number,
  ) {
    this.row = (slot - 1) * FRAME_STRIDE;
    this.period = sampleRate / rate;
    clearTapRow(slot);
    this.stamp = PROBE_TAP[this.row];
  }

  /**
   * A quantum ending at context sample `end` has rendered. True when a frame is due, with it in
   * `frame`. Call every quantum, due or not: whether the voice sounded is read per quantum.
   */
  tick(end: number): boolean {
    const t = PROBE_TAP;
    const o = this.row;
    const stamp = t[o];
    const sounding = stamp !== this.stamp;
    this.stamp = stamp;
    if (end < Math.ceil(this.next * this.period)) return false;
    this.next = Math.floor(end / this.period) + 1;
    const f = this.frame;
    f[F.time] = end / this.sampleRate;
    f[F.sounding] = sounding ? 1 : 0;
    for (let i = F.phoneme; i < FRAME_STRIDE; i++) f[i] = t[o + i];
    return true;
  }
}
