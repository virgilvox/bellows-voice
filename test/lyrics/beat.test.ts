import { describe, expect, it } from 'vitest';
import { BEAT_LEAD_IN, BEAT_PRESETS, beatLine, beatStepSeconds, formatBeat, parseBeat } from '../../src/lyrics/beat';
import { VOCAL_BEATS, beatTokenIndex, vocalBeatIndex, vocalIsBeat, VOCAL_BEAT_BASE } from '../../src/engines/vocal-beats';
import { VOCAL_PHONEMES } from '../../src/engines/vocal-phonemes';
import { planSung } from '../../src/lyrics/sing';
import { sungEvents } from '../../src/sing';
import { EventKind } from 'bellowsjs';

describe('beat patterns', () => {
  it('parse tokens, rests, bar lines, hum notes and accents, and format back', () => {
    const steps = parseBeat('B . t . | Pf> - m:43 kch');
    expect(steps).toEqual([{ id: 'B' }, null, { id: 't' }, null, { id: 'Pf', accent: true }, null, { id: 'm', note: 43 }, { id: 'kch' }]);
    expect(formatBeat(steps)).toBe('B . t . | Pf> . m:43 kch');
    expect(parseBeat(formatBeat(steps))).toEqual(steps);
  });

  it('reads an unknown token as a rest, so a typo keeps the time, and matches case loosely', () => {
    expect(parseBeat('B zz pf')).toEqual([{ id: 'B' }, null, { id: 'Pf' }]);
  });

  it('read every preset with no unknown sound', () => {
    for (const p of BEAT_PRESETS) {
      const tokens = p.text.split(/[\s|]+/).filter((t) => t !== '');
      const steps = parseBeat(p.text);
      expect(steps).toHaveLength(tokens.length);
      tokens.forEach((t, i) => expect(steps[i] === null).toBe(t === '.'));
    }
  });

  it('times sixteenths at the tempo, swings the off-beats and keeps the bar length', () => {
    const step = beatStepSeconds(120);
    expect(step).toBeCloseTo(0.125, 12);
    const line = beatLine('B t B t', { bpm: 120, swing: 0.4, repeat: 2 });
    expect(line.durs).toHaveLength(9);
    expect(line.durs[0]).toBe(BEAT_LEAD_IN);
    expect(line.durs[1]).toBeCloseTo(step + 0.2 * step, 12);
    expect(line.durs[2]).toBeCloseTo(step - 0.2 * step, 12);
    expect(line.durs.slice(1).reduce((a, b) => a + b, 0)).toBeCloseTo(8 * step, 12);
    expect(line.syllables.map((s) => s.nucleus.ipa)).toEqual(['beat:.', 'beat:B', 'beat:t', 'beat:B', 'beat:t', 'beat:B', 'beat:t', 'beat:B', 'beat:t']);
  });
});

describe('beat sounds on the phoneme parameter', () => {
  it('sit after the phonemes, each plain then accented', () => {
    expect(VOCAL_BEAT_BASE).toBe(VOCAL_PHONEMES.length);
    expect(vocalBeatIndex('B')).toBe(VOCAL_BEAT_BASE + 2 * VOCAL_BEATS.findIndex((b) => b.id === 'B'));
    expect(vocalBeatIndex('B', true)).toBe(vocalBeatIndex('B') + 1);
    expect(beatTokenIndex('beat:Pf>')).toBe(vocalBeatIndex('Pf', true));
    expect(beatTokenIndex('beat:nope')).toBe(-1);
    expect(vocalIsBeat(vocalBeatIndex('m'))).toBe(true);
    expect(vocalIsBeat(VOCAL_BEAT_BASE - 1)).toBe(false);
  });

  it('strike again when the same sound repeats, where a repeated phoneme is held', () => {
    const line = beatLine('B B B', { bpm: 120 });
    const notes = line.durs.reduce<{ time: number; dur: number; hz: number }[]>((acc, d) => {
      const t = acc.length ? acc[acc.length - 1].time + acc[acc.length - 1].dur : 1;
      acc.push({ time: t, dur: d, hz: 90 });
      return acc;
    }, []);
    const plan = planSung(notes, line.syllables);
    expect(plan.phrases).toHaveLength(1);
    const posted = sungEvents(plan, { channel: 0, phonemeParam: 1, bendParam: 2 });
    expect(posted.unknown).toEqual([]);
    const kicks = posted.events.filter((e) => e.kind === EventKind.Param && e.a === 1 && e.b === vocalBeatIndex('B'));
    expect(kicks).toHaveLength(3);
  });
});
