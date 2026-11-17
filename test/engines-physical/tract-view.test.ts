/*
 * The mouth view (src/view/tract.ts): the geometry the engine runs, on the engine's targets, shows
 * what the phonemes are known to do to the tract.
 */

import { describe, expect, it } from 'vitest';
import { TractModel, phonemeTargets } from '../../src/view/tract';

function settled(ipa: string, body = 0) {
  const m = new TractModel(body);
  m.target(ipa);
  m.settle();
  return m.shape();
}

const minArea = (a: Float32Array, from: number, to: number) => Math.min(...Array.from(a.slice(from, to)));

describe('the tract view', () => {
  it('closes the lips for m and b, and opens the nose for m but not for b', () => {
    const vowel = settled('ɑ');
    const m = new TractModel(0);
    m.target('ɑ');
    m.settle();
    m.target('m');
    m.settle();
    const nasal = m.shape();
    expect(nasal.lipArea).toBeLessThan(0.1 * vowel.lipArea);
    expect(nasal.velumPort).toBeGreaterThan(0.1);
    m.target('b');
    m.settle();
    expect(m.shape().velumPort).toBeLessThan(nasal.velumPort);
  });

  it('narrows the front of the mouth for /i/ and the back for /ɑ/', () => {
    const i = settled('i');
    const a = settled('ɑ');
    const n = i.area.length;
    const back = [Math.round(0.15 * n), Math.round(0.45 * n)] as const;
    const front = [Math.round(0.6 * n), Math.round(0.9 * n)] as const;
    expect(minArea(i.area, ...front)).toBeLessThan(minArea(a.area, ...front));
    expect(minArea(a.area, ...back)).toBeLessThan(minArea(i.area, ...back));
  });

  it('moves gradually: a step of 10 ms goes part of the way, and the targets hold still once reached', () => {
    const m = new TractModel(0);
    m.target('ɑ');
    m.settle();
    const jaw0 = m.posture[0];
    m.target('i');
    m.step(0.01);
    const jaw1 = m.posture[0];
    m.step(0.5);
    const jaw2 = m.posture[0];
    expect(Math.abs(jaw1 - jaw0)).toBeGreaterThan(0);
    expect(Math.abs(jaw1 - jaw0)).toBeLessThan(Math.abs(jaw2 - jaw0));
    m.step(0.5);
    expect(m.posture[0]).toBeCloseTo(jaw2, 3);
  });

  it('knows every sound the voice has, and nothing else', () => {
    expect(phonemeTargets(0, 'ʉ')).toBeDefined();
    expect(phonemeTargets(0, 'x')).toBeUndefined();
    expect(new TractModel(1).target('nope')).toBe(false);
    // a smaller body is a smaller tract
    const male = settled('ə', 0);
    const child = settled('ə', 2);
    const len = (s: { upper: Float32Array }) => Math.hypot(s.upper[s.upper.length - 2] - s.upper[0], s.upper[s.upper.length - 1] - s.upper[1]);
    expect(len(child)).toBeLessThan(len(male));
  });
});

describe('TractModel: beats', () => {
  it('draws an ejective with its larynx raised and lips shut, and the hum with its velum down', async () => {
    const { TractModel } = await import('../../src/view/tract');
    const m = new TractModel(0);
    expect(m.target('beat:.')).toBe(true);
    m.settle();
    const restLarynx = m.posture[12];
    expect(m.target('beat:B>')).toBe(true);
    m.settle();
    expect(m.posture[12]).toBeGreaterThan(restLarynx + 1);
    expect(m.shape().lipArea).toBeLessThan(0.05);
    m.target('beat:m');
    m.settle();
    expect(m.shape().velumPort).toBeGreaterThan(0.1);
    expect(m.target('beat:nope')).toBe(false);
  });
});

describe('TractModel: handles and settings', () => {
  it('finds the settings that bring a dragged handle to the pointer, and shows the settings', async () => {
    const { TractModel } = await import('../../src/view/tract');
    const { mouthHandles, settingsForHandle } = await import('../../src/view/handles');
    const m = new TractModel(0);
    m.target('ɑ');
    m.settle();
    const before = mouthHandles(m);
    // the tongue a few millimetres up and forward: within the settings' reach, it lands under the pointer
    const tg: [number, number] = [before.tongue[0] + 0.3, before.tongue[1] + 0.25];
    const st = settingsForHandle(m, 'tongue', tg[0], tg[1], 'ɑ');
    expect(st.tongueFront!).toBeGreaterThan(0);
    expect(st.tongueHigh!).toBeGreaterThan(0);
    const got = mouthHandles(m).tongue;
    expect(Math.hypot(got[0] - tg[0], got[1] - tg[1])).toBeLessThan(0.08);
    // out of reach, the settings stop at their limits rather than tearing the mouth
    const far = settingsForHandle(m, 'tongue', before.tongue[0] + 3, before.tongue[1] + 3, 'ɑ');
    expect(far.tongueFront!).toBeGreaterThan(0.95);
    expect(far.tongueHigh!).toBeGreaterThan(0.95);
    const lar = settingsForHandle(m, 'larynx', before.larynx[0], before.larynx[1] - 0.5, 'ɑ');
    expect(lar.larynxSet!).toBeLessThan(0);
    // anatomy follows: a bigger head draws a longer tract
    const small = new TractModel(0);
    small.setSettings({ size: 0.85 });
    small.target('ɑ');
    small.settle();
    const big = new TractModel(0);
    big.setSettings({ size: 1.2 });
    big.target('ɑ');
    big.settle();
    const len = (s: { lower: Float32Array }) => s.lower[s.lower.length - 2] - s.lower[0];
    expect(len(big.shape())).toBeGreaterThan(len(small.shape()) * 1.3);
  });
});
