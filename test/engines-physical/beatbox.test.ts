/*
 * The beatbox sounds made with the airstreams beatboxers use (engines/vocal-beats.ts): an ejective
 * builds its pressure with the glottis shut and no breath from the lungs, an inward snare draws the
 * mouth below the atmosphere, a hum voices at its note, and the close microphone hears the kick's air.
 * An ejective's pressure comes from the larynx alone and runs above a pulmonic stop's (Ladefoged and
 * Maddieson 1996, The Sounds of the World's Languages, ch. 3); the bounds here are this voice's gates.
 */
import { describe, expect, it } from 'vitest';
import { rng } from 'bellowsjs';
import { vocalEngine } from '../../src/engines/vocal';
import { vocalBeatIndex } from '../../src/engines/vocal-beats';
import { CM_H2O } from '../../src/dsp/air';
import { bandEnergy, defaultParams, estimateFreq, magSpectrum, rms } from './helpers';

const SR = 48000;
const HIT = 0.25;

interface Probe {
  out: Float32Array;
  pSupraMax: number;
  pSupraMin: number;
  /** The most lung pressure in either direction, cmH2O, over the sound. */
  pLungMax: number;
  pLungMin: number;
  lipsSealedWithPressure: boolean;
}

function probe(id: string, params: Record<string, number> = {}, hz = 100): Probe {
  const v = vocalEngine.createVoice(SR, { ...defaultParams(vocalEngine), ...params }, rng('beatbox')) as unknown as {
    setParam(n: string, x: number): void;
    noteOn(hz: number, vel: number): void;
    process(l: Float32Array, r: Float32Array, a: number, b: number): void;
    air: { pSupra: number; pLung: number; nG: number; gridIn: Float64Array; closure: number };
  };
  const idx = vocalBeatIndex(id);
  v.setParam('phoneme', vocalBeatIndex('.'));
  v.noteOn(hz, 0.8);
  v.setParam('nextIn', HIT);
  v.setParam('nextPhoneme', idx);
  const n = Math.round(0.6 * SR);
  const out = new Float32Array(n);
  const r = new Float32Array(n);
  const res: Probe = { out, pSupraMax: 0, pSupraMin: 0, pLungMax: 0, pLungMin: 0, lipsSealedWithPressure: false };
  let posted = false;
  for (let i = 0; i < n; i += 32) {
    if (!posted && i >= HIT * SR) {
      v.setParam('phoneme', idx);
      posted = true;
    }
    v.process(out, r, i, i + 32);
    const a = v.air;
    const ps = a.pSupra / CM_H2O;
    res.pSupraMax = Math.max(res.pSupraMax, ps);
    res.pSupraMin = Math.min(res.pSupraMin, ps);
    res.pLungMax = Math.max(res.pLungMax, a.pLung / CM_H2O);
    res.pLungMin = Math.min(res.pLungMin, a.pLung / CM_H2O);
    if (a.gridIn[a.nG - 1] < 1e-4 && ps > 10 && a.closure > 0.9) res.lipsSealedWithPressure = true;
  }
  return res;
}

describe('beatbox airstreams', () => {
  it('kick: a bilabial ejective, the glottis shut and the lungs idle while the larynx compresses the mouth', () => {
    const k = probe('B');
    expect(k.lipsSealedWithPressure).toBe(true);
    expect(k.pSupraMax).toBeGreaterThan(12);
    expect(k.pSupraMax).toBeLessThan(35);
    expect(k.pLungMax).toBeLessThan(0.5);
  });

  it('rimshot: a velar ejective, more pressure from the smaller cavity behind the tongue', () => {
    const k = probe('K');
    expect(k.pSupraMax).toBeGreaterThan(12);
    expect(k.pLungMax).toBeLessThan(0.5);
  });

  it('inward snare: the breath drawn in, the mouth below the atmosphere', () => {
    const k = probe('^K');
    expect(k.pLungMin).toBeLessThan(-8);
    expect(k.pSupraMin).toBeLessThan(-5);
  });

  it('snare and hat: pulmonic, breath from the lungs only around the sound', () => {
    for (const id of ['Pf', 't']) {
      const k = probe(id);
      expect(k.pLungMax).toBeGreaterThan(8);
      // breath-held before the sound
      expect(rms(k.out, 0, Math.round(0.1 * SR))).toBeLessThan(1e-4);
    }
  });

  it('hum: voiced at its note through the nose', () => {
    const k = probe('m', {}, 98);
    const f = estimateFreq(k.out, SR, Math.round(0.4 * SR), Math.round(0.5 * SR), 98);
    expect(Math.abs(1200 * Math.log2(f.freq / 98))).toBeLessThan(40);
  });

  it('the close microphone adds the kick air below 300 Hz', () => {
    const far = probe('B', { mic: 0 });
    const near = probe('B', { mic: 1 });
    const from = Math.round((HIT - 0.03) * SR);
    const size = 4096;
    const lowFar = bandEnergy(magSpectrum(far.out, from, size), SR, size, 20, 300);
    const lowNear = bandEnergy(magSpectrum(near.out, from, size), SR, size, 20, 300);
    expect(10 * Math.log10(lowNear / lowFar)).toBeGreaterThan(10);
  });
});

