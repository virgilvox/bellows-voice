/*
 * Speech rendered offline: text to samples, with the phoneme spans the engine sang and the
 * articulators it moved, on one clock. No AudioContext and no Bellows instance: the score is built
 * here as Singer.speak() builds it, and bellows' renderOffline() runs it through the engine on this
 * thread, so it works in Node, in a worker and on a page alike.
 *
 * The articulator track is read through the probe's own sampler (probe/sampler.ts) after every
 * render quantum, as the live probe reads it in the worklet, so a live probe on the same score gives
 * the same frames (test/integration/probe.test.ts). Everything that varies draws from the seed, so
 * one seed gives the same samples, spans and track every time.
 */

import { encodeWav, internParam, registerBuiltins, registerEngine, renderOffline, type KernelMessage } from 'bellowsjs';
import type { PronouncingDictionary, SungNote, SungPhrase, SungSpan } from './lyrics/types';
import type { Accent } from './lyrics/accents';
import { planSung } from './lyrics/sing';
import { sungEvents } from './sing';
import { SPOKEN_CONSONANT_SCALE, speechLine } from './speech-line';
import { VOCAL_PLAN_LEAD, VOCAL_GLIDE_DEFAULTS, vocalGlideLead } from './engines/vocal-lead';
import { vocalEngine } from './engines/vocal';
import { speechHzForBody, voicePreset, type VoicePreset } from './voices';
import { ProbeSampler } from './probe/sampler';
import { PROBE_MAX_RATE, decodeFrame, type ArticulatorFrame } from './probe/frame';

export interface RenderSpeechOptions {
  /** The engine's params, or a starter voice by id ('narrator-female') or as the preset. Default {}. */
  voice?: Record<string, number> | string | VoicePreset;
  /** Seed for every random draw (the folds' jitter, the noise). Default 'bellows-voice'. */
  seed?: string;
  /** Default 48000. */
  sampleRate?: number;
  /** Articulator frames per second, 1 to 375. Default 60. */
  frameRate?: number;
  /** Seconds the first syllable's vowel lands at. Default as soon as the opening consonants can sound. */
  at?: number;
  /** Seconds rendered after the last span ends, for the release. Default 0.4. */
  tail?: number;
  dictionary?: PronouncingDictionary;
  accent?: Accent | string;
  /** Baseline pitch, Hz. Default the preset's, or the norm for the body. */
  hz?: number;
  /** Speech rate over the accent's own, 1 normal. */
  rate?: number;
  allophones?: boolean;
  breath?: 'between' | 'all' | 'none';
  numbers?: boolean;
}

export interface SpeechRender {
  /** Mono samples, the mean of bellows' two output channels (the voice sits in the centre). */
  samples: Float32Array;
  sampleRate: number;
  /** The plan: phrases with their spans and pitch targets, seconds from the start of the render. */
  phrases: SungPhrase[];
  /** Every span of every phrase, in order. */
  spans: SungSpan[];
  /** IPA the engine has no phoneme for; those spans keep the sound before them. */
  unknown: string[];
  /** The articulators as the audio made them, `frameRate` frames per second (see ArticulatorFrame). */
  track: ArticulatorFrame[];
  frameRate: number;
  /** The samples as a WAV file: 16 or 24-bit integer, or 32-bit float. Default 16. */
  wav(bitDepth?: 16 | 24 | 32): ArrayBuffer;
}

