/*
 * Speech as notes: the syllables of a spoken phrase timed and pitched the way an accent speaks, so the
 * sung planner (sing.ts) can say them. English is stress-timed: a stressed syllable takes about twice
 * an unstressed one's vowel time, and the last syllable of a phrase lengthens (phrase-final
 * lengthening, Klatt 1976). Pitch follows a simple autosegmental reading of English intonation
 * (Pierrehumbert 1980, in the shape ToBI writes): a baseline that sinks across the phrase
 * (declination), a pitch accent on each stressed syllable, and on the phrase's last stressed syllable
 * the nuclear tone that ends it, a fall to below the baseline or a rise above it.
 *
 * The figures are this module's, chosen to sound like ordinary read speech at a given rate, not
 * fitted to a corpus: vowels of 0.18 s stressed and 0.09 s unstressed (the accent's stress ratio, 2
 * here, moves them toward each other for syllable-timed Englishes), final lengthening of 1.5, and
 * each consonant's spoken duration (durations.ts) added to the note it closes or opens.
 */

import type { Syllable, SungNote } from './types';
import type { LexicalSet } from './lexical-sets';
import type { Prosody } from './accents';
import { DEFAULT_PROSODY } from './accents';
import { consonantDuration } from './durations';

const STRESSED_VOWEL = 0.18;
const UNSTRESSED_VOWEL = 0.09;
/* the two together, which another stress ratio splits differently */
const VOWEL_PAIR = STRESSED_VOWEL + UNSTRESSED_VOWEL;
const STRESS_RATIO = 2;
const FINAL_LENGTHENING = 1.5;
/*
 * Context factors on a vowel's length, Klatt's (1979) duration rules as MITalk sets them out (Allen,
 * Hunnicutt and Klatt 1987, ch. 9; CHIMERA ports them in phonetics/durations.rs), laid over the stress
 * timing above as factors so an accent's stress ratio keeps its meaning:
 *   - each vowel's inherent length, Klatt's INH over the General American monophthongs' mean (180 ms):
 *     /ɑ/ 240, /ɪ/ 135, /aɪ/ 250;
 *   - the consonant after it in the same word, English's main cue to final voicing (Peterson and
 *     Lehiste 1960): before a voiced fricative 1.6, a voiced stop 1.2, a nasal 0.85, a voiceless stop
 *     0.7; at a phrase's end in full, elsewhere 0.7 + 0.3 f;
 *   - a syllable that does not end its word 0.85, and any syllable of a longer word 0.8.
 */
const INHERENT: Readonly<Record<string, number>> = {
  i: 155, ɪ: 135, e: 190, eɪ: 190, ɛ: 150, æ: 230, a: 230, ɑ: 240, ɒ: 240, ɔ: 240, o: 220, oʊ: 220, ʊ: 160,
  u: 210, ʌ: 140, ə: 120, ɚ: 180, ɝ: 180, aɪ: 250, aʊ: 240, ɔɪ: 280, ɨ: 110,
};
const INHERENT_MEAN = 180;
/* A lexical set's General American vowel, so an accent's vowel ("əʊ" for GOAT) keeps its set's length. */
const SET_VOWEL: Readonly<Partial<Record<LexicalSet, string>>> = {
  KIT: 'ɪ', DRESS: 'ɛ', TRAP: 'æ', LOT: 'ɑ', STRUT: 'ʌ', FOOT: 'ʊ', BATH: 'æ', CLOTH: 'ɔ', NURSE: 'ɝ', FLEECE: 'i',
  FACE: 'eɪ', PALM: 'ɑ', THOUGHT: 'ɔ', GOAT: 'oʊ', GOOSE: 'u', PRICE: 'aɪ', CHOICE: 'ɔɪ', MOUTH: 'aʊ', NEAR: 'ɪ',
  SQUARE: 'ɛ', START: 'ɑ', NORTH: 'ɔ', FORCE: 'ɔ', CURE: 'ʊ', happY: 'i', lettER: 'ɚ', commA: 'ə',
};
/* The shortest the context factors take a vowel to, as Klatt's minimum duration keeps it: "be-" in "because". */
const KLATT_FLOOR = 0.5;
const VOICED_FRICATIVES = new Set(['v', 'ð', 'z', 'ʒ']);
const VOICED_STOPS = new Set(['b', 'd', 'g', 'dʒ']);
const VOICELESS_STOPS = new Set(['p', 't', 'k', 'tʃ', 'ʔ']);
const NASALS = new Set(['m', 'n', 'ŋ']);

/** Klatt's factor on vowel time for the consonant after it, before it is weakened away from a phrase's end. */
function postvocalic(ipa: string | undefined): number {
  if (ipa === undefined) return 1;
  if (VOICED_FRICATIVES.has(ipa)) return 1.6;
  if (VOICED_STOPS.has(ipa)) return 1.2;
  if (VOICELESS_STOPS.has(ipa)) return 0.7;
  if (NASALS.has(ipa)) return 0.85;
  return 1;
}

