/*
 * The anatomy added on 2026-11-17 (docs/HOW-IT-WORKS.md, section 11), each gated on the measurement it
 * was tuned by: the piriform fossae's dip at 4 to 6 kHz (Dang and Honda 1997 put it at 4 to 5), the
 * maxillary sinus's on a nasal (Dang and Honda 1996: 310 to 950 Hz), the breath in between phrases,
 * the voice bar a voiced stop keeps (Westbury 1983) and relaxed cheeks lengthen (Ishizaka et al.
 * 1975), and every voice setting moving the formants the way acoustic theory says it should.
 */
import { describe, expect, it } from 'vitest';
import { rng } from 'bellowsjs';
import { vocalEngine } from '../../src/engines/vocal';
import { vocalPhonemeIndex } from '../../src/engines/vocal-phonemes';
import { vocalBeatIndex } from '../../src/engines/vocal-beats';
import { CM_H2O } from '../../src/dsp/air';
import { lyricsToSyllables } from '../../src/lyrics/read';
import { speechPlan } from '../../src/lyrics/speech';
import { defaultParams, lpcFormants, magSpectrum } from './helpers';

const SR = 48000;
type V = {
  setParam(n: string, x: number): void;
  noteOn(h: number, v: number): void;
  process(l: Float32Array, r: Float32Array, a: number, b: number): void;
  air: { branches: boolean; pLung: number; nG: number; gridIn: Float64Array };
};
const idx = (s: string) => (s.startsWith('beat:') ? vocalBeatIndex(s.slice(5).replace('>', ''), s.endsWith('>')) : vocalPhonemeIndex(s));

/** A line of sounds at their start times (s), the engine driven directly; the lowest lung pressure and the smallest lip area. */
function voice(steps: [string, number][], params: Record<string, number> = {}, secs = 1, branches = true, hz = 100) {
  const v = vocalEngine.createVoice(SR, { ...defaultParams(vocalEngine), vibratoDepth: 0, drift: 0, ...params }, rng('anatomy')) as unknown as V;
  for (const [k, x] of Object.entries(params)) v.setParam(k, x);
  v.air.branches = branches;
  v.setParam('phoneme', idx(steps[0][0]));
  v.noteOn(hz, 0.8);
  const n = Math.round(secs * SR);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  let next = 1;
  const announce = (i: number) => {
    if (!steps[next]) return;
    v.setParam('nextIn', steps[next][1] - i / SR);
    v.setParam('nextPhoneme', idx(steps[next][0]));
  };
  announce(0);
  let pl = 0;
  let lips = Infinity;
  let peak = 0;
  let low = 0;
  for (let i = 0; i < n; i += 32) {
    if (next < steps.length && i >= steps[next][1] * SR) {
      v.setParam('phoneme', idx(steps[next][0]));
      next++;
      announce(i);
    }
    v.process(l, r, i, Math.min(n, i + 32));
    pl = Math.min(pl, v.air.pLung / CM_H2O);
    lips = Math.min(lips, v.air.gridIn[v.air.nG - 1]);
    const ps = (v.air as unknown as { pSupra: number }).pSupra / CM_H2O;
    peak = Math.max(peak, ps);
    if (lips > 0 && i > 0.3 * SR) low = Math.min(low, ps);
  }
  return { l, pl, lips, peak, low };
}

