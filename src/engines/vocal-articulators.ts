/*
 * CHIMERA's 17 articulators (Jameson Hodge, MIT,
 * https://github.com/jamesondh/chimera-vocal-synth at 1d3ea49,
 * control/articulators.rs:23), in the order of VOCAL_ARTICULATOR_NAMES
 * (vocal-tables.gen.ts) and of the geometry's input (vocal-geometry.ts).
 */

/** Articulator indices. */
export const ART = {
  jaw: 0,
  tbX: 1,
  tbY: 2,
  ttX: 3,
  ttY: 4,
  ttCurl: 5,
  root: 6,
  lipAp: 7,
  lipProt: 8,
  lipWidth: 9,
  labiodental: 10,
  velum: 11,
  larynx: 12,
  epilarynx: 13,
  ventricular: 14,
  lateral: 15,
  dorsum: 16,
} as const;

export const ARTICULATORS = 17;

/** Control keys: the 17 articulators, then the glottis: abduction, closure, fold stiffness (cricothyroid). */
export const KEY_ABDUCTION = ARTICULATORS;
export const KEY_CLOSURE = ARTICULATORS + 1;
export const KEY_STIFFNESS = ARTICULATORS + 2;
/** The breath: a factor on the note's lung pressure, negative to draw air in (beats only; speech holds 1). */
export const KEY_BREATH = ARTICULATORS + 3;
