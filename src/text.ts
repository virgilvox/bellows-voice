/*
 * The text layer on its own: lyrics and text to syllables and IPA, accents, pronunciation and
 * speech timing. Pure TypeScript with no audio, so `bellows-voice/text` works without bellows at
 * all (a page that only shows pronunciations, a server, a test).
 *
 * Listed rather than starred: the layer's modules also export the helpers they share with each
 * other (break constants, the syllabifier, the letter-to-sound rules), and those are not a contract.
 * readLyrics takes front ends, so the two built-in ones are exported for a caller who adds a third.
 */

export { lyricsToSyllables, readLyrics } from './lyrics/read';
export { englishFrontEnd, type EnglishOptions } from './lyrics/english';
export { ipaFrontEnd } from './lyrics/ipa-front-end';
export { tokenizeIpa } from './lyrics/ipa';
export { arpabetToSegments } from './lyrics/arpabet';
export { parseCmudict } from './lyrics/cmudict';
export { planSung, type PlanSungOptions } from './lyrics/sing';
export {
  ACCENTS,
  ACCENT_REGIONS,
  GENERAL_AMERICAN,
  SOUTHERN_BRITISH,
  LONDON,
  AUSTRALIAN,
  NEW_ZEALAND,
  IRISH,
  SCOTTISH,
  SOUTHERN_US,
  CANADIAN,
  CALIFORNIAN,
  NEW_YORK,
  NORTHERN_ENGLISH,
  GEORDIE,
  WELSH,
  NORTHERN_IRISH,
  SOUTH_AFRICAN,
  NIGERIAN,
  JAMAICAN,
  INDIAN,
  SINGAPOREAN,
  RECEIVED_PRONUNCIATION,
  SCOUSE,
  BRUMMIE,
  WEST_COUNTRY,
  BOSTON,
  INLAND_NORTH,
  FILIPINO,
  GHANAIAN,
  KENYAN,
  TRINIDADIAN,
  RUSSIAN,
  DEFAULT_PROSODY,
  resolveAccent,
  applyAccent,
  type Accent,
  type Prosody,
  type TRule,
  type LRule,
  type ThRule,
  type RRule,
} from './lyrics/accents';
export { LEXICAL_SETS, tagLexicalSets, type LexicalSet } from './lyrics/lexical-sets';
export { pronounce, toIPA, type PronounceOptions, type PronouncedWord, type Pronunciation } from './lyrics/pronounce';
export { speechPlan, type SpeechOptions, type SpeechPlan, type SpokenNote } from './lyrics/speech';
export type {
  Segment,
  Syllable,
  PronouncingDictionary,
  FrontEnd,
  SungNote,
  SungSpan,
  SungPitch,
  SungPhrase,
  SungPlan,
} from './lyrics/types';

/* starter voices are data too: what a UI lists, with no audio */
export { VOICE_PRESETS, SPEECH_HZ_BY_BODY, voicePreset, speechHzForBody, type VoicePreset, type VoiceGroup } from './voices';