/** The kernel score of a spoken line, as Singer.speak() posts it, on channel 0. Internal: renderSpeech and its tests. */
export function speechScore(
  text: string,
  opts: RenderSpeechOptions = {},
  probeSlot = 0,
): { messages: KernelMessage[]; seconds: number; phrases: SungPhrase[]; unknown: string[] } {
  const v = opts.voice ?? {};
  const preset = typeof v === 'string' ? voicePreset(v) : isPreset(v) ? v : undefined;
  if (typeof v === 'string' && !preset) throw new Error(`bellows-voice: no starter voice "${v}"; see VOICE_PRESETS`);
  const params: Record<string, number> = preset ? { ...preset.params } : { ...(v as Record<string, number>) };
  const line = speechLine(text, {
    dictionary: opts.dictionary,
    accent: opts.accent ?? 'general-american',
    hz: opts.hz ?? preset?.speechHz ?? speechHzForBody(params.body ?? 0),
    rate: opts.rate,
    allophones: opts.allophones,
    breath: opts.breath,
    numbers: opts.numbers,
  });
  const own = (x: number | undefined) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);
  const ids = {
    phonemeParam: internParam('phoneme'),
    bendParam: internParam('bend'),
    nextPhonemeParam: internParam('nextPhoneme'),
    nextInParam: internParam('nextIn'),
  };
  const lay = (at: number): SungNote[] => {
    const out: SungNote[] = [];
    let t = at;
    for (const n of line.notes) {
      const dur = Number.isFinite(n.dur) && n.dur > 0 ? n.dur : 0;
      if (n.hz !== null) out.push({ time: t, dur, hz: n.hz });
      t += dur;
    }
    return out;
  };
  const plan1 = (at: number) => {
    const plan = planSung(lay(at), line.syllables, { consonantScale: SPOKEN_CONSONANT_SCALE });
    const posted = sungEvents(plan, {
      channel: 0,
      ...ids,
      planLead: VOCAL_PLAN_LEAD,
      bendLead: vocalGlideLead(
        own(params.glide) ?? VOCAL_GLIDE_DEFAULTS.glide,
        own(params.overshoot) ?? VOCAL_GLIDE_DEFAULTS.overshoot,
        own(params.preparation) ?? VOCAL_GLIDE_DEFAULTS.preparation,
      ),
      firstNoteId: 1,
      restPhoneme: own(params.phoneme),
      restBend: own(params.bend),
      busy: [],
      notBefore: 0,
    });
    return { plan, posted };
  };
  let { plan, posted } = plan1(opts.at ?? 0);
  // as a live line does: the first beat after the opening consonants, so none is cut
  if (opts.at === undefined && posted.leadIn > 0) ({ plan, posted } = plan1(posted.leadIn));
  const end = plan.phrases.reduce((e, p) => Math.max(e, p.end), 0);
  const messages: KernelMessage[] = [
    ...Object.entries({ phoneme: ids.phonemeParam, bend: ids.bendParam, nextPhoneme: ids.nextPhonemeParam, nextIn: ids.nextInParam }).map(
      ([name, index]): KernelMessage => ({ type: 'internParam', name, index }),
    ),
    {
      type: 'createChannel',
      id: 0,
      engineId: 'vocal',
      params: probeSlot > 0 ? { ...params, probe: probeSlot } : params,
      seed: (opts.seed ?? 'bellows-voice') + '::ch0',
    },
    { type: 'events', events: posted.events },
  ];
  return { messages, seconds: end + Math.max(0, opts.tail ?? 0.4), phrases: plan.phrases, unknown: posted.unknown };
}

/** The probe slot an offline render reads (one render runs at a time on a thread). */
const OFFLINE_SLOT = 1;

/**
 * Render text as speech without an AudioContext: samples, the timed phoneme spans and the
 * articulator track at `frameRate`, the same for the same seed. Runs on the calling thread (8 s of
 * speech took 1.1 to 1.8 s in Node on a laptop), so a page renders long lines in a worker.
 */
export function renderSpeech(text: string, opts: RenderSpeechOptions = {}): SpeechRender {
  const sampleRate = opts.sampleRate ?? 48000;
  const frameRate = Math.min(Math.max(opts.frameRate ?? 60, 1), PROBE_MAX_RATE);
  const score = speechScore(text, opts, OFFLINE_SLOT);
  registerBuiltins();
  registerEngine(vocalEngine);
  const sampler = new ProbeSampler(OFFLINE_SLOT, frameRate, sampleRate);
  const track: ArticulatorFrame[] = [];
  let block = 0;
  const audio = renderOffline(score.messages, {
    seconds: score.seconds,
    sampleRate,
    onBlock: (engine) => {
      // before block b renders, block b - 1 has: its end is b * blockSize
      if (block > 0 && sampler.tick(block * engine.blockSize)) track.push(decodeFrame(sampler.frame));
      block++;
    },
  });
  const samples = new Float32Array(audio.left.length);
  for (let i = 0; i < samples.length; i++) samples[i] = 0.5 * (audio.left[i] + audio.right[i]);
  return {
    samples,
    sampleRate,
    phrases: score.phrases,
    spans: score.phrases.flatMap((p) => p.spans),
    unknown: score.unknown,
    track,
    frameRate,
    wav: (bitDepth = 16) => encodeWav([samples], sampleRate, { bitDepth }),
  };
}

function isPreset(v: unknown): v is VoicePreset {
  return typeof v === 'object' && v !== null && 'params' in v && 'speechHz' in v && 'group' in v;
}
