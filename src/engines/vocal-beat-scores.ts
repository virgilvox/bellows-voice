/*
 * The beatbox scores: each drum sound as a short gestural score on the voice's tract, its acoustic hit
 * at h, with the airstream beatboxers use (vocal-beats.ts lists the sounds). CHIMERA's scores (Jameson
 * Hodge, MIT, crates/chimera/src/phonetics/beatbox.rs), reimplemented on bellows' planner; the breath
 * key, the ejective's push through the release, the kick's raised tongue body, 'ch', 'Psh' and the
 * breath in are bellows' own. See THIRD_PARTY_NOTICES.md.
 *
 * Written against BeatWriter, the few planner primitives a score needs, so the recipes live apart from
 * the planner's machinery. Runs when the planner rebuilds (event rate); allocates nothing.
 */

import { ART, ARTICULATORS, KEY_ABDUCTION, KEY_BREATH, KEY_CLOSURE } from './vocal-articulators';
import { VOCAL_BEATS } from './vocal-beats';
import { VOCAL_TABLE_PHONEMES } from './vocal-tables.gen';

/** What a beat score writes with: the planner's gesture primitives (engines/vocal-planner.ts). */
export interface BeatWriter {
  /** The dorsum's height for [x] at this body. */
  readonly xTbY: number;
  /** Schwa's target for an articulator at this body. */
  schwaTarget(a: number): number;
  begin(): void;
  key(k: number, v: number): void;
  /** A gesture from the keys since begin(): its index, or -1 when the pool is full. */
  emit(t0: number, t1: number, ri: number, ro: number, str: number, speed: number): number;
  /** Rank gesture g as a consonant's, so its speed governs its articulators. */
  rank(g: number, speed: number): void;
  /** A consonant's oral gestures from table phoneme idx with overrides (see VocalPlanner.beatOral). */
  beatOral(idx: number, a: number, b: number, speed: number, snap: number, snapRo: number, after: number, fric: boolean, k1: number, v1: number, k2: number, v2: number, noFront: boolean): void;
}

/* Beat numbers (VOCAL_BEATS order). */
const BEAT_ID = (id: string): number => VOCAL_BEATS.findIndex((b) => b.id === id);
const B_KICK = BEAT_ID('B');
const B_HAT = BEAT_ID('t');
const B_OPEN_HAT = BEAT_ID('tss');
const B_SNARE = BEAT_ID('Pf');
const B_RIM = BEAT_ID('K');
const B_INWARD = BEAT_ID('^K');
const B_CLICK = BEAT_ID('!');
const B_POP = BEAT_ID('P!');
const B_CRASH = BEAT_ID('kch');
const B_HUM = BEAT_ID('m');
const B_CHAT = BEAT_ID('ch');
const B_PSH = BEAT_ID('Psh');
const B_IN = BEAT_ID('in');

/* The table phonemes the beats are built from. */
/** The kick's tongue body, high and short of the palate (/k/ seals at 8.35). */
const KICK_TBY = 7.7;
/** How long after the release the ejective's larynx keeps rising, s. */
const EJECTIVE_PUSH = 0.025;
/** A breath in's lung pressure, a fraction of the note's (about -5.7 cmH2O at the default velocity; INFERRED). */
const BREATH_IN = 0.5;
/**
 * A breath in's glottal opening, cm^2 before k^2. MEASURED: wide open (0.9) the inflow, 330 cm^3/s, was
 * 76 dB under the vowel (noise grows as v^3); at 0.18 and 0.5 of the note's pressure it reads about
 * -33 dB, a quiet but audible breath (INFERRED target).
 */
const BREATH_IN_GLOTTIS = 0.18;
const P_P = VOCAL_TABLE_PHONEMES.indexOf('p');
const P_T = VOCAL_TABLE_PHONEMES.indexOf('t');
const P_K = VOCAL_TABLE_PHONEMES.indexOf('k');
const P_S = VOCAL_TABLE_PHONEMES.indexOf('s');
const P_F = VOCAL_TABLE_PHONEMES.indexOf('f');
const P_SH = VOCAL_TABLE_PHONEMES.indexOf('ʃ');
const P_M = VOCAL_TABLE_PHONEMES.indexOf('m');

/**
 * A beat's gestures, its acoustic hit at h: CHIMERA's scores (phonetics/beatbox.rs), each sound a
 * short score on the tract with the airstream beatboxers use. `len` is the time to the next step,
 * which a sustained sound may fill. `first`: the line's first sound, whose ready posture starts early.
 */
