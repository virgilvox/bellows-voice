/*
 * Accents as data. An accent says how each lexical set (lexical-sets.ts) is voiced, whether r after a
 * vowel is said, and how it treats t, l, th, r and h. The English reader speaks General American and
 * tags every vowel with its set; applyAccent re-voices those tags across a phrase, then the allophone
 * pass (allophones.ts) applies the accent's t and l. IPA written between slashes has no sets and is
 * sung as written.
 *
 * Realizations are IPA. One vowel is a monophthong ("e" for Irish FACE); two vowels are a diphthong
 * that glides from the first to the second, the first held for `hold` of the vowel's time ("əʊ" for
 * Southern British GOAT); a final r ("ʌɾ" for Scottish NURSE) is an r the accent says after the vowel,
 * which replaces the r General American had there or adds one where it had none (General American
 * NURSE has its r inside the vowel). A length mark is read and dropped, since a sung note sets the
 * vowel's length. Every vowel named must be one the vocal engine has (vocal-phonemes.ts): the General
 * American set plus ɒ ɐ ɜ ʉ ɨ ɘ ɵ y ø œ ɯ ɤ, solved from formants (scripts/gen-extra-vowels.mjs).
 *
 * Sources for the tables: J. C. Wells, Accents of English (1982), and the lexical-set tables of the
 * Wikipedia articles on each accent, which cite Cruttenden (Gimson's Pronunciation of English, 2014)
 * for Southern British, Cox and Palethorpe (2007) for Australian, Bauer et al. (2007) for New Zealand,
 * Hickey (2007) for Irish, Stuart-Smith (2004) for Scottish, Wells and Tollfree for London, Thomas
 * (2004) for the American South, Boberg (2008) for Canadian, Labov (2006) for New York, Penhallurick
 * (2004) for Welsh, Watt and Milroy (1999) for Geordie, Beal (2004) for the North of England, Bowerman
 * (2004) for South Africa, Gut (2004) for Nigeria, Devonish and Harry (2004) for Jamaica, Sailaja (2009)
 * for India, Deterding (2007) for Singapore, Upton (2004) for traditional RP, Wells (1982) and Watson
 * (2007) for Liverpool, Thorne (2003) for Birmingham, Wagner (2004) for the West Country, Labov,
 * Ash and Boberg (2006) for Boston and the Northern Cities Shift, Tayao (2004) for the Philippines,
 * Huber (2004) for Ghana, Schmied (2004) for East Africa, Youssef and James (2004) for Trinidad
 * and, for Russian speakers of English, Swan and Smith's Learner English (2001, the Russian chapter
 * by Monk and Burak), as summarized in those articles and the Handbook of
 * Varieties of English (Kortmann and Schneider, 2004). They are broad transcriptions of each accent's mainstream form, not
 * of any one speaker.
 */

import type { LexicalSet } from './lexical-sets';
import type { Segment, Syllable } from './types';
import { isVowel } from './ipa';

/** How /t/ between vowels and before consonants comes out. */
export type TRule =
  /** "water" with a tap, as in North America and Australia. */
  | 'flap'
  /** Every /t/ released. */
  | 'released'
  /** A glottal stop before a consonant ("football", "that one"), released elsewhere. */
  | 'glottal-coda'
  /** A glottal stop before a consonant, a pause, or an unstressed vowel ("water", "bottle", "that"). */
  | 'glottal';
/** How /l/ comes out. */
export type LRule =
  /** Dark after a vowel, clear before one: General American, Southern British. */
  | 'dark-coda'
  /** Clear everywhere: Irish, Welsh. */
  | 'clear'
  /** Dark everywhere: Scottish, much of the American South. */
  | 'dark'
  /** Vocalized to a w-like glide after a vowel ("milk", "bottle"), dark-coda otherwise: London. */
  | 'vocalized';
/** How the dental fricatives come out. */
export type ThRule =
  | 'fricative'
  /** As stops: "think" tink, "this" dis (Irish, many Caribbean and African accents). */
  | 'stop'
  /** Fronted: "think" fink, "brother" bruvver; "this" keeps a d at the start of a word (London). */
  | 'front'
  /** As sibilants: "think" sink, "this" zis (Russian, French and German speakers of English). */
  | 'sibilant';
/** How /r/ comes out where it is said. */
export type RRule = 'approximant' | 'tap';

/** How an accent speaks a phrase (lyrics/speech.ts). Singing follows the melody instead. */
export interface Prosody {
  /** The phrase's last tone, from its last stressed syllable: a fall, or a rise (Australian and Belfast statements). */
  tune: 'fall' | 'rise';
  /** Height of a pitch accent on a stressed syllable over the baseline, semitones. */
  range: number;
  /** How far the baseline sinks across a phrase, semitones. */
  declination: number;
  /** Speaking rate, 1 for General American's. */
  rate: number;
  /**
   * How much longer a stressed vowel is than an unstressed one: about 2 in stress-timed English
   * (General American, British), nearer 1 in the syllable-timed Englishes of India, Nigeria,
   * Singapore and the Caribbean. Left out, 2.
   */
  stressRatio?: number;
}

export interface Accent {
  id: string;
  name: string;
  /** Where it is spoken, for grouping in a UI ('North America', 'England', 'Africa', ...). */
  region?: string;
  /** Says r after a vowel ("car", "card"). A non-rhotic accent still links it before a vowel ("far away"). */
  rhotic: boolean;
  /** Each lexical set's realization, IPA. A set left out keeps General American's vowel. */
  sets: Partial<Record<LexicalSet, string>>;
  /**
   * Share of a diphthong's time held on its first vowel, 0 to 1. Left out, General American's 0.8
   * (lyrics/sing.ts). Accents whose diphthongs move through the whole vowel sit near 0.5.
   */
  hold?: number;
  /** Per-set holds over `hold`. */
  holds?: Partial<Record<LexicalSet, number>>;
  t: TRule;
  l: LRule;
  th: ThRule;
  r: RRule;
  /** Drops h at the start of a word ("house" ouse). */
  hDrop?: boolean;
  /**
   * Devoices a voiced stop or fricative that ends a word: "bed" as bet, "his" as hiss (Russian,
   * German, Polish and Dutch speakers of English carry this over from their first language).
   */
  devoiceFinal?: boolean;
  /** Consonants said as others everywhere: { w: 'v' } for "west" as vest. */
  replace?: Readonly<Record<string, string>>;
  /**
   * Realizations used instead of `sets` when the vowel comes before a voiceless consonant in the
   * same word: Canadian raising, "price" and "house" with a raised start where "prize" and "how"
   * keep a low one.
   */
  raised?: Partial<Record<LexicalSet, string>>;
  /** Speech melody and rate; General American's when left out. */
  prosody?: Prosody;
}

