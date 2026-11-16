/*
 * Starter voices (src/voices.ts): every param one the engine has and inside its range, each
 * speaking pitch inside the published range for its group, and singer() taking a preset.
 */

import { describe, expect, it } from 'vitest';
import { Bellows } from 'bellowsjs';
import { VOICE_PRESETS, SPEECH_HZ_BY_BODY, speechHzForBody, voicePreset } from '../../src/voices';
import { VOCAL_ENGINE_INFO, voice } from '../../src/plugin';
import { singer } from '../../src/singer';
import { FakeAudioContext, installFakeAudio } from './fake-context';

/* Baken (1987) typical speaking ranges, Hz: men 85 to 155, women 165 to 255, a child of ten 208 to 259. */
const SPEAKING: Record<string, [number, number]> = { male: [85, 155], female: [165, 255], child: [208, 259] };

describe('starter voices', () => {
  it('set only params the engine has, inside their ranges', () => {
    const specs = new Map(VOCAL_ENGINE_INFO.params.map((p) => [p.name, p]));
    for (const v of VOICE_PRESETS) {
      for (const [name, value] of Object.entries(v.params)) {
        const spec = specs.get(name);
        expect(spec, `${v.id}.${name}`).toBeDefined();
        expect(value, `${v.id}.${name}`).toBeGreaterThanOrEqual(spec!.min);
        expect(value, `${v.id}.${name}`).toBeLessThanOrEqual(spec!.max);
      }
    }
  });

  it('speak inside the published range for their group, and sing a range of at least an octave and a half', () => {
    for (const v of VOICE_PRESETS) {
      const [lo, hi] = SPEAKING[v.group];
      expect(v.speechHz, v.id).toBeGreaterThanOrEqual(lo);
      expect(v.speechHz, v.id).toBeLessThanOrEqual(hi);
      expect(v.range[1] - v.range[0], v.id).toBeGreaterThanOrEqual(18);
    }
    expect(new Set(VOICE_PRESETS.map((v) => v.id)).size).toBe(VOICE_PRESETS.length);
  });

  it('match each body to its group: male near 0, female near 1, child 2', () => {
    for (const v of VOICE_PRESETS) {
      const body = v.params.body ?? 0;
      if (v.group === 'male') expect(body, v.id).toBeLessThanOrEqual(0.3);
      if (v.group === 'female') expect(body, v.id).toBeGreaterThanOrEqual(0.7);
      if (v.group === 'child') expect(body, v.id).toBe(2);
    }
  });

  it('give speak() the norm for a body when no preset says otherwise', () => {
    expect(speechHzForBody(0)).toBe(SPEECH_HZ_BY_BODY[0]);
    expect(speechHzForBody(1)).toBe(SPEECH_HZ_BY_BODY[1]);
    expect(speechHzForBody(2)).toBe(SPEECH_HZ_BY_BODY[2]);
    expect(speechHzForBody(0.5)).toBeCloseTo((115 + 199) / 2, 9);
  });

  it('make singers by id, and refuse an id that is not one', async () => {
    installFakeAudio();
    const b = await Bellows.boot({ seed: 'voices', workletUrl: 'fake://worklet', context: new FakeAudioContext() as unknown as AudioContext, plugins: [voice] });
    const s = singer(b, 'soprano');
    expect(s.preset).toBe(voicePreset('soprano'));
    expect(s.speechHz).toBe(215);
    expect(singer(b, { body: 1 }).speechHz).toBe(199);
    expect(singer(b, 'child', { speechHz: 250 }).speechHz).toBe(250);
    expect(() => singer(b, 'castrato')).toThrow(/VOICE_PRESETS/);
    b.dispose();
  });
});