export function writeBeatScore(w: BeatWriter, slot: number, h: number, len: number, first: boolean): void {
  const b = slot >> 1;
  const accent = (slot & 1) === 1 ? 1.3 : 1;
  const hum = b === B_HUM || b === B_IN;
  // the ready posture: jaw nearly closed, lips just apart, the dorsum a little high for the velar hits
  w.begin();
  for (let k = 0; k < ARTICULATORS; k++) {
    if (k === ART.velum) continue;
    let v = w.schwaTarget(k);
    if (k === ART.tbY) v += 0.1;
    else if (k === ART.jaw) v = 0.4;
    else if (k === ART.lipAp) v = 0.25;
    else if (k === ART.lipProt) v = 0.1;
    w.key(k, v);
  }
  w.emit(first ? h - 0.15 : h, h + len, 0.03, 0.03, 1, 0);
  if (!hum) {
    // the velum shut, so the pressure a sound builds stays in the mouth
    w.begin();
    w.key(ART.velum, w.schwaTarget(ART.velum));
    w.emit(first ? h - 0.15 : h - 0.02, h + len, 0.03, 0.03, 4, 0);
  }
  const NaN_ = NaN;
  if (b === B_KICK) {
    w.beatOral(P_P, h - 0.075, h, 2, 3.5, 0.01, NaN_, false, ART.jaw, 0.3, -1, 0, false);
    // the tongue body high in the mouth, short of the palate: the larynx compresses the volume behind
    // the lips, and the less of it the higher the pressure (dP = rho c^2 dV / V; MEASURED: the open
    // mouth's kick reached 7 cmH2O where the velar rimshot reached 19)
    artic(w, ART.tbY, KICK_TBY, h - 0.09, h + 0.01, 0.03, 0.04, 2);
    ejective(w, h - 0.075, h, accent);
  } else if (b === B_HAT || b === B_CHAT) {
    const fric = b === B_HAT ? P_S : P_SH;
    const end = b === B_HAT ? 0.03 : 0.05;
    w.beatOral(P_T, h - 0.05, h, 2, 3.5, 0.01, NaN_, false, ART.jaw, 0.3, -1, 0, false);
    w.beatOral(fric, h + 0.012, h + end, 1.6, 0, 0, 0.008, false, -1, 0, -1, 0, false);
    blow(w, h - 0.03, h + end - 0.004, (b === B_HAT ? 1.25 : 1.3) * accent, b === B_HAT ? 0.36 : 0.38, 0.02);
  } else if (b === B_OPEN_HAT) {
    const end = Math.max(0.09, Math.min(0.26, len * 1.6));
    w.beatOral(P_T, h - 0.05, h, 2, 3.5, 0.01, NaN_, false, ART.jaw, 0.3, -1, 0, false);
    w.beatOral(P_S, h + 0.012, h + end, 1.4, 0, 0, 0.008, false, -1, 0, -1, 0, false);
    blow(w, h - 0.03, h + end, 1.2 * accent, 0.4, 0.09);
  } else if (b === B_SNARE || b === B_PSH) {
    const pf = b === B_SNARE;
    w.beatOral(P_P, h - 0.06, h, 2, 3.5, 0.01, NaN_, false, -1, 0, -1, 0, false);
    w.beatOral(pf ? P_F : P_SH, h + 0.018, h + (pf ? 0.08 : 0.11), pf ? 1.6 : 1.5, 0, 0, 0.008, false, -1, 0, -1, 0, false);
    blow(w, h - 0.045, h + (pf ? 0.075 : 0.1), 1.7 * accent, 0.45, pf ? 0.04 : 0.05);
  } else if (b === B_RIM) {
    w.beatOral(P_K, h - 0.08, h, 2, 4, 0.008, NaN_, false, ART.jaw, 0.35, -1, 0, false);
    ejective(w, h - 0.08, h, accent);
  } else if (b === B_INWARD) {
    w.beatOral(P_K, h - 0.06, h, 2, 4, 0.008, NaN_, false, ART.jaw, 0.35, -1, 0, false);
    w.beatOral(P_K, h + 0.012, h + 0.085, 1.4, 0, 0, 0.008, true, ART.tbY, w.xTbY - 0.015, -1, 0, false);
    w.begin();
    w.key(KEY_ABDUCTION, 0.5);
    w.emit(h - 0.05, h + 0.085, 0.02, 0.04, 6, 0);
    // the breath drawn in behind the closure, so the release rushes inward
    w.begin();
    w.key(KEY_BREATH, -1.7 * accent);
    w.emit(h - 0.035, h + 0.085, 0.015, 0.05, 2, 0);
  } else if (b === B_CLICK) {
    // the tip seals without the alveolar's fronted tongue body (that would close the pocket)
    w.beatOral(P_T, h - 0.12, h, 2, 3.5, 0.01, NaN_, false, -1, 0, -1, 0, true);
    // the back seal sits low, leaving a pocket for the dorsum to hollow
    w.beatOral(P_K, h - 0.12, h + 0.035, 2, 0, 0, NaN_, false, ART.tbY, 7.85, ART.jaw, 0.4, false);
    artic(w, ART.dorsum, 1, h - 0.03, h + 0.006, 0.04, 0.03, 2);
  } else if (b === B_POP) {
    // a light seal: pressing the lips squeezes the pocket before the suction starts
    w.beatOral(P_P, h - 0.12, h, 2, 5, 0.006, NaN_, false, ART.lipAp, -0.08, -1, 0, false);
    w.beatOral(P_K, h - 0.12, h + 0.03, 2, 0, 0, NaN_, false, -1, 0, -1, 0, false);
    // the lips stay sealed while the jaw and tongue hollow the mouth
    w.begin();
    w.key(ART.jaw, 1.6);
    w.key(ART.dorsum, 1);
    const g = w.emit(h - 0.07, h + 0.004, 0.04, 0.05, 40, 2);
    if (g >= 0) w.rank(g, 2);
  } else if (b === B_CRASH) {
    const end = Math.max(0.14, Math.min(0.34, len * 2));
    // the back of the tongue lingers by the velum after the burst ([x]) while the blade rises into a long [ʃ]
    w.beatOral(P_K, h - 0.06, h, 2, 4, 0.008, NaN_, false, -1, 0, -1, 0, false);
    w.beatOral(P_K, h + 0.002, h + 0.045, 2, 0, 0, 0.008, true, ART.tbY, w.xTbY, -1, 0, false);
    w.beatOral(P_SH, h + 0.025, h + end, 1.4, 0, 0, 0.008, false, -1, 0, -1, 0, false);
    blow(w, h - 0.035, h + end, 1.75 * accent, 0.45, 0.14);
  } else if (b === B_HUM) {
    const end = Math.max(0.06, len * 0.92);
    // lips shut before the voice starts, so the note begins as a hum; the velum drops into the
    // sealed mouth while the folds are still apart, so the squeezed air does not pop out the nose
    w.beatOral(P_M, h - 0.03, h + end, 1.6, 0, 0, NaN_, false, -1, 0, -1, 0, false);
    w.begin();
    w.key(ART.velum, 0.9);
    w.emit(h - 0.02, h + end, 0.03, 0.03, 4, 0);
    w.begin();
    w.key(KEY_ABDUCTION, 0.3);
    w.emit(h - 0.08, h - 0.03, 0.02, 0.02, 5, 0);
    w.begin();
    w.key(KEY_BREATH, 0.95 * accent);
    w.emit(h - 0.01, h + end, 0.02, 0.04, 1, 0);
  } else if (b === B_IN) {
    // a breath in between phrases (Werner et al. 2021: noise with no pitch, louder the faster the
    // breath and the wider the jaw): the glottis wide, the jaw open, the velum part open (mouth and
    // nose), and the lungs below the mouth's pressure. The amounts are INFERRED, gated on level.
    const end = Math.max(0.12, len);
    artic(w, ART.jaw, 0.95, h - 0.04, h + end - 0.05, 0.05, 0.06, 1.2);
    w.begin();
    w.key(ART.lipAp, 0.9);
    w.key(ART.velum, 0.5);
    w.emit(h - 0.04, h + end - 0.05, 0.05, 0.06, 4, 0);
    w.begin();
    w.key(KEY_ABDUCTION, BREATH_IN_GLOTTIS);
    w.emit(h - 0.03, h + end, 0.03, 0.05, 8, 0);
    w.begin();
    w.key(KEY_BREATH, -BREATH_IN * accent);
    w.emit(h, h + end - 0.04, 0.06, 0.05, 2, 0);
  }
  // B_REST: the ready posture only
}