/** General American's speech melody: a fall at the end of a statement, accents about four semitones high. */
export const DEFAULT_PROSODY: Prosody = { tune: 'fall', range: 4, declination: 2, rate: 1 };

export const GENERAL_AMERICAN: Accent = {
  id: 'general-american',
  name: 'General American',
  region: 'North America',
  rhotic: true,
  /*
   * Before an r in its own syllable American English keeps no tense and lax pair apart (pre-rhotic
   * neutralization, Wells 1982, Accents of English, vol. 1): "fair" is fɛɹ, not feɪɹ, "board"
   * bɔɹd, "near" nɪɹ, "poor" pʊɹ. The CMU dictionary writes it so; spelling rules read "ai", "oa",
   * "ea" and "oo" as their free vowels, so the sets say it here, for every word.
   */
  sets: { NEAR: 'ɪ', SQUARE: 'ɛ', FORCE: 'ɔ', CURE: 'ʊ' },
  t: 'flap',
  l: 'dark-coda',
  th: 'fricative',
  r: 'approximant',
};

export const SOUTHERN_BRITISH: Accent = {
  id: 'southern-british',
  name: 'Southern British',
  region: 'England',
  rhotic: false,
  sets: {
    KIT: 'ɪ', DRESS: 'ɛ', TRAP: 'a', LOT: 'ɒ', STRUT: 'ɐ', FOOT: 'ʊ', BATH: 'ɑː', CLOTH: 'ɒ', NURSE: 'ɜː',
    FLEECE: 'iː', FACE: 'eɪ', PALM: 'ɑː', THOUGHT: 'oː', GOAT: 'əʊ', GOOSE: 'ʉː', PRICE: 'aɪ', CHOICE: 'ɔɪ',
    MOUTH: 'aʊ', NEAR: 'ɪə', SQUARE: 'ɛː', START: 'ɑː', NORTH: 'oː', FORCE: 'oː', CURE: 'oː', happY: 'i',
    lettER: 'ə', commA: 'ə',
  },
  hold: 0.55,
  t: 'glottal-coda',
  l: 'dark-coda',
  th: 'fricative',
  r: 'approximant',
  prosody: { tune: 'fall', range: 6, declination: 3, rate: 1 },
};

export const LONDON: Accent = {
  id: 'london',
  name: 'London',
  region: 'England',
  rhotic: false,
  sets: {
    KIT: 'ɪ', DRESS: 'e', TRAP: 'æ', LOT: 'ɒ', STRUT: 'ɐ', FOOT: 'ʊ', BATH: 'ɑː', CLOTH: 'ɒ', NURSE: 'ɜː',
    FLEECE: 'əi', FACE: 'æɪ', PALM: 'ɑː', THOUGHT: 'oː', GOAT: 'ʌʊ', GOOSE: 'ʉː', PRICE: 'ɑɪ', CHOICE: 'oɪ',
    MOUTH: 'æʊ', NEAR: 'ɪə', SQUARE: 'eː', START: 'ɑː', NORTH: 'oː', FORCE: 'oː', CURE: 'oː', happY: 'i',
    lettER: 'ə', commA: 'ə',
  },
  hold: 0.5,
  t: 'glottal',
  l: 'vocalized',
  th: 'front',
  r: 'approximant',
  hDrop: true,
  prosody: { tune: 'fall', range: 5, declination: 2, rate: 1.05 },
};

export const AUSTRALIAN: Accent = {
  id: 'australian',
  name: 'Australian',
  region: 'Southern hemisphere',
  rhotic: false,
  sets: {
    KIT: 'ɪ', DRESS: 'e', TRAP: 'æ', LOT: 'ɔ', STRUT: 'ɐ', FOOT: 'ʊ', BATH: 'ɐː', CLOTH: 'ɔ', NURSE: 'ɵː',
    FLEECE: 'ɪi', FACE: 'æɪ', PALM: 'ɐː', THOUGHT: 'oː', GOAT: 'ɐʉ', GOOSE: 'ʉː', PRICE: 'ɒe', CHOICE: 'oɪ',
    MOUTH: 'æɔ', NEAR: 'ɪə', SQUARE: 'eː', START: 'ɐː', NORTH: 'oː', FORCE: 'oː', CURE: 'oː', happY: 'i',
    lettER: 'ə', commA: 'ə',
  },
  hold: 0.45,
  t: 'flap',
  l: 'dark-coda',
  th: 'fricative',
  r: 'approximant',
  prosody: { tune: 'rise', range: 4, declination: 1.5, rate: 1 },
};

export const NEW_ZEALAND: Accent = {
  id: 'new-zealand',
  name: 'New Zealand',
  region: 'Southern hemisphere',
  rhotic: false,
  sets: {
    KIT: 'ɘ', DRESS: 'e', TRAP: 'ɛ', LOT: 'ɒ', STRUT: 'ɐ', FOOT: 'ʊ', BATH: 'ɐː', CLOTH: 'ɒ', NURSE: 'øː',
    FLEECE: 'ɪi', FACE: 'æɪ', PALM: 'ɐː', THOUGHT: 'oː', GOAT: 'ɐʉ', GOOSE: 'ʉː', PRICE: 'ɒe', CHOICE: 'oe',
    MOUTH: 'æʊ', NEAR: 'iə', SQUARE: 'iə', START: 'ɐː', NORTH: 'oː', FORCE: 'oː', CURE: 'ʉə', happY: 'i',
    lettER: 'ɘ', commA: 'ɘ',
  },
  hold: 0.45,
  t: 'flap',
  l: 'dark',
  th: 'fricative',
  r: 'approximant',
  prosody: { tune: 'rise', range: 3.5, declination: 1.5, rate: 1.05 },
};

