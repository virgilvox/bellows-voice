/*
 * Starter voices: who is singing, as data. A voice is the vocal engine's params plus the two facts a
 * line needs that the engine cannot know: where the speaking voice sits (speak()'s default pitch)
 * and the range it sings in. Each value comes from published norms or from this voice's own
 * measurements (docs/VOICE-NORMS.md), and each preset says which.
 *
 * Speaking pitch. Mean conversational F0 is 115 Hz (SD 21) for men and 199 Hz (SD 28) for women
 * (Leung et al. 2022, the Sydney Voice Lab's reference sheet); typical ranges are 85 to 155 Hz for
 * men, 165 to 255 Hz for women and 208 to 259 Hz for a child of ten (Baken 1987). A child's 240 here
 * is inside Baken's range.
 *
 * Singing ranges are the classical voice types' (bass E2 to E4, baritone A2 to A4, tenor C3 to C5,
 * contralto F3 to F5, mezzo-soprano A3 to A5, soprano C4 to C6), as the standard references give
 * them; a child treble sings about A3 to A5.
 *
 * Vibrato. Classical vibrato runs at 4 to 7 Hz with an extent near a semitone either side
 * (reviewed in PMC9510150); pop singers use little or none. The engine's vibratoDepth is the extent
 * in semitones.
 *
 * Source. Measured on this voice (docs/VOICE-NORMS.md): roughness 0.02 on the pulse folds gives
 * healthy jitter and shimmer for every body; older voices show more shimmer and a less steady pitch
 * (the age studies in that document), which the elder preset raises roughness and drift for. Women's
 * voices are on average breathier than men's (a longer open phase and more aspiration noise, Klatt
 * and Klatt 1990, Hanson 1997), which the female presets carry as a little more breath.
 */

/** Which body a voice is: the size of the tract and folds. */
export type VoiceGroup = 'male' | 'female' | 'child';

export interface VoicePreset {
  id: string;
  name: string;
  group: VoiceGroup;
  /** One line on what it is for. */
  description: string;
  /** The vocal engine's params; anything left out keeps the engine's default. */
  params: Record<string, number>;
  /** speak()'s default baseline pitch, Hz. */
  speechHz: number;
  /** The comfortable singing range, MIDI note numbers, low and high. */
  range: [number, number];
}

/** The conversational F0 norms by body: men, women, children (see the header). */
export const SPEECH_HZ_BY_BODY: readonly [number, number, number] = [115, 199, 240];

/** speak()'s default pitch for a body, 0 male to 1 female to 2 child, interpolated. */
export function speechHzForBody(body: number): number {
  const b = Math.max(0, Math.min(2, Number.isFinite(body) ? body : 0));
  const i = Math.min(1, Math.floor(b));
  const t = b - i;
  return SPEECH_HZ_BY_BODY[i] + t * (SPEECH_HZ_BY_BODY[i + 1] - SPEECH_HZ_BY_BODY[i]);
}

