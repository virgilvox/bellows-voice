/*
 * Beatbox patterns as text, and their timing: what a beatbox line sings, before any audio.
 *
 * A pattern is written as CHIMERA writes one (Jameson Hodge, MIT,
 * crates/chimera/src/phonetics/beatbox.rs, parse_beat and BEAT_PRESETS): tokens separated by spaces
 * or "|" (bar lines, ignored), one sixteenth each; "." or "-" is a rest; a hum may carry a MIDI note
 * ("m:43"); a trailing ">" accents. The sounds are engines/vocal-beats.ts's. Swing delays every
 * off-beat sixteenth by swing times half a step, as CHIMERA's beat player does.
 *
 * A pattern becomes syllables and notes for the sung planner: each step a syllable whose nucleus is
 * a beat token ("beat:Pf", "beat:B>") on a note one step long, rests a silent ready posture, so the
 * whole pattern is one breath group, one throat, monophonic as a beatboxer is.
 */

import { BEAT_PREFIX, VOCAL_BEATS, vocalBeatNumber } from '../engines/vocal-beats';
import type { Syllable } from './types';

export interface BeatStep {
  /** A sound's id from VOCAL_BEATS ('B', 'Pf', 'tss', ...). */
  id: string;
  /** A hum's pitch as a MIDI note number, through the caller's tuning. */
  note?: number;
  accent?: boolean;
}

/** A pattern: one entry a sixteenth, null for a rest. */
export type BeatPattern = (BeatStep | null)[];

/** The longest pattern read: sixteen bars of sixteenths. */
export const MAX_BEAT_STEPS = 256;

/** A beat written as text to its steps. An unknown token is a rest, so a typo keeps the time. */
export function parseBeat(text: string): BeatPattern {
  const out: BeatPattern = [];
  for (const raw of text.split(/[\s|]+/)) {
    if (raw === '') continue;
    if (out.length === MAX_BEAT_STEPS) break;
    if (raw === '.' || raw === '-') {
      out.push(null);
      continue;
    }
    let tok = raw;
    let accent = false;
    if (tok.length > 1 && tok.endsWith('>')) {
      accent = true;
      tok = tok.slice(0, -1);
    }
    let note: number | undefined;
    // "m:43" a hum at MIDI 43; "m:" alone, or a pitch that is not a number, keeps the default pitch
    const m = /^(.+?):(-?\d*)$/.exec(tok);
    if (m) {
      tok = m[1];
      if (m[2] !== '' && m[2] !== '-') note = Math.max(0, Math.min(127, Number(m[2])));
    }
    const n = vocalBeatNumber(tok);
    if (n <= 0) {
      // '.' is beat 0, the rest
      out.push(null);
      continue;
    }
    const step: BeatStep = { id: VOCAL_BEATS[n].id };
    if (note !== undefined) step.note = note;
    if (accent) step.accent = true;
    out.push(step);
  }
  return out;
}

/** A pattern back to text: four steps a group, groups split by " | ". */
export function formatBeat(steps: BeatPattern): string {
  const toks = steps.map((s) => (s === null ? '.' : `${s.id}${s.note !== undefined ? `:${s.note}` : ''}${s.accent ? '>' : ''}`));
  const groups: string[] = [];
  for (let i = 0; i < toks.length; i += 4) groups.push(toks.slice(i, i + 4).join(' '));
  return groups.join(' | ');
}

export interface BeatPreset {
  id: string;
  name: string;
  bpm: number;
  /** 0 to 0.6. */
  swing: number;
  text: string;
}

/** Ready-made patterns: CHIMERA's seven, then bellows' own. */
export const BEAT_PRESETS: readonly BeatPreset[] = [
  { id: 'boots-and-cats', name: 'Boots and cats', bpm: 96, swing: 0, text: 'B . t . | Pf . t . | B . t . | Pf . t .' },
  { id: 'four-on-the-floor', name: 'Four on the floor', bpm: 122, swing: 0, text: 'B . t . | B . tss . | B . t . | B . tss .' },
  { id: 'breakbeat', name: 'Breakbeat', bpm: 94, swing: 0.18, text: 'B . t . | Pf . t B | . B t . | Pf . t t' },
  { id: 'rimshot-shuffle', name: 'Rimshot shuffle', bpm: 88, swing: 0.4, text: 'B . t K | . t B . | t . K t | . B K t' },
  { id: 'inward-snare', name: 'Inward snare', bpm: 100, swing: 0, text: 'B . t . | ^K . t . | B B t . | ^K . t .' },
  { id: 'clicks-and-pops', name: 'Clicks and pops', bpm: 90, swing: 0.25, text: 'B . ! . | P! . ! . | B ! . ! | P! . ! !' },
  { id: 'hum-bass', name: 'Hum bass', bpm: 92, swing: 0.1, text: 'B m . m:43 | Pf . m:45 . | B m:40 . m | Pf . t kch' },
  { id: 'psh-groove', name: 'Psh groove', bpm: 98, swing: 0.12, text: 'B . ch . | Psh . ch B | . B ch . | Psh . ch tss' },
];

export interface BeatTiming {
  /** Quarter notes a minute; a step is a sixteenth. Default 96. */
  bpm?: number;
  /** 0 to 0.6, default 0. */
  swing?: number;
  /** Times through the pattern, default 1. */
  repeat?: number;
}

/** The silent ready posture before a pattern's first step, s: room for its first sound's preparation. */
export const BEAT_LEAD_IN = 0.15;

/** A step's length in seconds at `bpm`. */
export function beatStepSeconds(bpm: number): number {
  return 60 / Math.max(20, Math.min(400, Number.isFinite(bpm) ? bpm : 96)) / 4;
}

export interface BeatLine {
  /** One syllable a step, the lead-in first. */
  syllables: Syllable[];
  /** Each step's length in seconds, the lead-in first, swing applied. */
  durs: number[];
  /** Each step, the lead-in (null) first: what its note is. */
  steps: BeatPattern;
}

/** A pattern as a sung line: the lead-in and each step as a syllable with its length. */
export function beatLine(pattern: BeatPattern | string, opts: BeatTiming = {}): BeatLine {
  const steps0 = typeof pattern === 'string' ? parseBeat(pattern) : pattern;
  const repeat = Math.max(1, Math.min(64, Math.floor(opts.repeat ?? 1)));
  const step = beatStepSeconds(opts.bpm ?? 96);
  const sw = opts.swing ?? 0;
  const swing = Math.max(0, Math.min(0.6, Number.isFinite(sw) ? sw : 0)) * 0.5 * step;
  const steps: BeatPattern = [null];
  const durs: number[] = [BEAT_LEAD_IN];
  let n = 0;
  for (let r = 0; r < repeat; r++) {
    for (let i = 0; i < steps0.length; i++, n++) {
      steps.push(steps0[i]);
      // an off-beat sixteenth starts `swing` late: the step before it is that much longer. Counted
      // across repeats, so a pattern of odd length still alternates on the beat
      durs.push(step + (n % 2 === 0 ? swing : -swing));
    }
  }
  const syllables: Syllable[] = steps.map((s) => ({
    text: s === null ? '.' : s.id,
    onset: [],
    nucleus: { ipa: `${BEAT_PREFIX}${s === null ? '.' : s.id}${s?.accent ? '>' : ''}` },
    coda: [],
    wordEnd: true,
    phraseEnd: false,
  }));
  return { syllables, durs, steps };
}