export const IRISH: Accent = {
  id: 'irish',
  name: 'Irish',
  region: 'Scotland, Wales and Ireland',
  rhotic: true,
  sets: {
    KIT: 'ɪ', DRESS: 'ɛ', TRAP: 'a', LOT: 'ɑ', STRUT: 'ɐ', FOOT: 'ʊ', BATH: 'aː', CLOTH: 'ɒ', FLEECE: 'iː',
    FACE: 'eː', PALM: 'aː', THOUGHT: 'ɒː', GOAT: 'oː', GOOSE: 'uː', PRICE: 'ɑɪ', CHOICE: 'ɒɪ', MOUTH: 'ɐʊ',
    NEAR: 'i', SQUARE: 'e', START: 'a', NORTH: 'ɒ', FORCE: 'o', CURE: 'u', happY: 'i',
  },
  hold: 0.6,
  t: 'released',
  l: 'clear',
  th: 'stop',
  r: 'approximant',
  prosody: { tune: 'fall', range: 5, declination: 2, rate: 1.05 },
};

export const SCOTTISH: Accent = {
  id: 'scottish',
  name: 'Scottish',
  region: 'Scotland, Wales and Ireland',
  rhotic: true,
  sets: {
    KIT: 'ɘ', DRESS: 'ɛ', TRAP: 'a', LOT: 'ɔ', STRUT: 'ʌ', FOOT: 'ʉ', BATH: 'a', CLOTH: 'ɔ', NURSE: 'ʌɾ',
    FLEECE: 'i', FACE: 'e', PALM: 'a', THOUGHT: 'ɔ', GOAT: 'o', GOOSE: 'ʉ', PRICE: 'ʌɪ', CHOICE: 'ɔɪ',
    MOUTH: 'ʌʉ', NEAR: 'iɾ', SQUARE: 'eɾ', START: 'aɾ', NORTH: 'ɔɾ', FORCE: 'oɾ', CURE: 'ʉɾ', happY: 'e',
    lettER: 'əɾ', commA: 'ʌ',
  },
  hold: 0.5,
  t: 'glottal-coda',
  l: 'dark',
  th: 'fricative',
  r: 'tap',
  prosody: { tune: 'fall', range: 4, declination: 2, rate: 1 },
};

export const SOUTHERN_US: Accent = {
  id: 'southern-us',
  name: 'Southern US',
  region: 'North America',
  rhotic: true,
  sets: {
    DRESS: 'ɛ', TRAP: 'æ', BATH: 'æ', FACE: 'ɛɪ', THOUGHT: 'ɒɔ', CLOTH: 'ɒɔ', GOAT: 'ɜʉ', GOOSE: 'ʉ',
    PRICE: 'aː', MOUTH: 'æʊ', CHOICE: 'oɪ',
  },
  hold: 0.5,
  t: 'flap',
  l: 'dark',
  th: 'fricative',
  r: 'approximant',
  prosody: { tune: 'fall', range: 5, declination: 2, rate: 0.85 },
};

/* ---- North America ---- */

export const CANADIAN: Accent = {
  id: 'canadian',
  name: 'Canadian',
  region: 'North America',
  rhotic: true,
  sets: {
    TRAP: 'a', BATH: 'a', LOT: 'ɒ', CLOTH: 'ɒ', THOUGHT: 'ɒ', PALM: 'ɒ', FACE: 'eɪ', GOAT: 'oʊ',
  },
  // Canadian raising: "price" and "house" start higher than "prize" and "how"
  raised: { PRICE: 'ʌɪ', MOUTH: 'ʌʊ' },
  hold: 0.6,
  t: 'flap',
  l: 'dark-coda',
  th: 'fricative',
  r: 'approximant',
  prosody: { tune: 'fall', range: 4, declination: 2, rate: 1 },
};

export const CALIFORNIAN: Accent = {
  id: 'californian',
  name: 'Californian',
  region: 'North America',
  rhotic: true,
  sets: {
    KIT: 'ɪ', DRESS: 'ɛ', TRAP: 'a', BATH: 'a', LOT: 'ɑ', CLOTH: 'ɑ', THOUGHT: 'ɑ', FOOT: 'ɵ', GOOSE: 'ʉ',
    GOAT: 'ɵʊ', FACE: 'eɪ',
  },
  hold: 0.55,
  t: 'flap',
  l: 'dark-coda',
  th: 'fricative',
  r: 'approximant',
  prosody: { tune: 'fall', range: 4.5, declination: 2, rate: 1.05 },
};

export const NEW_YORK: Accent = {
  id: 'new-york',
  name: 'New York',
  region: 'North America',
  rhotic: false,
  sets: {
    TRAP: 'æ', BATH: 'eə', LOT: 'ɑ', PALM: 'ɑ', CLOTH: 'oə', THOUGHT: 'oə', NORTH: 'oə', FORCE: 'oə', START: 'ɑ',
    NURSE: 'ɜ', PRICE: 'ɑɪ', MOUTH: 'æʊ', GOAT: 'oʊ', NEAR: 'ɪə', SQUARE: 'eə', CURE: 'ʊə', lettER: 'ə',
  },
  hold: 0.55,
  t: 'flap',
  l: 'dark-coda',
  th: 'fricative',
  r: 'approximant',
  prosody: { tune: 'fall', range: 5, declination: 2, rate: 1.1 },
};

/* ---- Britain and Ireland ---- */

export const NORTHERN_ENGLISH: Accent = {
  id: 'northern-english',
  name: 'Northern English',
  region: 'England',
  rhotic: false,
  sets: {
    KIT: 'ɪ', DRESS: 'ɛ', TRAP: 'a', BATH: 'a', LOT: 'ɒ', CLOTH: 'ɒ', STRUT: 'ʊ', FOOT: 'ʊ', NURSE: 'ɜ',
    FLEECE: 'i', FACE: 'e', PALM: 'ɑ', THOUGHT: 'o', GOAT: 'o', GOOSE: 'u', PRICE: 'aɪ', CHOICE: 'ɔɪ',
    MOUTH: 'aʊ', NEAR: 'ɪə', SQUARE: 'ɛ', START: 'a', NORTH: 'o', FORCE: 'o', CURE: 'ʊə', happY: 'ɪ',
    lettER: 'ə', commA: 'ə',
  },
  hold: 0.6,
  t: 'glottal-coda',
  l: 'dark-coda',
  th: 'fricative',
  r: 'approximant',
  hDrop: true,
  prosody: { tune: 'fall', range: 4, declination: 2, rate: 1 },
};