function avgSpec(x: Float32Array, from: number, size = 8192): Float64Array {
  const acc = new Float64Array(size / 2);
  let c = 0;
  for (let s = from; s + size <= x.length; s += size / 2) {
    const m = magSpectrum(x, s, size);
    for (let i = 0; i < acc.length; i++) acc[i] += m[i] * m[i];
    c++;
  }
  return acc.map((p) => p / c);
}
/** Mean of the on/off level ratio, dB, over bands `step` Hz wide from f0 to f1. */
function meanRatio(on: Float64Array, off: Float64Array, f0: number, f1: number, step: number, size = 8192): number {
  let sum = 0;
  let n = 0;
  for (let f = f0; f < f1; f += step) {
    let a = 0;
    let b = 0;
    for (let i = Math.round((f * size) / SR); i < Math.round(((f + step) * size) / SR); i++) {
      a += on[i];
      b += off[i];
    }
    sum += 10 * Math.log10(a / b);
    n++;
  }
  return sum / n;
}
const formants = (ipa: string, params: Record<string, number> = {}) => show(ipa, params, lpcFormants(voice([[ipa, 0]], params, 1.0).l, SR, Math.round(0.8 * SR)).slice(0, 3).map((x) => x.f));
const show = (ipa: string, p: Record<string, number>, f: number[]) => {
  if (process.env.SHOW) console.log('F', ipa, JSON.stringify(p), f.map(Math.round));
  return f;
};
/** The 0 to 400 Hz level, dB, over [a, b) seconds. */
function lowDb(x: Float32Array, a: number, b: number): number {
  const c = Math.exp((-2 * Math.PI * 400) / SR);
  let y = 0;
  let e = 0;
  for (let i = 0; i < Math.round(b * SR); i++) {
    y = (1 - c) * x[i] + c * y;
    if (i >= Math.round(a * SR)) e += y * y;
  }
  return 10 * Math.log10(e / ((b - a) * SR) + 1e-20);
}

describe('side branches', () => {
  it('the piriform fossae take 3 dB or more out of 4 to 6 kHz and leave the low formants within 3 dB', () => {
    const on = avgSpec(voice([['ɑ', 0]], { piriform: 1 }, 1.2).l, 0.3 * SR);
    const off = avgSpec(voice([['ɑ', 0]], { piriform: 1 }, 1.2, false).l, 0.3 * SR);
    expect(meanRatio(on, off, 4000, 6000, 250)).toBeLessThan(-3);
    expect(Math.abs(meanRatio(on, off, 250, 1250, 250))).toBeLessThan(3);
  });

  it('the maxillary sinuses take 2.5 dB or more out of a nasal between 400 and 1100 Hz', () => {
    const on = avgSpec(voice([['m', 0]], {}, 1.2).l, 0.3 * SR);
    const off = avgSpec(voice([['m', 0]], {}, 1.2, false).l, 0.3 * SR);
    expect(meanRatio(on, off, 400, 1200, 100)).toBeLessThan(-2.5);
  });
});