/**
 * The context factor on syllable k's vowel in a phrase (see above). `weight` scales how far the
 * context moves it, so a syllable-timed accent (stress ratio near 1) keeps its even rhythm.
 */
function klattFactor(span: readonly Syllable[], k: number, last: boolean, weight: number): number {
  const syl = span[k];
  const v = (syl.nucleus.set && SET_VOWEL[syl.nucleus.set]) ?? syl.nucleus.ipa;
  const inh = INHERENT[v] ?? INHERENT[Array.from(v)[0]] ?? INHERENT_MEAN;
  const own = Math.max(0.65, Math.min(1.45, inh / INHERENT_MEAN));
  let f = 1;
  // the word this syllable is in: back to the previous word's end, on to its own
  let a = k;
  while (a > 0 && !span[a - 1].wordEnd) a--;
  let b = k;
  while (b < span.length - 1 && !span[b].wordEnd) b++;
  if (b > a) f *= 0.8;
  if (!syl.wordEnd && k < b) f *= 0.85;
  // the next consonant in the same word: this syllable's coda, or the next syllable's onset
  const next = syl.coda[0]?.ipa ?? (k < b ? span[k + 1].onset[0]?.ipa : undefined);
  const c = postvocalic(next);
  f *= last ? c : 0.7 + 0.3 * c;
  return own * Math.max(KLATT_FLOOR, 1 + (f - 1) * weight);
}

/** The pause after a phrase, s. */
const PHRASE_PAUSE = 0.28;
/**
 * A breath in between phrases, s, and the silence after it. Speech breathing is a short quick
 * inhalation and a long slow exhalation; an in-breath in a pause is noise with no pitch, set between
 * short silences (Trouvain et al. 2020; Werner et al. 2021, who also find in-breaths inside speech
 * louder than those that start it). The lengths are INFERRED for read speech at rate 1.
 */
const INHALE = 0.32;
const AFTER_INHALE = 0.05;

export interface SpeechOptions {
  /** The speaker's baseline pitch, Hz. Default 110. */
  hz?: number;
  /** Rate over the accent's own, 1 normal, 2 twice as fast. */
  rate?: number;
  /** The melody; the accent's, or General American's. */
  prosody?: Prosody;
  /** End the last phrase rising, as a yes-no question does. Default: the text ends with "?". */
  question?: boolean;
  /**
   * Breaths in: 'between' phrases (the default), 'all' (before the first phrase too, softer), or
   * 'none'. A breath is a sound (the voice's 'in' beat): the glottis wide and the air drawn in.
   */
  breath?: 'between' | 'all' | 'none';
}

/** A spoken note: a syllable's, or a rest (`hz` 0) for the pause after a phrase. Times from 0, s. */
export interface SpokenNote extends SungNote {
  rest?: boolean;
}

/** Speech ready for the sung planner: the syllables (with a held copy where a tone moves inside one) and a note each. */
export interface SpeechPlan {
  syllables: Syllable[];
  /** One per syllable, plus the rests between phrases. */
  notes: SpokenNote[];
}

/**
 * Time and pitch each syllable as speech. `questions` marks, per phrase, the ones that end rising (a
 * yes-no question), whatever the accent's tune. A nuclear tone on a phrase's last syllable moves
 * within it, so that syllable is sung as two notes, its vowel carried onto the second as a melisma.
 */
