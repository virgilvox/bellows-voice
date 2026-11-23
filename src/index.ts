/*
 * bellows-voice: an articulatory singing and speaking voice for bellows.
 *
 *   import { Bellows } from 'bellowsjs';
 *   import { voice, singer } from 'bellows-voice';
 *
 *   const b = await Bellows.boot({ plugins: [voice] });
 *   const alto = singer(b, { body: 1 });
 *   alto.sing('twinkle twinkle little star', melody, { at: b.now() + 0.5 });
 *
 * `voice` is the plugin: the engine, prebuilt for the worklet, so a page that does not sing never
 * loads it. `singer()` plans lines and posts them through bellows' host API. The text layer is also
 * exported alone from 'bellows-voice/text', and the engine itself, for renderOffline and Node, from
 * 'bellows-voice/engine' (with renderSpeech, text to samples and articulators without an
 * AudioContext). articulatorProbe() reads the articulators of a singer as it plays.
 */

export { voice, VOCAL_ENGINE_INFO } from './plugin';
export {
  singer,
  Singer,
  type SingNote,
  type SingOptions,
  type SpeakOptions,
  type SingResult,
  type SingerOptions,
  type BeatboxOptions,
} from './singer';
export { VOICE_PRESETS, SPEECH_HZ_BY_BODY, voicePreset, speechHzForBody, type VoicePreset, type VoiceGroup } from './voices';
export { sungEvents, type SungEventOptions, type SungEvents, type SungWindow } from './sing';
export { articulatorProbe, type ArticulatorProbe, type ArticulatorProbeOptions, type ProbeTarget } from './probe/probe';
export {
  ARTICULATOR_PROBE_VERSION,
  ARTICULATOR_FIELDS,
  FRAME_STRIDE,
  PROBE_SLOTS,
  PROBE_MAX_RATE,
  decodeFrame,
  probePhonemeName,
  type ArticulatorFrame,
  type ArticulatorField,
} from './probe/frame';
export * from './text';

/* the lead the planner needs, from a small module that carries no DSP */
export { VOCAL_PLAN_LEAD, vocalGlideLead } from './engines/vocal-lead';
export { VOCAL_PHONEMES, vocalPhonemeIndex, type VocalPhoneme } from './engines/vocal-phonemes';
