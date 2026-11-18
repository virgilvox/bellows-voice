/*
 * The voice explained in everyday words, for people who are not phoneticians: how the mouth makes a
 * sound, what vowel a pair of resonances sounds like, and what a mouth shape will do to a voice.
 * Pure data and text: no audio, no bellows, part of 'bellows-voice/text'.
 */

import { VOICE_SETTINGS } from './engines/vocal-settings';
import { VOCAL_BEATS } from './engines/vocal-beats';

/* Where in the mouth, in words, and the consonants made there. */
const PLACE: Record<string, string> = {
  bilabial: 'the two lips',
  labiodental: 'the lower lip against the upper teeth',
  dental: 'the tongue tip against the upper teeth',
  alveolar: 'the tongue tip against the ridge behind the upper teeth',
  postalveolar: 'the front of the tongue just behind the ridge behind the upper teeth, lips a little rounded',
  palatal: 'the middle of the tongue against the hard roof of the mouth',
  velar: 'the back of the tongue against the soft palate',
  glottal: 'the vocal folds themselves',
};

/* manner, place, voiced: the consonants the voice has. */
const CONSONANTS: Record<string, [string, string, boolean, string]> = {
  p: ['stop', 'bilabial', false, 'pin'], b: ['stop', 'bilabial', true, 'bin'],
  t: ['stop', 'alveolar', false, 'tin'], d: ['stop', 'alveolar', true, 'din'],
  k: ['stop', 'velar', false, 'kin'], g: ['stop', 'velar', true, 'go'],
  f: ['fricative', 'labiodental', false, 'fan'], v: ['fricative', 'labiodental', true, 'van'],
  θ: ['fricative', 'dental', false, 'thin'], ð: ['fricative', 'dental', true, 'this'],
  s: ['fricative', 'alveolar', false, 'sip'], z: ['fricative', 'alveolar', true, 'zip'],
  ʃ: ['fricative', 'postalveolar', false, 'ship'], ʒ: ['fricative', 'postalveolar', true, 'measure'],
  h: ['fricative', 'glottal', false, 'hat'],
  tʃ: ['affricate', 'postalveolar', false, 'chin'], dʒ: ['affricate', 'postalveolar', true, 'gin'],
  m: ['nasal', 'bilabial', true, 'man'], n: ['nasal', 'alveolar', true, 'no'], ŋ: ['nasal', 'velar', true, 'sing'],
  l: ['lateral', 'alveolar', true, 'let'], ɫ: ['lateral', 'alveolar', true, 'tell'],
  ɹ: ['approximant', 'alveolar', true, 'red'], w: ['approximant', 'bilabial', true, 'wet'], j: ['approximant', 'palatal', true, 'yes'],
  ɾ: ['tap', 'alveolar', true, "the t in American 'water'"], ʔ: ['stop', 'glottal', false, "the catch in 'uh-oh'"],
};

/* height (0 close .. 3 open), backness (0 front .. 2 back), rounded, an example word. */
const VOWELS: Record<string, [number, number, boolean, string]> = {
  i: [0, 0, false, 'heed'], ɪ: [0.7, 0.2, false, 'hid'], e: [1, 0, false, 'hay (its start)'], ɛ: [2, 0, false, 'head'],
  æ: [2.7, 0, false, 'had'], a: [3, 0.5, false, 'high (its start)'], ɑ: [3, 2, false, 'hod, father'], ɒ: [3, 2, true, "British 'hot'"],
  ɔ: [2, 2, true, 'hawed'], o: [1, 2, true, 'hoe (its start)'], ʊ: [0.7, 1.8, true, 'hood'], u: [0, 2, true, "who'd"],
  ʌ: [2, 1.5, false, 'hud'], ɚ: [1.5, 1, false, "the er in 'butter'"], ə: [1.5, 1, false, "the a in 'about'"], ɝ: [1.5, 1, false, 'heard'], ɐ: [2.5, 1, false, "Australian 'cut'"],
  ɜ: [2, 1, false, "British 'nurse'"], ʉ: [0, 1, true, "Australian 'goose'"], ɨ: [0, 1, false, "Russian 'ты'"], ɘ: [1, 1, false, "a central 'e'"],
  ɵ: [1, 1, true, "New Zealand 'foot'"], y: [0, 0, true, "French 'tu'"], ø: [1, 0, true, "French 'peu'"], œ: [2, 0, true, "French 'peur'"],
  ɯ: [0, 2, false, "Japanese 'u'"], ɤ: [1, 2, false, "an unrounded 'o'"],
};