export const GEORDIE: Accent = {
  id: 'geordie',
  name: 'Geordie (Tyneside)',
  region: 'England',
  rhotic: false,
  sets: {
    KIT: 'ɪ', DRESS: 'ɛ', TRAP: 'a', BATH: 'a', LOT: 'ɒ', CLOTH: 'ɒ', STRUT: 'ʊ', FOOT: 'ʊ', NURSE: 'ø',
    FLEECE: 'i', FACE: 'eə', PALM: 'ɑ', THOUGHT: 'ɒ', GOAT: 'ɵ', GOOSE: 'ʉ', PRICE: 'ɛɪ', CHOICE: 'ɔɪ',
    MOUTH: 'u', NEAR: 'iə', SQUARE: 'ɛ', START: 'ɑ', NORTH: 'ɒ', FORCE: 'ɒ', CURE: 'ʉə', happY: 'i',
    lettER: 'ɐ', commA: 'ɐ',
  },
  hold: 0.55,
  t: 'glottal-coda',
  l: 'clear',
  th: 'fricative',
  r: 'approximant',
  prosody: { tune: 'rise', range: 5, declination: 1.5, rate: 1.05 },
};

export const WELSH: Accent = {
  id: 'welsh',
  name: 'Welsh',
  region: 'Scotland, Wales and Ireland',
  rhotic: false,
  sets: {
    KIT: 'ɪ', DRESS: 'ɛ', TRAP: 'a', BATH: 'a', LOT: 'ɒ', CLOTH: 'ɒ', STRUT: 'ə', FOOT: 'ʊ', NURSE: 'ø',
    FLEECE: 'i', FACE: 'e', PALM: 'a', THOUGHT: 'o', GOAT: 'o', GOOSE: 'ʉ', PRICE: 'əɪ', CHOICE: 'ɔɪ',
    MOUTH: 'əʊ', NEAR: 'ɪə', SQUARE: 'ɛ', START: 'a', NORTH: 'o', FORCE: 'o', CURE: 'ʊə', happY: 'i',
    lettER: 'ə', commA: 'a',
  },
  hold: 0.55,
  t: 'released',
  l: 'clear',
  th: 'fricative',
  r: 'tap',
  // the Welsh lilt: a rise and wide range on statements, and less difference between syllables
  prosody: { tune: 'rise', range: 6, declination: 1, rate: 1, stressRatio: 1.5 },
};

export const NORTHERN_IRISH: Accent = {
  id: 'northern-irish',
  name: 'Northern Irish (Belfast)',
  region: 'Scotland, Wales and Ireland',
  rhotic: true,
  sets: {
    KIT: 'ɘ', DRESS: 'ɛ', TRAP: 'ɑ', BATH: 'ɑ', LOT: 'ɔ', CLOTH: 'ɔ', STRUT: 'ɐ', FOOT: 'ʉ', FLEECE: 'i',
    FACE: 'eə', PALM: 'ɑ', THOUGHT: 'ɔ', GOAT: 'o', GOOSE: 'ʉ', PRICE: 'ɛɪ', CHOICE: 'ɔɪ', MOUTH: 'ɘʉ',
    NEAR: 'i', SQUARE: 'e', START: 'ɑ', NORTH: 'ɔ', FORCE: 'o', CURE: 'ʉ', happY: 'e',
  },
  hold: 0.5,
  t: 'flap',
  l: 'clear',
  th: 'fricative',
  r: 'approximant',
  // statements rise in Belfast (Grabe and Post)
  prosody: { tune: 'rise', range: 5, declination: 1.5, rate: 1.05 },
};

/* ---- Africa, Asia and the Caribbean ---- */

export const SOUTH_AFRICAN: Accent = {
  id: 'south-african',
  name: 'South African',
  region: 'Southern hemisphere',
  rhotic: false,
  sets: {
    KIT: 'ɪ', DRESS: 'e', TRAP: 'ɛ', BATH: 'ɑ', LOT: 'ɒ', CLOTH: 'ɒ', STRUT: 'ɐ', FOOT: 'ʊ', NURSE: 'ø',
    FLEECE: 'i', FACE: 'eɪ', PALM: 'ɑ', THOUGHT: 'o', GOAT: 'œʊ', GOOSE: 'ʉ', PRICE: 'ɑɪ', CHOICE: 'ɔɪ',
    MOUTH: 'æʊ', NEAR: 'ɪə', SQUARE: 'e', START: 'ɑ', NORTH: 'o', FORCE: 'o', CURE: 'ʊə', happY: 'i',
    lettER: 'ə', commA: 'ə',
  },
  hold: 0.55,
  t: 'released',
  l: 'clear',
  th: 'fricative',
  r: 'approximant',
  prosody: { tune: 'fall', range: 4, declination: 2, rate: 1 },
};

export const NIGERIAN: Accent = {
  id: 'nigerian',
  name: 'Nigerian',
  region: 'Africa',
  rhotic: false,
  // no central vowels: STRUT and NURSE take full vowels, schwa is a
  sets: {
    KIT: 'i', DRESS: 'ɛ', TRAP: 'a', BATH: 'a', LOT: 'ɔ', CLOTH: 'ɔ', STRUT: 'ɔ', FOOT: 'u', NURSE: 'ɛ',
    FLEECE: 'i', FACE: 'e', PALM: 'a', THOUGHT: 'ɔ', GOAT: 'o', GOOSE: 'u', PRICE: 'aɪ', CHOICE: 'ɔɪ',
    MOUTH: 'aʊ', NEAR: 'ia', SQUARE: 'ɛ', START: 'a', NORTH: 'ɔ', FORCE: 'ɔ', CURE: 'ua', happY: 'i',
    lettER: 'a', commA: 'a',
  },
  hold: 0.5,
  t: 'released',
  l: 'clear',
  th: 'stop',
  r: 'tap',
  prosody: { tune: 'fall', range: 4, declination: 1.5, rate: 1, stressRatio: 1.1 },
};