export function speechPlan(
  syllables: readonly Syllable[],
  opts: SpeechOptions = {},
  questions: readonly boolean[] = [],
): SpeechPlan {
  const pro = opts.prosody ?? DEFAULT_PROSODY;
  const hz = opts.hz !== undefined && opts.hz > 0 ? opts.hz : 110;
  const rate = Math.max(0.1, (opts.rate ?? 1) * pro.rate);
  const ratio = Math.max(0.5, pro.stressRatio ?? STRESS_RATIO);
  // the default ratio keeps the exact constants, so speech in a stress-timed accent is unchanged
  const unstressedVowel = ratio === STRESS_RATIO ? UNSTRESSED_VOWEL : VOWEL_PAIR / (1 + ratio);
  const stressedVowel = ratio === STRESS_RATIO ? STRESSED_VOWEL : (VOWEL_PAIR * ratio) / (1 + ratio);
  // the context factors in full at English's stress timing, half in a syllable-timed accent
  const klattWeight = 0.5 + 0.5 * Math.max(0, Math.min(1, (ratio - 1) / (STRESS_RATIO - 1)));
  const out: SpokenNote[] = [];
  const sylOut: Syllable[] = [];
  const breath = opts.breath ?? 'between';
  // a breath's length shortens a little as speech speeds up, less than the speech does
  const inhale = INHALE / Math.sqrt(rate);
  let t = 0;
  let phrase = 0;
  for (let start = 0; start < syllables.length; ) {
    let end = start;
    while (end < syllables.length - 1 && !syllables[end].phraseEnd) end++;
    const span = syllables.slice(start, end + 1);
    if (breath === 'all' || (breath === 'between' && phrase > 0)) {
      // the breath in opens the phrase, before its first consonants: louder (accented) inside speech
      const first = span[0];
      const token = phrase > 0 ? 'beat:in>' : 'beat:in';
      span[0] = { ...first, onset: [{ ipa: token, dur: inhale }, { ipa: '_', dur: AFTER_INHALE }, ...first.onset] };
    }
    const rising = questions[phrase] ?? pro.tune === 'rise';
    const { pitches, endTone } = phrasePitches(span, pro, rising);
    for (let k = 0; k < span.length; k++) {
      const syl = span[k];
      const last = k === span.length - 1;
      const stressed = syl.nucleus.stress !== undefined && syl.nucleus.stress > 0;
      let vowel = syl.nucleus.dur ?? (stressed ? stressedVowel : unstressedVowel) * klattFactor(span, k, last, klattWeight);
      if (last) vowel *= FINAL_LENGTHENING;
      let consonants = 0;
      for (const c of syl.coda) consonants += c.dur ?? consonantDuration(c.ipa);
      // the next syllable's opening consonants come out of this note
      if (!last) for (const c of span[k + 1].onset) consonants += c.dur ?? consonantDuration(c.ipa);
      if (last && endTone !== undefined) {
        // the tone moves inside the syllable: its first half at the accent, the rest carried to the end tone
        const first = (0.45 * vowel) / rate;
        const second = (0.55 * vowel + consonants) / rate;
        // the coda stays on the syllable that starts the chain, as a sung melisma's does (read.ts):
        // planSung sounds it after the chain's last note, and reads a melisma's own coda never
        sylOut.push({ ...syl, phraseEnd: false, wordEnd: false });
        sylOut.push({ text: '~', onset: [], nucleus: { ...syl.nucleus }, coda: [], melisma: true, wordEnd: syl.wordEnd, phraseEnd: syl.phraseEnd });
        out.push({ time: t, dur: first, hz: hz * 2 ** (pitches[k] / 12) });
        out.push({ time: t + first, dur: second, hz: hz * 2 ** (endTone / 12) });
        t += first + second;
        continue;
      }
      const dur = (vowel + consonants) / rate;
      sylOut.push(syl);
      out.push({ time: t, dur, hz: hz * 2 ** (pitches[k] / 12) });
      t += dur;
    }
    if (end < syllables.length - 1) {
      // the pause, and room for the next phrase's opening consonants
      let lead = 0;
      for (const c of syllables[end + 1].onset) lead += c.dur ?? consonantDuration(c.ipa);
      // and the breath in that opens it
      if (breath !== 'none') lead += inhale + AFTER_INHALE;
      const dur = PHRASE_PAUSE / rate + lead;
      out.push({ time: t, dur, hz: 0, rest: true });
      t += dur;
    }
    phrase++;
    start = end + 1;
  }
  return { syllables: sylOut, notes: out };
}

/**
 * Each syllable's pitch in semitones from the baseline, and, when the nuclear syllable is the last,
 * the tone its vowel moves to.
 */
function phrasePitches(span: readonly Syllable[], pro: Prosody, rising: boolean): { pitches: number[]; endTone?: number } {
  const n = span.length;
  let nuclear = -1;
  for (let k = n - 1; k >= 0; k--) {
    const s = span[k].nucleus.stress;
    if (s !== undefined && s > 0) {
      nuclear = k;
      break;
    }
  }
  if (nuclear < 0) nuclear = n - 1;
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const base = n > 1 ? -pro.declination * (k / (n - 1)) : 0;
    const stress = span[k].nucleus.stress ?? 0;
    let st = base;
    if (k < nuclear) {
      // prenuclear accents, the first highest, secondary stress lower
      if (stress === 1) st += pro.range * (k === firstStressed(span) ? 1 : 0.7);
      else if (stress === 2) st += pro.range * 0.35;
    } else if (k === nuclear) {
      st += rising ? -0.25 * pro.range : pro.range;
    } else {
      // the tail falls to below the baseline or climbs, spread across what is left
      const along = (k - nuclear) / (n - 1 - nuclear);
      st += rising ? pro.range * (0.4 + 0.8 * along) : -0.6 * pro.range * along - 0.2 * pro.range;
    }
    out.push(st);
  }
  if (nuclear < n - 1) return { pitches: out };
  // a nuclear tone on the last syllable moves within it
  return { pitches: out, endTone: rising ? -pro.declination + pro.range : -pro.declination - 0.4 * pro.range };
}

function firstStressed(span: readonly Syllable[]): number {
  for (let k = 0; k < span.length; k++) if (span[k].nucleus.stress === 1) return k;
  return -1;
}