/**
 * How the mouth makes a sound, in plain words: an IPA symbol the voice has, or a beat token
 * ("beat:B"). Undefined for a sound it does not know.
 */
export function describeSound(ipa: string): string | undefined {
  if (ipa.startsWith('beat:')) {
    const id = ipa.slice(5).replace(/>$/, '');
    const b = VOCAL_BEATS.find((x) => x.id === id);
    return b ? `${b.name}: ${b.hint.charAt(0).toLowerCase()}${b.hint.slice(1)}.` : undefined;
  }
  if (ipa === '_') return 'Silence: the breath stops.';
  const c = CONSONANTS[ipa];
  if (c) {
    const [manner, place, voiced, word] = c;
    const where = PLACE[place];
    const voice = voiced ? 'The voice buzzes through it.' : 'The voice is off: only air.';
    const how: Record<string, string> = {
      stop: `Made with ${where}: they close completely, air builds up behind them, then they let go with a small pop.`,
      fricative: place === 'glottal' ? 'The vocal folds stay apart and air rushes between them: a breathy hiss shaped by the vowel around it.' : `Made with ${where}: they come close enough that the air hisses through the gap.`,
      affricate: `Made with ${where}: a full closure that opens into a hiss.`,
      nasal: `Made with ${where} closed while the soft palate drops, so the sound comes out through the nose.`,
      lateral: `Made with ${where}, while air flows around both sides of the tongue.`,
      approximant: ipa === 'ɹ' ? 'The tongue bunches or curls back without touching anything, lips a little rounded: the sound of an American r.' : `Made with ${where} coming close but not near enough to hiss: a gliding sound.`,
      tap: `Made with ${where} in one very quick touch.`,
    };
    return `${how[manner] ?? where} ${voice} ${asIn(word)}`;
  }
  // a long vowel ("iː") is its vowel held; a vowel glide ("aɪ", "əʊ") is described by its two ends
  const parts = Array.from(ipa.replace(/[ːˑ\u032F]/g, ''));
  if (parts.length === 1 && VOWELS[parts[0]]) {
    const [height, back, round, word] = VOWELS[parts[0]];
    return `A vowel with ${shape(height, back, round)}. The voice buzzes and the mouth's shape colours it. ${asIn(word)}`;
  }
  if (parts.length >= 2 && parts.every((p) => VOWELS[p])) {
    const a = VOWELS[parts[0]];
    const b = VOWELS[parts[parts.length - 1]];
    const word = GLIDES[ipa];
    return `A gliding vowel: it starts ${brief(a[0], a[1], a[2])} and glides toward ${brief(b[0], b[1], b[2])}.${word ? ' ' + asIn(word) : ''}`;
  }
  return undefined;
}

/* Vowel glides the readers and accents produce, with a word. */
const GLIDES: Record<string, string> = {
  eɪ: 'hay', aɪ: 'high', ɔɪ: 'boy', aʊ: 'how', oʊ: 'hoe', əʊ: "British 'go'", ɪə: "British 'near'", eə: "British 'square'",
  ʊə: "British 'cure'", ɛɪ: "Southern US 'face'", æʊ: "Southern US 'mouth'", ʌɪ: "Canadian 'price'", ʌʊ: "Canadian 'house'",
};

/** An example: a word ('As in "pin".') or a description of where to hear it ('It is the t in ...'). */
function asIn(word: string): string {
  return word.startsWith('the ') ? `It is ${word}.` : `As in "${word}".`;
}

/** A vowel's ends in a few words: "wide open with the tongue in the middle". */
function brief(height: number, back: number, round: boolean): string {
  const open = height >= 2.5 ? 'wide open' : height >= 1.5 ? 'half open' : height >= 0.5 ? 'nearly closed' : 'almost closed';
  const tongue = back <= 0.3 ? 'the tongue forward' : back >= 1.7 ? 'the tongue back' : 'the tongue in the middle';
  return `${open} with ${tongue}${round ? ' and the lips rounded' : ''}`;
}

