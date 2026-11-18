/*
 * Voice settings and anatomy: the shape of a voice's mouth beyond the sounds it makes.
 *
 * A setting is a long-term posture laid over every sound, Laver's articulatory setting (J. Laver,
 * The Phonetic Description of Voice Quality, 1980; summarized by Esling): the jaw held open or close,
 * the tongue fronted or backed, the lips rounded or spread, the larynx raised or lowered, the velum
 * lowered (nasal), the epilarynx narrowed (twang), the throat opened or constricted. An accent and a
 * singing style are partly settings: Liverpool's backed tongue, a pop singer's raised larynx, an
 * opera singer's lowered larynx and open throat.
 *
 * The anatomy is the tract's size: `size` scales the whole tube, so every formant goes as 1 / size
 * (a uniform tube's resonances are (2n - 1) c / 4L; formant spacing tracks vocal tract length, Fitch
 * 1997, and the length grows with body size, Fitch and Giedd 1999), and `pharynx` scales the throat
 * alone, which is most of what separates adult men's formant pattern from women's (Fitch and Giedd 1999).
 *
 * The engine (engines/vocal.ts), the mouth view (view/tract.ts) and the helpers read this one table,
 * so a setting means the same posture everywhere. Pure data and arithmetic: no audio, no allocation
 * in settingOffsets().
 */

import { ART, ARTICULATORS } from './vocal-articulators';

export interface VoiceSetting {
  /** The engine param. */
  param: string;
  /** What to call it. */
  name: string;
  /** The ends of its range, in words. */
  low: string;
  high: string;
  min: number;
  max: number;
  /** What it does, for anyone. */
  plain: string;
  /** What it does to the sound, in acoustic terms. */
  acoustics: string;
  /** Anatomy (set before a line) rather than a posture. */
  anatomy?: boolean;
  /** The value that leaves the voice as it is (0 unless given). */
  neutral?: number;
  /** What it describes, for a sentence ("tongue", "voice box"). */
  subject: string;
  /** The ends said strongly, where "very" does not fit ("pushed far forward"); left out, the helpers build them. */
  strong?: [low: string, high: string];
}