export const JAMAICAN: Accent = {
  id: 'jamaican',
  name: 'Jamaican',
  region: 'Caribbean',
  rhotic: false,
  sets: {
    KIT: 'ɪ', DRESS: 'ɛ', TRAP: 'a', BATH: 'a', LOT: 'a', CLOTH: 'a', STRUT: 'ɔ', FOOT: 'ʊ', NURSE: 'ɔ',
    FLEECE: 'i', FACE: 'ie', PALM: 'a', THOUGHT: 'a', GOAT: 'uo', GOOSE: 'u', PRICE: 'aɪ', CHOICE: 'aɪ',
    MOUTH: 'ɔʊ', NEAR: 'iɛ', SQUARE: 'iɛ', START: 'a', NORTH: 'a', FORCE: 'uo', CURE: 'uo', happY: 'i',
    lettER: 'a', commA: 'a',
  },
  hold: 0.45,
  t: 'released',
  l: 'clear',
  th: 'stop',
  r: 'approximant',
  hDrop: true,
  prosody: { tune: 'fall', range: 6, declination: 1.5, rate: 1.05, stressRatio: 1.3 },
};

export const INDIAN: Accent = {
  id: 'indian',
  name: 'Indian',
  region: 'Asia',
  rhotic: true,
  sets: {
    KIT: 'ɪ', DRESS: 'ɛ', TRAP: 'æ', BATH: 'ɑ', LOT: 'ɒ', CLOTH: 'ɒ', STRUT: 'ə', FOOT: 'ʊ', NURSE: 'əɾ',
    FLEECE: 'i', FACE: 'e', PALM: 'ɑ', THOUGHT: 'ɔ', GOAT: 'o', GOOSE: 'u', PRICE: 'aɪ', CHOICE: 'ɔɪ',
    MOUTH: 'aʊ', NEAR: 'iə', SQUARE: 'e', START: 'ɑ', NORTH: 'ɔ', FORCE: 'o', CURE: 'uə', happY: 'i',
    lettER: 'əɾ', commA: 'ə',
  },
  hold: 0.5,
  t: 'released',
  l: 'clear',
  th: 'stop',
  r: 'tap',
  prosody: { tune: 'fall', range: 5, declination: 1.5, rate: 1.05, stressRatio: 1.25 },
};

export const SINGAPOREAN: Accent = {
  id: 'singaporean',
  name: 'Singaporean',
  region: 'Asia',
  rhotic: false,
  // long and short pairs merge: KIT with FLEECE, FOOT with GOOSE, DRESS with TRAP
  sets: {
    KIT: 'i', DRESS: 'ɛ', TRAP: 'ɛ', BATH: 'ɑ', LOT: 'ɔ', CLOTH: 'ɔ', STRUT: 'ɐ', FOOT: 'u', NURSE: 'ə',
    FLEECE: 'i', FACE: 'e', PALM: 'ɑ', THOUGHT: 'ɔ', GOAT: 'o', GOOSE: 'u', PRICE: 'aɪ', CHOICE: 'ɔɪ',
    MOUTH: 'aʊ', NEAR: 'ɪə', SQUARE: 'ɛ', START: 'ɑ', NORTH: 'ɔ', FORCE: 'ɔ', CURE: 'ʊə', happY: 'i',
    lettER: 'ə', commA: 'ə',
  },
  hold: 0.5,
  t: 'glottal-coda',
  l: 'clear',
  th: 'stop',
  r: 'approximant',
  // syllable-timed
  prosody: { tune: 'fall', range: 3, declination: 1, rate: 1.1, stressRatio: 1 },
};

/* ---- more of Britain ---- */

export const RECEIVED_PRONUNCIATION: Accent = {
  id: 'received-pronunciation',
  name: 'Received Pronunciation (traditional)',
  region: 'England',
  rhotic: false,
  // the older standard, before the changes Southern British shows: TRAP æ, STRUT ʌ, SQUARE and CURE centring
  sets: {
    KIT: 'ɪ', DRESS: 'e', TRAP: 'æ', LOT: 'ɒ', STRUT: 'ʌ', FOOT: 'ʊ', BATH: 'ɑː', CLOTH: 'ɒ', NURSE: 'ɜː',
    FLEECE: 'iː', FACE: 'eɪ', PALM: 'ɑː', THOUGHT: 'ɔː', GOAT: 'əʊ', GOOSE: 'uː', PRICE: 'aɪ', CHOICE: 'ɔɪ',
    MOUTH: 'aʊ', NEAR: 'ɪə', SQUARE: 'ɛə', START: 'ɑː', NORTH: 'ɔː', FORCE: 'ɔː', CURE: 'ʊə', happY: 'ɪ',
    lettER: 'ə', commA: 'ə',
  },
  hold: 0.6,
  t: 'released',
  l: 'dark-coda',
  th: 'fricative',
  r: 'approximant',
  prosody: { tune: 'fall', range: 7, declination: 3, rate: 0.95 },
};

export const SCOUSE: Accent = {
  id: 'scouse',
  name: 'Scouse (Liverpool)',
  region: 'England',
  rhotic: false,
  // NURSE and SQUARE merge ("fair" and "fur"); FOOT and STRUT merge
  sets: {
    KIT: 'ɪ', DRESS: 'ɛ', TRAP: 'a', BATH: 'a', LOT: 'ɒ', CLOTH: 'ɒ', STRUT: 'ʊ', FOOT: 'ʊ', NURSE: 'ɛː',
    FLEECE: 'iː', FACE: 'ɛɪ', PALM: 'ɑ', THOUGHT: 'ɔ', GOAT: 'əʉ', GOOSE: 'ʉ', PRICE: 'aɪ', CHOICE: 'ɔɪ',
    MOUTH: 'aʊ', NEAR: 'iə', SQUARE: 'ɛː', START: 'ɑ', NORTH: 'ɔ', FORCE: 'ɔ', CURE: 'ʉə', happY: 'i',
    lettER: 'ə', commA: 'ə',
  },
  hold: 0.5,
  t: 'released',
  l: 'clear',
  th: 'fricative',
  r: 'tap',
  prosody: { tune: 'rise', range: 5, declination: 1.5, rate: 1.1 },
};

