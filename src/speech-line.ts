/*
 * A spoken line as syllables and notes, before any clock: what Singer.speak() lays out on bellows'
 * clock and renderSpeech() (offline.ts) renders without one, so both say a text the same way.
 */

import type { PronouncingDictionary, Syllable } from './lyrics/types';
import { lyricsToSyllables } from './lyrics/read';
import { IPA_SPAN, spellOut } from './lyrics/numbers';
import { resolveAccent, type Accent } from './lyrics/accents';
import { speechPlan } from './lyrics/speech';

/* A phrase: a run of text, IPA between slashes kept whole, and its closing marks. */
const PHRASE = new RegExp('(?:' + IPA_SPAN + '|[^.!?;:,\\n])+[.!?;:,\\n]*', 'gu');

/** Spoken consonants keep their full length, where sung ones are shortened (lyrics/durations.ts). */
export const SPOKEN_CONSONANT_SCALE = 1;

export interface SpeechLineOptions {
  dictionary?: PronouncingDictionary;
  accent?: Accent | string;
  /** Baseline pitch, Hz. */
  hz: number;
  rate?: number;
  allophones?: boolean;
  breath?: 'between' | 'all' | 'none';
  numbers?: boolean;
}

export interface SpeechLine {
  syllables: Syllable[];
  /** In order, end to end: a pitch for each syllable's note, null for a rest. Seconds. */
  notes: Array<{ hz: number | null; dur: number }>;
}

/**
 * Speak text in an accent: phrases at its marks (numbers read as words first, so "$5.50" is not
 * split), each phrase's tune from its closing mark, timed and pitched by speechPlan.
 */
export function speechLine(text: string, opts: SpeechLineOptions): SpeechLine {
  const accent = resolveAccent(opts.accent);
  const syllables: Syllable[] = [];
  const questions: boolean[] = [];
  const words = opts.numbers === false ? text : spellOut(text);
  for (const m of words.matchAll(PHRASE)) {
    const part = lyricsToSyllables(m[0], {
      numbers: false,
      dictionary: opts.dictionary,
      allophones: opts.allophones,
      accent,
      // running speech: weak function words
      reduce: true,
    });
    if (part.length === 0) continue;
    part[part.length - 1].phraseEnd = true;
    syllables.push(...part);
    questions.push(m[0].includes('?'));
  }
  const plan = speechPlan(syllables, { hz: opts.hz, rate: opts.rate, prosody: accent.prosody, breath: opts.breath }, questions);
  return { syllables: plan.syllables, notes: plan.notes.map((n) => ({ hz: n.rest ? null : n.hz, dur: n.dur })) };
}
