/*
 * Side branches of the airway: cavities that open off the main tube and put zeros in its spectrum.
 *
 * A closed side tube of depth L and area A presents Z(w) = -j Z0 cot(wL / c) at its mouth; near its
 * quarter-wave resonance w0 = pi c / 2L that is Z ~ j Z0 (w - w0) L / c, the impedance of a series
 * mass and spring with M = rho L / (2 A) and K = w0^2 M. A Helmholtz resonator is that element exactly:
 * M = rho L_neck / A_neck, K = rho c^2 / V. So every branch here is one lumped series M, R, K, and the
 * airway folds it into a junction as it folds a wall (docs/HOW-IT-WORKS.md, section 11.1).
 *
 * Discretized by the trapezoidal rule (the bilinear transform), which maps a passive impedance to a
 * passive discrete element at any rate: the walls' explicit spring made a 4.2 kHz branch unstable at
 * 22.05 kHz (MEASURED). With D = M / T + R / 2 + K T / 4 the branch's flow is
 *
 *   q_n = p_n / (2 D) + (p_{n-1} / 2 + (M / T - R / 2 - K T / 4) q_{n-1} - K y_{n-1}) / D
 *   y_n = y_{n-1} + T (q_n + q_{n-1}) / 2
 *
 * a conductance 1 / (2 D) in the junction's solve and a history flow; the resonance is pre-warped,
 * w_set = (2 / T) tan(w0 T / 2). Pure arithmetic, no state: the airway holds each branch's q, y, p.
 */

import { AIR_DENSITY, SOUND_SPEED } from './air';

const RHO = AIR_DENSITY;

/**
 * A trapezoidal branch's coefficients, in a Float64Array of 3: [0] 1 / D, [1] the history coefficient
 * M / T - R / 2 - K T / 4, [2] K. The functions below fill the array they are given, so the airway
 * can configure on the audio thread without allocating.
 */
export type BranchCoefficients = Float64Array;

/** A series mass-spring branch of mass M (g/cm^4) tuned to f0 (Hz) at quality q, at `rate`. */
export function branchCoefficients(M: number, f0: number, q: number, rate: number, out: BranchCoefficients = new Float64Array(3)): BranchCoefficients {
  const w0 = 2 * Math.PI * f0;
  const wSet = 2 * rate * Math.tan(w0 / (2 * rate));
  const K = wSet * wSet * M;
  // the damping at the pre-warped frequency too, so Q holds near Nyquist (at w0 it came out 1.57 times
  // too high for the fossae at 22050 Hz)
  const R = (wSet * M) / q;
  const D = M * rate + 0.5 * R + K / (4 * rate);
  out[0] = 1 / D;
  out[1] = M * rate - 0.5 * R - K / (4 * rate);
  out[2] = K;
  return out;
}

/*
 * The piriform fossae (Dang and Honda 1997, JASA 101, 456-465): MRI volumes 2.1 to 2.9 cm^3, depths
 * 1.6 to 2.0 cm, a spectral minimum at 4 to 5 kHz. The pair as one branch of 2.5 k^3 cm^3 and 1.8 k cm,
 * end-corrected by 0.61 of each fossa's radius: 4.2 kHz in the male body.
 */
const PIRIFORM_VOLUME = 2.5;
const PIRIFORM_DEPTH = 1.8;
/** INFERRED: soft mucosal walls; the measured minima are a few hundred Hz wide. */
const PIRIFORM_Q = 10;

/** The piriform fossae for a body of scale k at `rate`. */
export function piriformBranch(k: number, rate: number, out?: BranchCoefficients): BranchCoefficients {
  const depth = PIRIFORM_DEPTH * k;
  const area = (PIRIFORM_VOLUME * k * k * k) / depth;
  const leff = depth + 0.61 * Math.sqrt(area / 2 / Math.PI);
  return branchCoefficients((RHO * leff) / (2 * area), SOUND_SPEED / (4 * leff), PIRIFORM_Q, rate, out);
}

/*
 * The maxillary sinuses (Dang and Honda 1996, JASA 100, 3374-3383: four Helmholtz resonators model the
 * sinuses; the maxillary zero lies between 310 and 950 Hz). The pair as one resonator of 30 k^3 cm^3
 * behind an ostium of 0.2 k^2 cm^2 and 1 k cm: 455 Hz in the male body.
 */
const SINUS_VOLUME = 30;
const SINUS_NECK_AREA = 0.2;
const SINUS_NECK_LENGTH = 1;
/** INFERRED. */
const SINUS_Q = 8;

/** The maxillary sinuses for a body of scale k at `rate`. */
export function sinusBranch(k: number, rate: number, out?: BranchCoefficients): BranchCoefficients {
  const v = SINUS_VOLUME * k * k * k;
  const m = (RHO * SINUS_NECK_LENGTH * k) / (SINUS_NECK_AREA * k * k);
  const f0 = Math.sqrt((RHO * SOUND_SPEED * SOUND_SPEED) / v / m) / (2 * Math.PI);
  return branchCoefficients(m, f0, SINUS_Q, rate, out);
}