export const BRUMMIE: Accent = {
  id: 'brummie',
  name: 'Brummie (Birmingham)',
  region: 'England',
  rhotic: false,
  // PRICE starts back and rounded, FACE and GOAT start low and central; a famously level tune
  sets: {
    KIT: 'ɪ', DRESS: 'ɛ', TRAP: 'a', BATH: 'a', LOT: 'ɒ', CLOTH: 'ɒ', STRUT: 'ʊ', FOOT: 'ʊ', NURSE: 'ɜ',
    FLEECE: 'əi', FACE: 'ʌɪ', PALM: 'ɑ', THOUGHT: 'ɔ', GOAT: 'ʌʊ', GOOSE: 'əʉ', PRICE: 'ɔɪ', CHOICE: 'oɪ',
    MOUTH: 'æʊ', NEAR: 'iə', SQUARE: 'ɛ', START: 'ɑ', NORTH: 'ɔ', FORCE: 'ɔ', CURE: 'ʉə', happY: 'i',
    lettER: 'ə', commA: 'ə',
  },
  hold: 0.5,
  t: 'glottal-coda',
  l: 'dark-coda',
  th: 'fricative',
  r: 'approximant',
  hDrop: true,
  prosody: { tune: 'fall', range: 2.5, declination: 1, rate: 1 },
};

export const WEST_COUNTRY: Accent = {
  id: 'west-country',
  name: 'West Country',
  region: 'England',
  // one of the few English accents of England that keeps r after a vowel
  rhotic: true,
  sets: {
    KIT: 'ɪ', DRESS: 'ɛ', TRAP: 'a', BATH: 'a', LOT: 'ɒ', CLOTH: 'ɒ', STRUT: 'ɐ', FOOT: 'ʊ', FLEECE: 'i',
    FACE: 'e', PALM: 'a', THOUGHT: 'ɒ', GOAT: 'o', GOOSE: 'ʉ', PRICE: 'ɐɪ', CHOICE: 'ɔɪ', MOUTH: 'ɐʊ',
    NEAR: 'i', SQUARE: 'ɛ', START: 'a', NORTH: 'ɒ', FORCE: 'o', CURE: 'ʉ', happY: 'i',
  },
  hold: 0.55,
  t: 'glottal-coda',
  l: 'dark',
  th: 'fricative',
  r: 'approximant',
  prosody: { tune: 'fall', range: 4.5, declination: 2, rate: 0.95 },
};

/* ---- more of North America ---- */

export const BOSTON: Accent = {
  id: 'boston',
  name: 'Boston',
  region: 'North America',
  rhotic: false,
  // START and BATH fronted ("pahk the cah"); LOT and THOUGHT merged; PRICE raised before voiceless
  sets: {
    TRAP: 'æ', BATH: 'a', LOT: 'ɒ', CLOTH: 'ɒ', THOUGHT: 'ɒ', PALM: 'a', START: 'a', NURSE: 'ɜ',
    NEAR: 'ɪə', SQUARE: 'ɛə', NORTH: 'ɔə', FORCE: 'ɔə', CURE: 'ʊə', lettER: 'ə', MOUTH: 'aʊ',
  },
  raised: { PRICE: 'ʌɪ' },
  hold: 0.6,
  t: 'flap',
  l: 'dark-coda',
  th: 'fricative',
  r: 'approximant',
  prosody: { tune: 'fall', range: 4.5, declination: 2, rate: 1.1 },
};

export const INLAND_NORTH: Accent = {
  id: 'inland-north',
  name: 'Inland North (Chicago, Detroit)',
  region: 'North America',
  rhotic: true,
  // the Northern Cities Shift: TRAP raised to eə, LOT fronted to a, THOUGHT lowered, DRESS and STRUT backed
  sets: {
    TRAP: 'eə', BATH: 'eə', LOT: 'a', PALM: 'a', THOUGHT: 'ɑ', CLOTH: 'ɑ', DRESS: 'ɜ', STRUT: 'ɔ', KIT: 'ɘ',
  },
  hold: 0.65,
  t: 'flap',
  l: 'dark-coda',
  th: 'fricative',
  r: 'approximant',
  prosody: { tune: 'fall', range: 4, declination: 2, rate: 1.05 },
};

/* ---- more of Africa, Asia and the Caribbean ---- */

export const FILIPINO: Accent = {
  id: 'filipino',
  name: 'Filipino',
  region: 'Asia',
  rhotic: true,
  // a five-vowel system, rhotic with a tap, syllable-timed
  sets: {
    KIT: 'i', DRESS: 'ɛ', TRAP: 'a', BATH: 'a', LOT: 'ɔ', CLOTH: 'ɔ', STRUT: 'a', FOOT: 'u', NURSE: 'ɛɾ',
    FLEECE: 'i', FACE: 'e', PALM: 'a', THOUGHT: 'ɔ', GOAT: 'o', GOOSE: 'u', PRICE: 'aɪ', CHOICE: 'ɔɪ',
    MOUTH: 'aʊ', NEAR: 'iɾ', SQUARE: 'ɛɾ', START: 'aɾ', NORTH: 'ɔɾ', FORCE: 'oɾ', CURE: 'uɾ', happY: 'i',
    lettER: 'ɛɾ', commA: 'a',
  },
  hold: 0.5,
  t: 'released',
  l: 'clear',
  th: 'stop',
  r: 'tap',
  prosody: { tune: 'fall', range: 4.5, declination: 1.5, rate: 1.05, stressRatio: 1.15 },
};

