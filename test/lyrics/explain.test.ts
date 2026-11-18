import { describe, expect, it } from 'vitest';
import { describeShape, describeSound, nearestVowel } from '../../src/explain';
import { SHAPE_PRESETS, VOICE_SETTINGS } from '../../src/engines/vocal-settings';
import { VOCAL_PHONEMES } from '../../src/engines/vocal-phonemes';
import { VOCAL_BEATS } from '../../src/engines/vocal-beats';
import { vocalEngine } from '../../src/engines/vocal';

describe('the voice in plain words', () => {
  it('describes every sound the voice has, and every beat', () => {
    for (const p of VOCAL_PHONEMES) expect(describeSound(p), p).toBeTruthy();
    for (const b of VOCAL_BEATS) expect(describeSound('beat:' + b.id), b.id).toBeTruthy();
    expect(describeSound('ʃ')).toContain('ship');
    expect(describeSound('ʃ')).toContain('only air');
    expect(describeSound('qq')).toBeUndefined();
  });

  it('names the vowel a pair of resonances sounds like, for each kind of voice', () => {
    expect(nearestVowel(768, 1333, 0).word).toBe('hod');
    expect(nearestVowel(437, 2761, 1).word).toBe('heed');
    expect(nearestVowel(494, 1345, 2).word).toBe("who'd");
  });

  it('says a mouth shape in a sentence, with neutral values left out', () => {
    expect(describeShape({})).toBe('A neutral mouth.');
    expect(describeShape({ size: 1, jawSet: 0 })).toBe('A neutral mouth.');
    expect(describeShape({ tongueFront: 1, larynxSet: -0.7, size: 1.22 })).toBe('Head much bigger, tongue pushed far forward, voice box very lowered.');
  });

  it('has a setting for every engine param it names, and presets that use only those', () => {
    const params = new Set(vocalEngine.params.map((p) => p.name));
    for (const s of VOICE_SETTINGS) {
      expect(params.has(s.param), s.param).toBe(true);
      const spec = vocalEngine.params.find((p) => p.name === s.param)!;
      expect([spec.min, spec.max]).toEqual([s.min, s.max]);
      expect(spec.default).toBe(s.neutral ?? 0);
    }
    const names = new Set(VOICE_SETTINGS.map((s) => s.param));
    for (const p of SHAPE_PRESETS) for (const k of Object.keys(p.values)) expect(names.has(k), `${p.id}.${k}`).toBe(true);
  });
});

describe('the helpers on glides and toggles', () => {
  it('describes vowel glides and long vowels, and says strong settings in plain words', async () => {
    const { describeSound, describeShape } = await import('../../src/explain');
    expect(describeSound('aɪ')).toMatch(/^A gliding vowel: it starts wide open .* As in "high"\.$/);
    expect(describeSound('əʊ')).toContain('gliding');
    expect(describeSound('iː')).toContain('"heed"');
    expect(describeSound('ɾ')).toContain("It is the t in American 'water'.");
    expect(describeShape({ piriform: 1, nasal: 1, lipOpen: -1 })).toBe('Throat pockets on, lips almost shut, voice right through the nose.');
  });
});