describe('a kick straight after a hum', () => {
  it('still builds its pressure: the hum hands the velum back in time (a quarter-second step)', () => {
    const SR2 = 48000;
    const kickPressure = (prev: string) => {
      const v = vocalEngine.createVoice(SR2, { ...defaultParams(vocalEngine) }, rng('hk')) as unknown as {
        setParam(k: string, x: number): void; noteOn(f: number, v: number): void; process(l: Float32Array, r: Float32Array, a: number, b: number): void;
        air: { pSupra: number };
      };
      const steps: [string, number][] = [['.', 0], [prev, 0.25], ['B', 0.5]];
      v.setParam('phoneme', vocalBeatIndex('.'));
      v.noteOn(98, 0.8);
      let next = 1;
      const ann = (i: number) => {
        if (!steps[next]) return;
        v.setParam('nextIn', Math.max(0, steps[next][1] - i / SR2));
        v.setParam('nextPhoneme', vocalBeatIndex(steps[next][0]));
      };
      ann(0);
      const n = Math.round(0.56 * SR2);
      const l = new Float32Array(n);
      const r = new Float32Array(n);
      let ps = 0;
      for (let i = 0; i < n; i += 32) {
        if (next < steps.length && i >= steps[next][1] * SR2) {
          v.setParam('phoneme', vocalBeatIndex(steps[next][0]));
          next++;
          ann(i);
        }
        v.process(l, r, i, i + 32);
        if (i > 0.44 * SR2 && i < 0.51 * SR2) ps = Math.max(ps, v.air.pSupra / CM_H2O);
      }
      return ps;
    };
    // MEASURED: after a rest 19.9 cmH2O; after a hum 0.5 before the fix (the piston ran with the
    // velum still open), 13.8 after. Steps under about 0.2 s still leak: the velum needs ~60 ms to shut
    expect(kickPressure('.')).toBeGreaterThan(15);
    expect(kickPressure('m')).toBeGreaterThan(10);
  });
});

describe('the close microphone moved mid-note', () => {
  it('changes a level, not a step: after the change the output is the held setting\'s', () => {
    const run = (switchAt: number) => {
      const v = vocalEngine.createVoice(48000, { ...defaultParams(vocalEngine), mic: switchAt === 0 ? 0.3 : 0, vibratoDepth: 0, drift: 0 }, rng('mic')) as unknown as {
        setParam(k: string, x: number): void; noteOn(f: number, v: number): void; process(l: Float32Array, r: Float32Array, a: number, b: number): void;
      };
      v.noteOn(110, 0.8);
      const n = 24000;
      const l = new Float32Array(n);
      const r = new Float32Array(n);
      for (let i = 0; i < n; i += 128) {
        if (switchAt > 0 && i === switchAt) v.setParam('mic', 0.3);
        v.process(l, r, i, i + 128);
      }
      return l;
    };
    const held = run(0);
    const moved = run(12032);
    const off = run(-1);
    // the step a switch makes: the moved run against the two it moves between, sample to sample
    let jump = 0;
    let peak = 0;
    let late = 0;
    for (let i = 12032; i < held.length; i++) {
      const lo = Math.min(held[i], off[i]);
      const hi = Math.max(held[i], off[i]);
      jump = Math.max(jump, moved[i] < lo ? lo - moved[i] : moved[i] > hi ? moved[i] - hi : 0);
      peak = Math.max(peak, Math.abs(held[i]));
      if (i > 12032 + 2400) late = Math.max(late, Math.abs(held[i] - moved[i]));
    }
    // MEASURED before the fix: the switch departed by 0.235, more than the far field's whole peak.
    // Now the level glides over 5 ms between the two settings and lands on the held one
    expect(jump).toBeLessThan(0.05 * peak);
    expect(late).toBeLessThan(0.01 * peak);
  });
});