export const GHANAIAN: Accent = {
  id: 'ghanaian',
  name: 'Ghanaian',
  region: 'Africa',
  rhotic: false,
  sets: {
    KIT: 'i', DRESS: 'ɛ', TRAP: 'a', BATH: 'a', LOT: 'ɔ', CLOTH: 'ɔ', STRUT: 'a', FOOT: 'u', NURSE: 'ɛ',
    FLEECE: 'i', FACE: 'e', PALM: 'a', THOUGHT: 'ɔ', GOAT: 'o', GOOSE: 'u', PRICE: 'aɪ', CHOICE: 'ɔɪ',
    MOUTH: 'aʊ', NEAR: 'ia', SQUARE: 'ɛ', START: 'a', NORTH: 'ɔ', FORCE: 'ɔ', CURE: 'ua', happY: 'i',
    lettER: 'a', commA: 'a',
  },
  hold: 0.5,
  t: 'released',
  l: 'clear',
  th: 'stop',
  r: 'approximant',
  prosody: { tune: 'fall', range: 5, declination: 1.5, rate: 1, stressRatio: 1.1 },
};

export const KENYAN: Accent = {
  id: 'kenyan',
  name: 'Kenyan',
  region: 'Africa',
  rhotic: false,
  // five vowels, as in Swahili; th kept as a fricative
  sets: {
    KIT: 'i', DRESS: 'e', TRAP: 'a', BATH: 'a', LOT: 'ɔ', CLOTH: 'ɔ', STRUT: 'a', FOOT: 'u', NURSE: 'e',
    FLEECE: 'i', FACE: 'e', PALM: 'a', THOUGHT: 'ɔ', GOAT: 'o', GOOSE: 'u', PRICE: 'aɪ', CHOICE: 'ɔɪ',
    MOUTH: 'aʊ', NEAR: 'ia', SQUARE: 'ea', START: 'a', NORTH: 'ɔ', FORCE: 'ɔ', CURE: 'ua', happY: 'i',
    lettER: 'a', commA: 'a',
  },
  hold: 0.5,
  t: 'released',
  l: 'clear',
  th: 'fricative',
  r: 'tap',
  prosody: { tune: 'fall', range: 4, declination: 1.5, rate: 1, stressRatio: 1.15 },
};

export const TRINIDADIAN: Accent = {
  id: 'trinidadian',
  name: 'Trinidadian',
  region: 'Caribbean',
  rhotic: false,
  sets: {
    KIT: 'ɪ', DRESS: 'ɛ', TRAP: 'a', BATH: 'a', LOT: 'ɒ', CLOTH: 'ɒ', STRUT: 'ɔ', FOOT: 'ʊ', NURSE: 'ɜ',
    FLEECE: 'i', FACE: 'e', PALM: 'a', THOUGHT: 'ɒ', GOAT: 'o', GOOSE: 'u', PRICE: 'aɪ', CHOICE: 'ɒɪ',
    MOUTH: 'ɔʊ', NEAR: 'iɛ', SQUARE: 'ɛ', START: 'a', NORTH: 'ɒ', FORCE: 'o', CURE: 'ʊə', happY: 'i',
    lettER: 'a', commA: 'a',
  },
  hold: 0.5,
  t: 'released',
  l: 'clear',
  th: 'stop',
  r: 'approximant',
  // a lively, wide melody
  prosody: { tune: 'rise', range: 7, declination: 1.5, rate: 1.1, stressRatio: 1.3 },
};

/* ---- Europe: English as a second language ---- */

export const RUSSIAN: Accent = {
  id: 'russian',
  name: 'Russian',
  region: 'Europe',
  rhotic: true,
  // Russian's five vowels and ɨ: KIT and FLEECE merge, TRAP is ɛ, STRUT a, and unstressed vowels keep
  // more of their quality than English reduction leaves them
  sets: {
    KIT: 'i', DRESS: 'ɛ', TRAP: 'ɛ', BATH: 'a', LOT: 'ɔ', CLOTH: 'ɔ', STRUT: 'a', FOOT: 'u', NURSE: 'ɵɾ',
    FLEECE: 'i', FACE: 'ei', PALM: 'a', THOUGHT: 'ɔ', GOAT: 'o', GOOSE: 'u', PRICE: 'aɪ', CHOICE: 'ɔɪ',
    MOUTH: 'aʊ', NEAR: 'i', SQUARE: 'ɛ', START: 'a', NORTH: 'ɔ', FORCE: 'ɔ', CURE: 'u', happY: 'i',
    lettER: 'ɛɾ', commA: 'a',
  },
  hold: 0.5,
  t: 'released',
  // Russian's hard l is velarized everywhere
  l: 'dark',
  th: 'sibilant',
  r: 'tap',
  // no w in Russian: "west" as vest
  replace: { w: 'v' },
  devoiceFinal: true,
  prosody: { tune: 'fall', range: 6, declination: 2.5, rate: 0.95, stressRatio: 1.7 },
};

/** The regions the built-in accents are grouped in, in display order. */
export const ACCENT_REGIONS: readonly string[] = ['North America', 'England', 'Scotland, Wales and Ireland', 'Southern hemisphere', 'Africa', 'Caribbean', 'Asia', 'Europe'];

/** The built-in accents, by id. */
export const ACCENTS: Readonly<Record<string, Accent>> = Object.freeze(
  Object.fromEntries(
    [
      GENERAL_AMERICAN, CANADIAN, CALIFORNIAN, NEW_YORK, BOSTON, INLAND_NORTH, SOUTHERN_US,
      RECEIVED_PRONUNCIATION, SOUTHERN_BRITISH, LONDON, WEST_COUNTRY, BRUMMIE, SCOUSE, NORTHERN_ENGLISH,
      GEORDIE, SCOTTISH, WELSH, IRISH, NORTHERN_IRISH,
      AUSTRALIAN, NEW_ZEALAND, SOUTH_AFRICAN,
      NIGERIAN, GHANAIAN, KENYAN, JAMAICAN, TRINIDADIAN, INDIAN, SINGAPOREAN, FILIPINO,
      RUSSIAN,
    ].map((a) => [a.id, a]),
  ),
);

/** An accent by id, or the accent itself; General American when left out. Throws on an unknown id. */
export function resolveAccent(accent: Accent | string | undefined): Accent {
  if (accent === undefined) return GENERAL_AMERICAN;
  if (typeof accent !== 'string') return accent;
  const found = ACCENTS[accent];
  if (!found) throw new Error(`unknown accent "${accent}"; built in: ${Object.keys(ACCENTS).join(', ')}`);
  return found;
}