describe('breathing and voicing', () => {
  it('breathes in between phrases: air drawn in, a quiet noise, no breath before the first phrase unless asked', () => {
    const plan = speechPlan(lyricsToSyllables('hot day, cold night'));
    const ins = plan.syllables.flatMap((s) => s.onset).filter((o) => o.ipa.startsWith('beat:in'));
    expect(ins).toHaveLength(1);
    expect(speechPlan(lyricsToSyllables('hot day, cold night'), { breath: 'all' }).syllables.flatMap((s) => s.onset).filter((o) => o.ipa.startsWith('beat:in'))).toHaveLength(2);
    expect(speechPlan(lyricsToSyllables('hot day, cold night'), { breath: 'none' }).syllables.flatMap((s) => s.onset).filter((o) => o.ipa.startsWith('beat:in'))).toHaveLength(0);
    const br = voice([['_', 0], ['beat:in>', 0.1], ['_', 0.45], ['ɑ', 0.52]], {}, 0.9, true, 110);
    expect(br.pl).toBeLessThan(-3);
    const rms = (a: number, b: number) => {
      let e = 0;
      for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) e += br.l[i] * br.l[i];
      return Math.sqrt(e / ((b - a) * SR));
    };
    const level = 20 * Math.log10(rms(0.2, 0.4) / rms(0.65, 0.85));
    expect(level).toBeGreaterThan(-45);
    expect(level).toBeLessThan(-20);
  });

  it('releases /ɹdj/ ("Harvard Yard") without a click: no suction behind the closure', () => {
    // a tongue moving toward /j/ during the /d/ grows the cavity; with the glottis sealed by voicing the
    // mouth fell to -9.7 cmH2O and the release popped inward (75 times the line's median sharpness)
    const { l, low } = voice([['ɑ', 0], ['ɹ', 0.25], ['d', 0.3], ['j', 0.36], ['ɑ', 0.42]], {}, 0.8, true, 199);
    expect(low).toBeGreaterThan(-5);
    const W = 96;
    const d: number[] = [];
    for (let i = W; i + W < l.length; i += W) {
      let m = 0;
      for (let j = i; j < i + W; j++) m = Math.max(m, Math.abs(l[j] - 2 * l[j - 1] + l[j - 2]));
      d.push(m);
    }
    const sorted = d.slice().sort((a, b) => a - b);
    expect(Math.max(...d) / sorted[sorted.length >> 1]).toBeLessThan(8);
  });

  it('keeps voicing through a voiced closure, and slack cheeks keep more of it', () => {
    const closure = (c: string, cheeks = 0, from = 0.52, to = 0.56) => {
      const { l } = voice([['ɑ', 0], [c, 0.45], ['ɑ', 0.58]], { cheeks }, 0.9, true, 110);
      return lowDb(l, from, to) - lowDb(l, 0.3, 0.4);
    };
    // MEASURED late in a 130 ms closure: /b/ 11.7 dB over /p/ (the slight glottal opening that keeps the
    // cavity from suction lets voicing fade, as English /b d g/ do), slack cheeks 16 dB more
    const b = closure('b');
    expect(b - closure('p')).toBeGreaterThan(8);
    expect(closure('b', 1) - b).toBeGreaterThan(6);
  });
});

describe('voice settings move the formants as acoustic theory says', () => {
  const pct = (a: number, b: number) => (100 * (b - a)) / a;
  it('rounded lips lower F1 and F2; a raised larynx raises the formants, a lowered one lowers them', () => {
    const e = formants('ɛ');
    const round = formants('ɛ', { lipRound: 1 });
    // MEASURED: F1 -9, F2 -3.6, F3 -1.2 percent (LPC's F3 is the least steady, so it is not gated)
    expect(pct(e[0], round[0])).toBeLessThan(-4);
    expect(pct(e[1], round[1])).toBeLessThan(-2.5);
    const s = formants('ə');
    const mean = (f: number[]) => (f[0] + f[1] + f[2]) / 3;
    expect(pct(mean(s), mean(formants('ə', { larynxSet: 1 })))).toBeGreaterThan(3);
    expect(pct(mean(s), mean(formants('ə', { larynxSet: -1 })))).toBeLessThan(-3);
  });

  it('a bigger or smaller head scales F1 and F2 as 1 / size, within 7 percent', () => {
    const s = formants('ə');
    for (const size of [1.2, 0.85]) {
      const f = formants('ə', { size });
      for (const i of [0, 1]) expect(Math.abs(f[i] / s[i] - 1 / size) / (1 / size)).toBeLessThan(0.07);
    }
  });

  it('the tongue forward raises F2, back lowers it; the jaw open raises F1; the tongue high lowers it; a longer throat lowers F1 and F3', () => {
    const s = formants('ə');
    expect(pct(s[1], formants('ə', { tongueFront: 1 })[1])).toBeGreaterThan(8);
    expect(pct(s[1], formants('ə', { tongueFront: -1 })[1])).toBeLessThan(-8);
    expect(pct(s[0], formants('ə', { jawSet: 1 })[0])).toBeGreaterThan(5);
    expect(pct(s[0], formants('ə', { tongueHigh: 1 })[0])).toBeLessThan(-4);
    const ph = formants('ə', { pharynx: 1.2 });
    // MEASURED: F1 -3.8, F3 -13 percent at 1.2
    expect(pct(s[0], ph[0])).toBeLessThan(-3);
    expect(pct(s[2], ph[2])).toBeLessThan(-4);
  });

  it('gives way to a consonant: spread, open lips and an open jaw still close for /b/', () => {
    const { lips } = voice([['ɑ', 0], ['b', 0.45], ['ɑ', 0.58]], { lipRound: -1, lipOpen: 1, jawSet: 1 }, 0.8, true, 110);
    expect(lips).toBeLessThan(1e-3);
  });

  it('keeps an oral consonant\'s pressure with the nasal setting: the velum closes for it', () => {
    for (const c of ['p', 'b', 's']) {
      const plain = voice([['ɑ', 0], [c, 0.45], ['ɑ', 0.6]], {}, 0.8, true, 110).peak;
      const nasal = voice([['ɑ', 0], [c, 0.45], ['ɑ', 0.6]], { nasal: 1 }, 0.8, true, 110).peak;
      expect(nasal / plain, c).toBeGreaterThan(0.7);
    }
  });
});