export const VOICE_SETTINGS: readonly VoiceSetting[] = [
  {
    subject: 'head', param: 'size', name: 'Head size', low: 'smaller', high: 'bigger', min: 0.8, max: 1.25, anatomy: true, neutral: 1,
    plain: 'A bigger or smaller head and throat: bigger sounds deeper and larger, like a bigger person.',
    acoustics: 'Scales the whole tube, so every resonance moves as 1 / size (Fitch and Giedd 1999).',
  },
  {
    subject: 'throat', param: 'pharynx', name: 'Throat length', low: 'shorter', high: 'longer', min: 0.8, max: 1.25, anatomy: true, neutral: 1,
    plain: 'A longer or shorter throat behind the mouth. A long throat is much of what makes a man\'s voice sound like one.',
    acoustics: 'Lengthens the back cavity: lowers F1 and pulls F2 down in front vowels.',
  },
  {
    subject: 'throat pockets', param: 'piriform', name: 'Throat pockets', low: 'off', high: 'on', min: 0, max: 1, anatomy: true, strong: ['off', 'on'],
    plain: 'Two small pockets beside the voice box that every throat has. On, the voice loses a little of its hard top edge.',
    acoustics: 'The piriform fossae as a side branch: a dip at 4 to 6 kHz (Dang and Honda 1997). Off by default until the vowels are re-solved with them, since they also lower F1.',
  },
  {
    subject: 'jaw', param: 'jawSet', name: 'Jaw', low: 'held close', high: 'hanging open', min: -1, max: 1, strong: ['clenched', 'hanging wide open'],
    plain: 'How far the jaw hangs open over everything. Open sounds loud and open; close sounds tight and mumbled.',
    acoustics: 'Opening widens the front of the mouth: raises F1 in every vowel.',
  },
  {
    subject: 'tongue', param: 'tongueFront', name: 'Tongue forward', low: 'pulled back', high: 'pushed forward', min: -1, max: 1, strong: ['pulled far back', 'pushed far forward'],
    plain: 'Where the tongue rests. Forward sounds bright and young; back sounds dark, as if swallowed.',
    acoustics: 'Fronting raises F2; backing lowers it (a velarized setting).',
  },
  {
    subject: 'tongue', param: 'tongueHigh', name: 'Tongue height', low: 'low', high: 'high', min: -1, max: 1,
    plain: 'How high the tongue sits in the mouth. High sounds tight and close; low sounds open.',
    acoustics: 'Raising lowers F1 (and raises F2 when the tongue is forward).',
  },
  {
    subject: 'lips', param: 'lipRound', name: 'Lips', low: 'smiling', high: 'pouting', min: -1, max: 1,
    plain: 'A smile in the voice, or a pout. You can hear a smile: it brightens everything.',
    acoustics: 'Rounding and protruding lengthen the tube and narrow its end, so the formants fall (MEASURED on /ɛ/ at 1: F1 -9, F2 -4, F3 -1 percent). Spreading does the opposite, less.',
  },
  {
    subject: 'lips', param: 'lipOpen', name: 'Lip opening', low: 'nearly closed', high: 'wide', min: -1, max: 1, strong: ['almost shut', 'very wide'],
    plain: 'How far apart the lips stay. Nearly closed sounds muffled, as when talking through a smile you are hiding.',
    acoustics: 'A narrower lip opening lowers every formant and the level of the highs.',
  },
  {
    subject: 'voice box', param: 'larynxSet', name: 'Voice box', low: 'lowered', high: 'raised', min: -1, max: 1,
    plain: 'Where the voice box sits in the neck. Lowered sounds big, dark and operatic; raised sounds small, bright and tense, like a cartoon.',
    acoustics: 'Moving the larynx changes the tube\'s length: raising it shortens the tract and lifts every formant.',
  },
  {
    subject: 'voice', param: 'nasal', name: 'Nasal', low: 'clear', high: 'through the nose', min: 0, max: 1, strong: ['clear', 'right through the nose'],
    plain: 'Lets sound leak through the nose, as with a blocked-up or whiny voice.',
    acoustics: 'Lowers the velum: the nasal branch adds anti-resonances and raises and widens F1 (MEASURED: /ə/ F1 466 to 558 Hz at 1).',
  },
  {
    subject: 'twang', param: 'twang', name: 'Twang', low: 'none', high: 'brassy', min: 0, max: 1, strong: ['none', 'very brassy'],
    plain: 'A slight brassy edge, toward a belt or a country singer.',
    acoustics: 'Narrows the tube just above the folds (the epilarynx), toward more energy near 2 to 4 kHz (Yanagisawa et al. 1989); in this geometry only about 1 dB (MEASURED), since the epilarynx is not yet a resonator of its own.',
  },
  {
    subject: 'throat', param: 'throat', name: 'Throat', low: 'squeezed', high: 'open', min: -1, max: 1,
    plain: 'An open throat, as singers are taught, sounds round and full; a squeezed one sounds strained.',
    acoustics: 'Moves the tongue root forward (and the larynx down) or back into the pharynx: an open throat lowers F1 a little and evens the low formants.',
  },
  {
    subject: 'cheeks', param: 'cheeks', name: 'Cheeks', low: 'firm', high: 'slack', min: 0, max: 1,
    plain: 'How soft the cheeks are. Slack cheeks puff out as air builds up, so "b", "d" and "g" keep their hum longer.',
    acoustics: 'Softens the oral walls toward Ishizaka et al.\'s (1975) relaxed cheek: more compliance behind a closure, a longer voice bar.',
  },
];

/** A setting's value, 0 when missing or not finite. */
function v(x: number | undefined): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0;
}

/** A setting by param name. */
export function voiceSetting(param: string): VoiceSetting | undefined {
  return VOICE_SETTINGS.find((s) => s.param === param);
}