/** A realization read into its vowels and the r after them. */
export interface Realization {
  vowels: string[];
  /** The r the accent says after the vowel, or undefined. */
  r?: string;
}

const LENGTH = /[ːˑ:]/g;

/** "əʊ" to { vowels: ['ə', 'ʊ'] }, "ʌɾ" to { vowels: ['ʌ'], r: 'ɾ' }. */
export function readRealization(ipa: string): Realization {
  const chars = Array.from(ipa.replace(LENGTH, ''));
  let r: string | undefined;
  const last = chars[chars.length - 1];
  if (last === 'ɹ' || last === 'ɾ' || last === 'r') {
    r = last === 'r' ? 'ɹ' : last;
    chars.pop();
  }
  const vowels = chars.filter((c) => isVowel(c));
  if (vowels.length === 0 || vowels.length > 2 || vowels.length !== chars.length) {
    throw new Error(`accent realization "${ipa}" is not one or two vowels and an optional r`);
  }
  return { vowels, r };
}

const R_SOUNDS = new Set(['ɹ', 'ɾ', 'r']);

/**
 * Re-voice the English syllables of a lyric in `accent`, in place: vowels by lexical set, r after a
 * vowel, th, r and h. The t and l rules belong to the allophone pass that follows (allophones.ts),
 * since they need the same neighbours flapping does. `english` says which syllables the English
 * reader produced; the rest are left alone.
 */
export function applyAccent(syllables: readonly Syllable[], english: (s: Syllable) => boolean, accent: Accent): void {
  for (let i = 0; i < syllables.length; i++) {
    const syl = syllables[i];
    if (!english(syl) || syl.melisma) continue;
    const next = syllables[i + 1];
    const linked = !syl.phraseEnd && next !== undefined && english(next) && !next.melisma && next.onset.length === 0;
    // the consonant after the vowel in the same word, for raising
    const after = syl.coda[0] ?? (!syl.wordEnd && next !== undefined ? next.onset[0] : undefined);
    const beforeVoiceless = after !== undefined && VOICELESS.has(after.ipa);
    voiceVowel(syl, accent, linked, beforeVoiceless);
    consonants(syl, accent, i === 0 || syllables[i - 1].wordEnd);
  }
}

const VOICELESS = new Set(['p', 't', 'k', 'f', 'θ', 's', 'ʃ', 'tʃ', 'h']);

function voiceVowel(syl: Syllable, accent: Accent, linked: boolean, beforeVoiceless: boolean): void {
  const n = syl.nucleus;
  const set = n.set;
  const raised = set !== undefined && beforeVoiceless ? accent.raised?.[set] : undefined;
  const spec = raised ?? (set === undefined ? undefined : accent.sets[set]);
  // an r-colored General American vowel loses its color in an accent that names its set
  const hadR = n.ipa === 'ɝ' || n.ipa === 'ɚ';
  if (spec !== undefined) {
    const real = readRealization(spec);
    n.ipa = real.vowels.join('');
    if (real.r !== undefined) {
      const r = accent.r === 'tap' ? 'ɾ' : real.r;
      if (syl.coda.length > 0 && R_SOUNDS.has(syl.coda[0].ipa)) syl.coda[0].ipa = r;
      else syl.coda.unshift({ ipa: r });
    } else if (hadR && !accent.rhotic && linked) {
      // linking r: "better off", "her own"
      syl.coda.unshift({ ipa: 'ɹ' });
    }
  }
  if (!accent.rhotic) dropCodaR(syl, linked);
  if (Array.from(n.ipa).length === 2 && set !== undefined) {
    const hold = accent.holds?.[set] ?? accent.hold;
    if (hold !== undefined) n.hold = Math.max(0, Math.min(1, hold));
  }
}

/** A non-rhotic accent says r only before a vowel: "car" and "card" lose it, "far away" keeps it. */
function dropCodaR(syl: Syllable, linked: boolean): void {
  for (let k = syl.coda.length - 1; k >= 0; k--) {
    if (!R_SOUNDS.has(syl.coda[k].ipa)) continue;
    const last = k === syl.coda.length - 1;
    if (last && linked) continue;
    syl.coda.splice(k, 1);
  }
}

const DEVOICE: Readonly<Record<string, string>> = { b: 'p', d: 't', g: 'k', v: 'f', z: 's', ð: 'θ', ʒ: 'ʃ', dʒ: 'tʃ' };

function consonants(syl: Syllable, accent: Accent, wordStart: boolean): void {
  const parts: Segment[][] = [syl.onset, syl.coda];
  for (const segs of parts) {
    for (let k = 0; k < segs.length; k++) {
      const s = segs[k];
      const first = wordStart && segs === syl.onset && k === 0;
      if (accent.th === 'stop') {
        if (s.ipa === 'θ') s.ipa = 't';
        else if (s.ipa === 'ð') s.ipa = 'd';
      } else if (accent.th === 'front') {
        if (s.ipa === 'θ') s.ipa = 'f';
        else if (s.ipa === 'ð') s.ipa = first ? 'd' : 'v';
      } else if (accent.th === 'sibilant') {
        if (s.ipa === 'θ') s.ipa = 's';
        else if (s.ipa === 'ð') s.ipa = 'z';
      }
      if (accent.r === 'tap' && s.ipa === 'ɹ') s.ipa = 'ɾ';
      const swap = accent.replace?.[s.ipa];
      if (swap !== undefined) s.ipa = swap;
    }
  }
  // word-final devoicing: the last consonants of a word, back to the first that is not voiced
  if (accent.devoiceFinal && syl.wordEnd) {
    for (let k = syl.coda.length - 1; k >= 0; k--) {
      const v = DEVOICE[syl.coda[k].ipa];
      if (v === undefined) break;
      syl.coda[k].ipa = v;
    }
  }
  if (accent.hDrop && wordStart && syl.onset.length > 0 && syl.onset[0].ipa === 'h') syl.onset.shift();
}