describe('the lungs\' end (two rates, off by default until the noise gains are refitted)', () => {
  it('keeps the subglottal pressure up under a high flow: /h/ near the lungs\' pressure, not starved', () => {
    const psub = (two: boolean) => {
      const v = vocalEngine.createVoice(SR, { ...defaultParams(vocalEngine), vibratoDepth: 0, drift: 0 }, rng('lungs')) as unknown as V & {
        air: { lungTwoRate: boolean; pSubSmooth: number };
      };
      v.air.lungTwoRate = two;
      v.setParam('phoneme', idx('h'));
      v.noteOn(110, 0.8);
      const n = SR;
      const l = new Float32Array(n);
      const r = new Float32Array(n);
      let ps = 0;
      let c = 0;
      for (let i = 0; i < n; i += 128) {
        v.process(l, r, i, i + 128);
        if (i > 0.4 * n) {
          ps += v.air.pSubSmooth / CM_H2O;
          c++;
        }
      }
      return ps / c;
    };
    // MEASURED: 2.77 cmH2O with CHIMERA's single resistor, 7.59 with the two-rate end (lungs at 9)
    expect(psub(false)).toBeLessThan(4);
    expect(psub(true)).toBeGreaterThan(6.5);
  });
});

describe('the piriform branch and the velum junction', () => {
  it('keeps the pressure behind a closure when the velum junction moves onto the branch\'s junction (22050 Hz)', async () => {
    const { JunctionAirway } = await import('../../src/dsp/junction-airway');
    const run = (split: number, piriform: number) => {
      const rate = 22050;
      const n = 16;
      const a = new JunctionAirway(rate, n, rng('leak')) as unknown as Record<string, any>;
      a.configure(1, n, 8);
      a.piriform = piriform;
      a.gridIn.fill(3);
      a.gridMin.fill(3);
      a.vflow.fill(0);
      Object.assign(a, { ductLen: 2, ductArea: 3, velum: 0, pLung: 8 * CM_H2O, agStatic: 0.3, f0: 110, teethX: n - 2, splitI: split, gain: 1 });
      const blocks = Math.round((0.6 * rate) / a.block);
      const out = new Float32Array(blocks * a.block);
      const r = new Float32Array(out.length);
      const env = new Float32Array(a.block).fill(1);
      let ps = 0;
      let c = 0;
      for (let b = 0; b < blocks; b++) {
        if (b === Math.round(blocks / 3)) {
          a.gridIn[5] = 1e-6;
          a.gridMin[5] = 1e-6;
        }
        a.beginBlock();
        a.render(out, r, b * a.block, a.block, 0, env);
        if (b > blocks * 0.8) {
          ps += a.pSupra / CM_H2O;
          c++;
        }
      }
      return ps / c;
    };
    // MEASURED before the fix: 8.00 off, 6.91 on (the branch a bare leak while jv sat on it)
    expect(Math.abs(run(3.5, 1) - run(3.5, 0))).toBeLessThan(0.1);
    expect(Math.abs(run(8.5, 1) - run(8.5, 0))).toBeLessThan(0.1);
  });
});
