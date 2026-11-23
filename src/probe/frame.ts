/*
 * The articulator probe's frame: what a host reads of the voice's mouth as it plays (probe.ts, on the
 * main thread) or as an offline render made it (offline.ts). One layout for both, versioned, so a
 * host that stores frames or reads the shared buffer directly can check what it holds.
 *
 * A frame is FRAME_STRIDE float64 values, in ARTICULATOR_FIELDS order:
 *
 *   time           seconds on the AudioContext clock (an offline render's own clock from 0) at the
 *                  end of the render quantum the state was read after
 *   sounding       1 if the voice rendered in that quantum, else 0 (the values hold the last state)
 *   phoneme        the sound the engine is making, an index into VOCAL_PHONEMES and then the beats
 *                  (engines/vocal-beats.ts), -1 before the voice has sounded
 *   glottal        voicing amplitude: the airway's voicing level (0 to about 1, smoothed at 25 Hz)
 *                  times the note's envelope
 *   jaw            jaw opening, cm of arc at the incisors (about -0.1 closed to 2.6 wide)
 *   lipAperture    lip opening, cm (under 0 is pressed shut, about 2 wide open)
 *   lipProtrusion  lip rounding forward, cm (0 spread to about 1.4 for /u/)
 *   lipWidth       lip corners, 0 rounded to 1 spread
 *   labiodental    lower lip against the upper teeth, 0 to 1 (f, v)
 *   tongueBodyX/Y  the tongue body's centre, cm in the head frame (x forward, y up, glottis at 0)
 *   tongueTipX/Y   the tongue tip, cm in the same frame
 *   velum          the velar port, cm^2 (under 0 is closed, open for nasals)
 *
 * The articulators are those that shape the sound being heard: between two of the engine's keyframes
 * (about 10.7 ms apart) they are interpolated as the tract's shape is, so the planner's look-ahead
 * (gestures that start before their sound) shows, and nothing ahead of the audio does. Units follow
 * the articulators' own (docs/HOW-IT-WORKS.md, section 4), scaled for the adult male head.
 */

import { VOCAL_PHONEMES } from '../engines/vocal-phonemes';
import { VOCAL_BEAT_BASE, VOCAL_BEATS, VOCAL_SOUND_COUNT } from '../engines/vocal-beats';

/** The frame layout's version. It changes only when a field is added, moved or redefined. */
export const ARTICULATOR_PROBE_VERSION = 1;

/** The fields of a frame, in their order in a raw frame. */
export const ARTICULATOR_FIELDS = [
  'time',
  'sounding',
  'phoneme',
  'glottal',
  'jaw',
  'lipAperture',
  'lipProtrusion',
  'lipWidth',
  'labiodental',
  'tongueBodyX',
  'tongueBodyY',
  'tongueTipX',
  'tongueTipY',
  'velum',
] as const;

export type ArticulatorField = (typeof ARTICULATOR_FIELDS)[number];

/** Float64 values per raw frame. */
export const FRAME_STRIDE = ARTICULATOR_FIELDS.length;

/** Where each field sits in a raw frame. */
export const F = {
  time: 0,
  sounding: 1,
  phoneme: 2,
  glottal: 3,
  /** The first articulator; the ten follow in ARTICULATOR_FIELDS order. */
  jaw: 4,
} as const;

/** How many probes one AudioContext can run at once (the engine's `probe` parameter is the slot). */
export const PROBE_SLOTS = 8;

/** The name the probe's processor registers under in the worklet. */
export const PROBE_PROCESSOR = 'bellows-voice-probe';

/** The fastest frame rate, per second: one frame per 128-sample render quantum at 48 kHz. */
export const PROBE_MAX_RATE = 375;

/** One frame, decoded. */
export interface ArticulatorFrame {
  time: number;
  sounding: boolean;
  /** The sound as IPA ('a', 'ʃ'), a beat as 'beat:B' ('beat:B>' accented), '' before any sound. */
  phoneme: string;
  phonemeIndex: number;
  glottal: number;
  jaw: number;
  lipAperture: number;
  lipProtrusion: number;
  lipWidth: number;
  labiodental: number;
  tongueBodyX: number;
  tongueBodyY: number;
  tongueTipX: number;
  tongueTipY: number;
  velum: number;
}

