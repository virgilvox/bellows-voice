/*
 * The beatbox sounds: drum sounds made on the voice's own tract with the airstreams beatboxers use.
 *
 *   pulmonic    breath from the lungs (snares, hats, crash)
 *   ejective    the glottis sealed and the larynx rising like a piston, compressing the air behind
 *               an oral closure (kick, rimshot): punchy and dry, no breath noise
 *   click       the tongue seals a pocket and hollows it; the release pops inward (velaric)
 *   ingressive  breath drawn in past a constriction (inward K snare)
 *   voiced      a hummed bass through the nose
 *
 * The sounds, their airstreams and Standard Beatbox Notation symbols follow CHIMERA by Jameson Hodge
 * (MIT, https://github.com/jamesondh/chimera-vocal-synth, crates/chimera/src/phonetics/beatbox.rs),
 * which builds each as a short gestural score. Reimplemented on bellows' planner
 * (`writeBeatScore` in engines/vocal-beat-scores.ts); 'ch' and 'Psh' are bellows' own. See THIRD_PARTY_NOTICES.md.
 *
 * On the engine's `phoneme` parameter a beat sits after the table phonemes, two indices a sound:
 * plain, then accented (louder breath, a higher larynx). '.' is the ready posture, silent, which
 * holds a pattern's rests inside one breath group.
 */

import { VOCAL_PHONEMES } from './vocal-phonemes';

export type BeatRole = 'kick' | 'snare' | 'hat' | 'perc' | 'bass' | 'rest';
export type Airstream = 'pulmonic' | 'ejective' | 'click' | 'ingressive' | 'voiced' | 'none';

export interface VocalBeat {
  /** Pattern symbol (Standard Beatbox Notation where it has one). */
  id: string;
  name: string;
  role: BeatRole;
  airstream: Airstream;
  /** What the mouth does, in a line. */
  hint: string;
  /** Whether the sound lasts as long as its step allows (open hat, crash, hum). */
  sustained: boolean;
}

export const VOCAL_BEATS: readonly VocalBeat[] = [
  { id: '.', name: 'Rest', role: 'rest', airstream: 'none', hint: 'Ready posture: jaw nearly closed, lips just apart', sustained: false },
  { id: 'B', name: 'Kick', role: 'kick', airstream: 'ejective', hint: 'Lips burst on air the rising larynx compresses', sustained: false },
  { id: 't', name: 'Hi-hat', role: 'hat', airstream: 'pulmonic', hint: 'Tongue-tip release into a short hiss', sustained: false },
  { id: 'tss', name: 'Open hat', role: 'hat', airstream: 'pulmonic', hint: 'The hi-hat left ringing as a long hiss', sustained: true },
  { id: 'Pf', name: 'Snare', role: 'snare', airstream: 'pulmonic', hint: 'Lips burst, then the lower lip hisses against the teeth', sustained: false },
  { id: 'K', name: 'Rimshot', role: 'snare', airstream: 'ejective', hint: 'Back of the tongue bursts on larynx-compressed air', sustained: false },
  { id: '^K', name: 'Inward snare', role: 'snare', airstream: 'ingressive', hint: 'A sharp breath in past the back of the tongue', sustained: false },
  { id: '!', name: 'Tongue click', role: 'perc', airstream: 'click', hint: 'Tongue seals a pocket, hollows it and pops', sustained: false },
  { id: 'P!', name: 'Lip pop', role: 'perc', airstream: 'click', hint: 'Sealed lips, the jaw drops, the lips pop open', sustained: false },
  { id: 'kch', name: 'Crash', role: 'hat', airstream: 'pulmonic', hint: 'Back-of-tongue release into a long rounded hiss', sustained: true },
  { id: 'm', name: 'Hum', role: 'bass', airstream: 'voiced', hint: 'Hummed bass note through the nose', sustained: true },
  { id: 'ch', name: 'Closed hat', role: 'hat', airstream: 'pulmonic', hint: 'Tongue-blade release into a short hush', sustained: false },
  { id: 'Psh', name: 'Psh snare', role: 'snare', airstream: 'pulmonic', hint: 'Lips burst into a rounded hush', sustained: false },
  { id: 'in', name: 'Breath in', role: 'rest', airstream: 'ingressive', hint: 'A quick breath in through an open mouth, as between phrases', sustained: true },
];

/** Where the beats start on the `phoneme` parameter: after the table phonemes. */
export const VOCAL_BEAT_BASE = VOCAL_PHONEMES.length;
/** How many `phoneme` indices the beats take (each plain and accented). */
export const VOCAL_BEAT_SLOTS = VOCAL_BEATS.length * 2;
/** Every sound on the `phoneme` parameter: the phonemes, then the beats. */
export const VOCAL_SOUND_COUNT = VOCAL_BEAT_BASE + VOCAL_BEAT_SLOTS;

/** The beat's position in VOCAL_BEATS for an id (exact, then ignoring case), or -1. */
export function vocalBeatNumber(id: string): number {
  for (let i = 0; i < VOCAL_BEATS.length; i++) if (VOCAL_BEATS[i].id === id) return i;
  const lower = id.toLowerCase();
  for (let i = 0; i < VOCAL_BEATS.length; i++) if (VOCAL_BEATS[i].id.toLowerCase() === lower) return i;
  return -1;
}

/** The `phoneme` index of a beat, plain or accented, or -1 for an unknown id. */
export function vocalBeatIndex(id: string, accent = false): number {
  const n = vocalBeatNumber(id);
  return n < 0 ? -1 : VOCAL_BEAT_BASE + 2 * n + (accent ? 1 : 0);
}

/** Whether a `phoneme` index is a beat. */
export function vocalIsBeat(idx: number): boolean {
  return idx >= VOCAL_BEAT_BASE && idx < VOCAL_SOUND_COUNT;
}

/** The prefix a sung span's IPA carries to name a beat ("beat:B", "beat:Pf>" accented). */
export const BEAT_PREFIX = 'beat:';

/** The `phoneme` index a span's sound names: a beat token or an IPA phoneme's index from `ipaIndex`. */
export function beatTokenIndex(token: string): number {
  if (!token.startsWith(BEAT_PREFIX)) return -1;
  let id = token.slice(BEAT_PREFIX.length);
  const accent = id.endsWith('>') && id.length > 1;
  if (accent) id = id.slice(0, -1);
  return vocalBeatIndex(id, accent);
}
