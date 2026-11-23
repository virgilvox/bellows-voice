/*
 * The voice's engine on the calling thread: for renderOffline(), Node, custom kernels and study. A
 * page that plays through bellows' worklet does not need this entry, since the plugin carries the
 * engine there; importing it puts a second copy of the DSP in the page.
 */

export { registerVoice } from './register';
export { renderSpeech, type RenderSpeechOptions, type SpeechRender } from './offline';
export { ARTICULATOR_PROBE_VERSION, ARTICULATOR_FIELDS, decodeFrame, type ArticulatorFrame } from './probe/frame';
export { vocalEngine } from './engines/vocal';
export { VOCAL_PHONEMES, vocalPhonemeIndex, type VocalPhoneme } from './engines/vocal-phonemes';
export * from './dsp/glottal';
export * from './dsp/critdamp';
