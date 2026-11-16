/*
 * The voice against human norms (docs/VOICE-NORMS.md). The default source must measure as a healthy
 * voice: local jitter and shimmer under the MDVP screening limits (1.04 and 3.81 percent) on every
 * body at its norm speaking pitch. And every body's General American vowels must stay near
 * Hillenbrand et al. (1995): F1 and F2 within 6 percent RMS of the men's, women's and children's
 * means. Formants are measured at 100 Hz, where LPC reads the tract and not the harmonics (at 200 Hz
 * and above it locks onto harmonics: MEASURED, a female /i/ read 866 Hz for F2).
 */

import { describe, expect, it } from 'vitest';
import { rng, estimateFormants } from 'bellowsjs';
import { vocalEngine } from '../../src/engines/vocal';
import { vocalPhonemeIndex } from '../../src/engines/vocal-phonemes';
import { SPEECH_HZ_BY_BODY } from '../../src/voices';

const SR = 48000;

function held(ipa: string, body: number, f0: number, seconds: number, over: Record<string, number> = {}): Float32Array {
  const params: Record<string, number> = {};
  for (const p of vocalEngine.params) params[p.name] = p.default;
  Object.assign(params, { body, vibratoDepth: 0, drift: 0 }, over);
  const v = vocalEngine.createVoice(SR, params, rng('norms-' + ipa + body));
  for (const [k, val] of Object.entries(params)) v.setParam(k, val);
  v.setParam('phoneme', vocalPhonemeIndex(ipa));
  v.noteOn(f0, 0.8);
  const n = Math.round(seconds * SR);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  for (let i = 0; i < n; i += 128) v.process(l, r, i, Math.min(n, i + 128));
  return l;
}

/** Local jitter and shimmer, percent: cycles found at upward zero crossings of the low-passed fundamental. */
function perturbation(x: Float32Array, f0: number): { jitter: number; shimmer: number } {
  const a = Math.exp((-2 * Math.PI * 1.25 * f0) / SR);
  const y = Float32Array.from(x);
  for (let pass = 0; pass < 6; pass++) {
    let s = 0;
    for (let i = 0; i < y.length; i++) {
      s = a * s + (1 - a) * y[i];
      y[i] = s;
    }
  }
  let dc = 0;
  const from = Math.round(0.8 * SR);
  const to = y.length - Math.round(0.1 * SR);
  for (let i = from; i < to; i++) dc += y[i];
  dc /= to - from;
  const zc: number[] = [];
  for (let i = from; i < to; i++) if (y[i - 1] - dc < 0 && y[i] - dc >= 0) zc.push(i - 1 + -(y[i - 1] - dc) / (y[i] - y[i - 1]));
  const T: number[] = [];
  const A: number[] = [];
  for (let k = 1; k < zc.length; k++) {
    T.push(zc[k] - zc[k - 1]);
    let pk = 0;
    for (let i = Math.floor(zc[k - 1]); i < zc[k]; i++) pk = Math.max(pk, Math.abs(x[i]));
    A.push(pk);
  }
  const mean = (v: number[]) => v.reduce((p, c) => p + c, 0) / v.length;
  let dj = 0;
  let ds = 0;
  for (let k = 1; k < T.length; k++) {
    dj += Math.abs(T[k] - T[k - 1]);
    ds += Math.abs(A[k] - A[k - 1]);
  }
  return { jitter: (100 * dj) / (T.length - 1) / mean(T), shimmer: (100 * ds) / (A.length - 1) / mean(A) };
}

/* Hillenbrand et al. (1995) steady-state F1, F2: men, women, children. */
const HILLENBRAND: Record<string, [[number, number], [number, number], [number, number]]> = {
  i: [[342, 2322], [437, 2761], [452, 3081]],
  ɪ: [[427, 2034], [483, 2365], [511, 2552]],
  ɛ: [[580, 1799], [731, 2058], [749, 2267]],
  æ: [[588, 1952], [669, 2349], [717, 2501]],
  ɑ: [[768, 1333], [936, 1551], [1002, 1688]],
  ɔ: [[652, 997], [781, 1136], [803, 1210]],
  ʊ: [[469, 1122], [519, 1225], [568, 1490]],
  u: [[378, 997], [459, 1105], [494, 1345]],
  ʌ: [[623, 1200], [753, 1426], [749, 1546]],
  ɝ: [[474, 1379], [523, 1588], [586, 1719]],
};

describe('the voice against human norms', () => {
  for (const body of [0, 1, 2]) {
    it(`body ${body}: a healthy source at its norm speaking pitch, jitter and shimmer under the MDVP limits`, () => {
      const f0 = SPEECH_HZ_BY_BODY[body];
      const { jitter, shimmer } = perturbation(held('ɑ', body, f0, 3), f0);
      expect(jitter).toBeLessThan(1.04);
      expect(shimmer).toBeLessThan(3.81);
      // and not a synthetic, perfectly steady source either
      expect(jitter).toBeGreaterThan(0.2);
    });

    it(`body ${body}: General American vowels within 6 percent RMS of Hillenbrand in F1 and F2`, () => {
      let s1 = 0;
      let s2 = 0;
      let n = 0;
      for (const [v, ref] of Object.entries(HILLENBRAND)) {
        const x = held(v, body, 100, 1, { roughness: 0 });
        const f1: number[] = [];
        const f2: number[] = [];
        for (let t = 0.45; t <= 0.9; t += 0.05) {
          const fm = estimateFormants(x, SR, Math.round(t * SR)).filter((f) => f.f > 200 && f.bw < 600);
          if (fm.length >= 2) {
            f1.push(fm[0].f);
            f2.push(fm[1].f);
          }
        }
        const med = (a: number[]) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];
        const [h1, h2] = ref[body];
        s1 += (med(f1) / h1 - 1) ** 2;
        s2 += (med(f2) / h2 - 1) ** 2;
        n++;
      }
      // MEASURED after calibration (scripts/gen-calibrated-vowels.mjs): F1 4.4 to 4.6, F2 2.3 to 3.6 percent
      expect(Math.sqrt(s1 / n)).toBeLessThan(0.06);
      expect(Math.sqrt(s2 / n)).toBeLessThan(0.06);
    });
  }
});