export const VOICE_PRESETS: readonly VoicePreset[] = [
  {
    id: 'narrator-male',
    name: 'Narrator (male)',
    group: 'male',
    description: 'a steady, clear speaking voice at the male conversational mean',
    params: { body: 0, vibratoDepth: 0, drift: 4, roughness: 0.02, breath: 0.12, tension: 0.5 },
    speechHz: 115,
    range: [43, 64],
  },
  {
    id: 'narrator-female',
    name: 'Narrator (female)',
    group: 'female',
    description: 'a steady, clear speaking voice at the female conversational mean',
    params: { body: 1, vibratoDepth: 0, drift: 4, roughness: 0.02, breath: 0.2, tension: 0.5 },
    speechHz: 199,
    range: [55, 76],
  },
  {
    id: 'child',
    name: 'Child',
    group: 'child',
    description: 'a child of about ten: the smallest tract, a high light voice',
    params: { body: 2, vibratoDepth: 0.1, drift: 6, roughness: 0.02, breath: 0.2, tension: 0.5 },
    speechHz: 240,
    range: [57, 81],
  },
  {
    id: 'bass',
    name: 'Bass',
    group: 'male',
    description: 'the lowest classical voice, E2 to E4, dark and slow to move',
    params: { body: 0, tension: 0.6, breath: 0.1, vibratoRate: 5.2, vibratoDepth: 0.5, glide: 0.2, ring: 0.5 },
    speechHz: 98,
    range: [40, 64],
  },
  {
    id: 'baritone',
    name: 'Baritone',
    group: 'male',
    description: 'the middle male voice, A2 to A4',
    params: { body: 0, tension: 0.58, breath: 0.12, vibratoRate: 5.5, vibratoDepth: 0.45, ring: 0.4 },
    speechHz: 110,
    range: [45, 69],
  },
  {
    id: 'tenor',
    name: 'Tenor',
    group: 'male',
    description: 'the high male voice, C3 to C5: a slightly shorter tract, brighter and pressed',
    params: { body: 0.15, tension: 0.65, breath: 0.1, vibratoRate: 5.8, vibratoDepth: 0.45, ring: 0.6, tuning: 0.4 },
    speechHz: 130,
    range: [48, 72],
  },
  {
    id: 'contralto',
    name: 'Contralto',
    group: 'female',
    description: 'the lowest female voice, F3 to F5, warm and dark',
    params: { body: 0.85, tension: 0.55, breath: 0.15, vibratoRate: 5.4, vibratoDepth: 0.45, ring: 0.4 },
    speechHz: 180,
    range: [53, 77],
  },
  {
    id: 'mezzo',
    name: 'Mezzo-soprano',
    group: 'female',
    description: 'the middle female voice, A3 to A5',
    params: { body: 0.95, tension: 0.58, breath: 0.15, vibratoRate: 5.6, vibratoDepth: 0.5, ring: 0.5, tuning: 0.5 },
    speechHz: 195,
    range: [57, 81],
  },
  {
    id: 'soprano',
    name: 'Soprano',
    group: 'female',
    description: 'the highest classical voice, C4 to C6, with the jaw opening on high notes as trained sopranos do',
    params: { body: 1, tension: 0.62, breath: 0.12, vibratoRate: 5.8, vibratoDepth: 0.55, ring: 0.6, tuning: 1, overshoot: 0.12 },
    speechHz: 215,
    range: [60, 84],
  },
  {
    id: 'pop-female',
    name: 'Pop (female)',
    group: 'female',
    description: 'light, breathy and close, little vibrato and that only on long notes',
    params: { body: 1, tension: 0.45, breath: 0.32, vibratoRate: 6, vibratoDepth: 0.15, vibratoDelay: 0.45, overshoot: 0.06, glide: 0.12 },
    speechHz: 205,
    range: [55, 76],
  },
  {
    id: 'pop-male',
    name: 'Pop (male)',
    group: 'male',
    description: 'a light male pop voice, breathier than the classical ones, little vibrato',
    params: { body: 0.1, tension: 0.5, breath: 0.25, vibratoRate: 6, vibratoDepth: 0.12, vibratoDelay: 0.45, overshoot: 0.06, glide: 0.12 },
    speechHz: 120,
    range: [48, 69],
  },
  {
    id: 'rock',
    name: 'Rock (gravel)',
    group: 'male',
    description: 'pressed and rough, with creak at the bottom of the voice',
    params: { body: 0, tension: 0.8, breath: 0.1, roughness: 0.18, fry: 0.35, vibratoDepth: 0.15, overshoot: 0.1 },
    speechHz: 115,
    range: [45, 69],
  },
  {
    id: 'elder',
    name: 'Elder',
    group: 'male',
    description: 'an older man: more shimmer, a wandering pitch, a slow wide wobble',
    params: { body: 0, tension: 0.4, breath: 0.25, roughness: 0.15, drift: 12, vibratoRate: 4.6, vibratoDepth: 0.5, vibratoDelay: 0.1 },
    speechHz: 125,
    range: [43, 62],
  },
];

/** A preset by id; undefined if there is none. */
export function voicePreset(id: string): VoicePreset | undefined {
  return VOICE_PRESETS.find((v) => v.id === id);
}