/** The name of a `phoneme` index: IPA, a beat ('beat:B', 'beat:B>'), or '' for none. */
export function probePhonemeName(index: number): string {
  if (!(index >= 0) || index >= VOCAL_SOUND_COUNT) return '';
  if (index < VOCAL_BEAT_BASE) return VOCAL_PHONEMES[index];
  const n = index - VOCAL_BEAT_BASE;
  return 'beat:' + VOCAL_BEATS[n >> 1].id + (n & 1 ? '>' : '');
}

/** A raw frame (FRAME_STRIDE values from `offset`) as an ArticulatorFrame, into `out` when given. */
export function decodeFrame(raw: ArrayLike<number>, offset = 0, out?: ArticulatorFrame): ArticulatorFrame {
  const f = out ?? ({} as ArticulatorFrame);
  const idx = raw[offset + F.phoneme];
  f.time = raw[offset + F.time];
  f.sounding = raw[offset + F.sounding] !== 0;
  f.phonemeIndex = idx;
  f.phoneme = probePhonemeName(idx);
  f.glottal = raw[offset + F.glottal];
  const a = offset + F.jaw;
  f.jaw = raw[a];
  f.lipAperture = raw[a + 1];
  f.lipProtrusion = raw[a + 2];
  f.lipWidth = raw[a + 3];
  f.labiodental = raw[a + 4];
  f.tongueBodyX = raw[a + 5];
  f.tongueBodyY = raw[a + 6];
  f.tongueTipX = raw[a + 7];
  f.tongueTipY = raw[a + 8];
  f.velum = raw[a + 9];
  return f;
}

/*
 * A ring of raw frames over one buffer: a count (int32, then 4 bytes of padding) and `capacity`
 * frames. The worklet writes it and the main thread reads it when the buffer is shared; on the
 * message port path the main thread writes its own copy from the messages. The count goes up after a
 * frame is written, with Atomics, so a reader never sees a frame before its values.
 */

/** Bytes a ring of `capacity` frames takes. */
export function ringBytes(capacity: number): number {
  return 8 + capacity * FRAME_STRIDE * 8;
}

export class FrameRing {
  readonly capacity: number;
  private readonly head: Int32Array;
  private readonly data: Float64Array;

  constructor(buffer: ArrayBuffer | SharedArrayBuffer, capacity: number) {
    this.capacity = capacity;
    this.head = new Int32Array(buffer, 0, 1);
    this.data = new Float64Array(buffer, 8, capacity * FRAME_STRIDE);
  }

  /** Frames written since the ring was made (the newest is count - 1). */
  get count(): number {
    return Atomics.load(this.head, 0);
  }

  /** Append one raw frame. */
  write(frame: ArrayLike<number>): void {
    const n = Atomics.load(this.head, 0);
    const o = (n % this.capacity) * FRAME_STRIDE;
    const d = this.data;
    for (let i = 0; i < FRAME_STRIDE; i++) d[o + i] = frame[i];
    Atomics.store(this.head, 0, n + 1);
  }

  /**
   * Copy frame number `n` into `out` (FRAME_STRIDE values). False if it is not written yet or its slot
   * is being or has been reused, so the newest capacity - 1 frames are always readable.
   */
  read(n: number, out: Float64Array): boolean {
    const count = Atomics.load(this.head, 0);
    if (n < 0 || n >= count || count - n >= this.capacity) return false;
    const o = (n % this.capacity) * FRAME_STRIDE;
    const d = this.data;
    for (let i = 0; i < FRAME_STRIDE; i++) out[i] = d[o + i];
    // frame n + capacity reuses this slot, and the count reaches it only after that frame is written:
    // a count at n + capacity may already mean a torn copy
    return Atomics.load(this.head, 0) - n < this.capacity;
  }
}