/** The posture settings' values, 0 where left out. */
export interface SettingValues {
  jawSet?: number;
  tongueFront?: number;
  tongueHigh?: number;
  lipRound?: number;
  lipOpen?: number;
  larynxSet?: number;
  nasal?: number;
  twang?: number;
  throat?: number;
}

/**
 * The posture settings as offsets on the 17 articulators, into `out`. The scales are this voice's,
 * chosen so 1 is strong but plausible; the formant shift of each is measured against the direction
 * acoustic theory gives (test/engines-physical/anatomy.test.ts).
 */
export function settingOffsets(st: SettingValues, out: Float64Array): void {
  out.fill(0);
  if (out.length < ARTICULATORS) return;
  // the jaw carries the tongue and the lower lip with it (as the formant tuning in vocal.ts does):
  // opened alone, with the tongue body fixed in the head, it left F1 where it was (MEASURED)
  const jaw = v(st.jawSet);
  out[ART.jaw] = 0.6 * jaw;
  out[ART.tbX] = 0.6 * v(st.tongueFront);
  out[ART.tbY] = 0.5 * v(st.tongueHigh) - 0.5 * jaw;
  const r = v(st.lipRound);
  if (r > 0) {
    out[ART.lipProt] = 0.6 * r;
    out[ART.lipWidth] = -0.5 * r;
    out[ART.lipAp] = -0.15 * r;
  } else {
    out[ART.lipWidth] = -0.6 * r;
    out[ART.lipProt] = 0.15 * r;
    out[ART.lipAp] = -0.1 * r;
  }
  out[ART.lipAp] += 0.4 * v(st.lipOpen) + 0.3 * jaw;
  const throat = v(st.throat);
  out[ART.larynx] = 0.9 * v(st.larynxSet) + 0.3 * v(st.twang) - 0.4 * (throat > 0 ? throat : 0);
  out[ART.epilarynx] = 0.8 * v(st.twang);
  out[ART.root] = 0.6 * throat;
  out[ART.velum] = 0.7 * v(st.nasal);
}

/** A mouth shape anyone can pick: settings and anatomy together. */
export interface ShapePreset {
  id: string;
  name: string;
  /** What it sounds like, in a line. */
  plain: string;
  values: Record<string, number>;
}

export const SHAPE_PRESETS: readonly ShapePreset[] = [
  { id: 'neutral', name: 'Neutral', plain: 'The voice as it is.', values: {} },
  { id: 'smile', name: 'Smile', plain: 'Talking while smiling: brighter and friendlier.', values: { lipRound: -0.8, tongueFront: 0.3, larynxSet: 0.15 } },
  { id: 'pout', name: 'Pout', plain: 'Lips pushed forward: darker and softer.', values: { lipRound: 0.8 } },
  { id: 'operatic', name: 'Operatic', plain: 'A lowered larynx and open throat: big, round and dark.', values: { larynxSet: -0.7, throat: 0.7, lipRound: 0.25, jawSet: 0.3 } },
  { id: 'belt', name: 'Brassy belt', plain: 'Twang and a high larynx: cutting and bright.', values: { twang: 0.8, larynxSet: 0.35, jawSet: 0.3, lipRound: -0.3 } },
  { id: 'nasal', name: 'Nasal', plain: 'Through the nose, whiny.', values: { nasal: 0.6, larynxSet: 0.2 } },
  { id: 'muffled', name: 'Muffled', plain: 'Jaw and lips nearly shut, tongue back: hard to hear.', values: { jawSet: -0.7, lipOpen: -0.6, tongueFront: -0.4 } },
  { id: 'tense', name: 'Tense', plain: 'A squeezed throat and raised larynx: strained.', values: { throat: -0.7, larynxSet: 0.6, tongueHigh: 0.3 } },
  { id: 'giant', name: 'Giant', plain: 'A much bigger head and longer throat: deep and huge.', values: { size: 1.22, pharynx: 1.15, larynxSet: -0.5 } },
  { id: 'tiny', name: 'Tiny', plain: 'A small head and short throat: small and bright, like a cartoon.', values: { size: 0.82, pharynx: 0.85, larynxSet: 0.6 } },
];