/** A vowel's mouth in words: jaw, tongue and lips. */
function shape(height: number, back: number, round: boolean): string {
  const jaw = height >= 2.5 ? 'the jaw dropped and the mouth wide open' : height >= 1.5 ? 'the mouth half open' : height >= 0.5 ? 'the mouth nearly closed' : 'the mouth almost closed';
  const tongue = back <= 0.3 ? 'the tongue pushed forward and high' : back >= 1.7 ? 'the tongue pulled back' : 'the tongue relaxed in the middle';
  const lips = round ? 'lips rounded' : 'lips relaxed or spread';
  return `${jaw}, ${tongue}, ${lips}`;
}

/* Hillenbrand, Getty, Clark and Wheeler (1995): mean F1, F2 of men, women and children, with the hVd word. */
const HILLENBRAND: Array<[string, string, [number, number][]]> = [
  ['i', 'heed', [[342, 2322], [437, 2761], [452, 3081]]],
  ['ɪ', 'hid', [[427, 2034], [483, 2365], [511, 2552]]],
  ['e', 'hayed', [[476, 2089], [536, 2530], [564, 2656]]],
  ['ɛ', 'head', [[580, 1799], [731, 2058], [749, 2267]]],
  ['æ', 'had', [[588, 1952], [669, 2349], [717, 2501]]],
  ['ɑ', 'hod', [[768, 1333], [936, 1551], [1002, 1688]]],
  ['ɔ', 'hawed', [[652, 997], [781, 1136], [803, 1210]]],
  ['o', 'hoed', [[497, 910], [555, 1035], [597, 1137]]],
  ['ʊ', 'hood', [[469, 1122], [519, 1225], [568, 1490]]],
  ['u', "who'd", [[378, 997], [459, 1105], [494, 1345]]],
  ['ʌ', 'hud', [[623, 1200], [753, 1426], [749, 1546]]],
  ['ɝ', 'heard', [[474, 1379], [523, 1588], [586, 1719]]],
];

/**
 * The American English vowel two resonances sound most like, for a body (0 man, 1 woman, 2 child):
 * the nearest of Hillenbrand et al.'s means on the Bark scale, with the word it was recorded in.
 */
export function nearestVowel(f1: number, f2: number, body = 0): { ipa: string; word: string; distance: number } {
  const bark = (f: number) => 13 * Math.atan(0.00076 * f) + 3.5 * Math.atan((f / 7500) ** 2);
  const b = Math.max(0, Math.min(2, Math.round(body)));
  let best = { ipa: 'ə', word: 'about', distance: Infinity };
  for (const [ipa, word, rows] of HILLENBRAND) {
    const [m1, m2] = rows[b];
    const d = Math.hypot(bark(f1) - bark(m1), 0.5 * (bark(f2) - bark(m2)));
    if (d < best.distance) best = { ipa, word, distance: d };
  }
  return best;
}

/** A mouth shape (settings and anatomy, by param) in one plain sentence; '' for none. */
export function describeShape(values: Record<string, number>): string {
  const parts: string[] = [];
  for (const s of VOICE_SETTINGS) {
    const v = values[s.param];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const rest = s.neutral ?? 0;
    const d = v - rest;
    const fine = s.neutral === 1;
    if (Math.abs(d) < (fine ? 0.03 : 0.1)) continue;
    const strong = Math.abs(d) > (fine ? 0.12 : 0.6);
    const word = d > 0 ? s.high : s.low;
    // "tongue pushed far forward", "head much bigger", "voice box very lowered"
    const said = !strong ? word : s.strong ? s.strong[d > 0 ? 1 : 0] : word.endsWith('er') ? 'much ' + word : word.endsWith('ing') ? word + ' a lot' : 'very ' + word;
    parts.push(`${s.subject} ${said}`);
  }
  if (parts.length === 0) return 'A neutral mouth.';
  const text = parts.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1) + '.';
}