/** One articulator held at a target over [t0, t1] at strength 40, moving at `speed`. */
function artic(w: BeatWriter, k: number, v: number, t0: number, t1: number, ri: number, ro: number, speed: number): void {
  w.begin();
  w.key(k, v);
  const g = w.emit(t0, t1, ri, ro, 40, speed);
  if (g >= 0) w.rank(g, speed);
}

/** The glottalic piston: the glottis sealed through the closure, the larynx raised just before the release at h. */
function ejective(w: BeatWriter, at: number, h: number, accent: number): void {
  w.begin();
  w.key(KEY_CLOSURE, 1);
  w.emit(at - 0.012, h + 0.03, 0.012, 0.03, 8, 0);
  w.begin();
  w.key(ART.larynx, Math.min(1.6, 1.25 + 0.3 * accent));
  // still rising through the release: the piston, not the few tenths of a cm^3 the closure
  // compressed, drives the puff that follows the burst
  const g = w.emit(h - 0.05, h + EJECTIVE_PUSH, 0.03, 0.08, 40, 3);
  if (g >= 0) w.rank(g, 3);
}

/**
 * Lung pressure (times the note's) over [t0, t1], with the glottis held open until the breath has
 * gone, or the folds would start to buzz on what is left.
 */
function blow(w: BeatWriter, t0: number, t1: number, level: number, abduction: number, tail: number): void {
  w.begin();
  w.key(KEY_ABDUCTION, abduction);
  w.emit(t0, t1 + tail + 0.02, 0.02, 0.03, 6, 0);
  w.begin();
  w.key(KEY_BREATH, level);
  w.emit(t0 - 0.01, t1, 0.02, tail, 1, 0);
}
