/*
 * A singer: a bellows instrument on the 'vocal' engine, with sing() and speak(). Lyrics go through
 * the text layer (lyrics/), notes through bellows' tempo map and tuning (b.layNotes), the plan
 * through sungEvents (sing.ts), and the events into bellows through its host API
 * (b.postKernelEvents), so this module needs nothing from bellows that is not public.
 *
 * Moved from bellows' facade (Bellows.singEvents, speakEvents and Instrument.sing, speak at
 * bellowsjs 0.4.0) when the voice became its own package; what it posts is unchanged.
 */

import { EventKind, listEngines, type Bellows, type BusHandle, type FxInput, type Instrument, type KernelEvent, type NoteOptions, type NoteSpec, type NoteValue, type Scale, type TimeValue } from 'bellowsjs';
import type { PronouncingDictionary, SungPlan, Syllable } from './lyrics/types';
import { lyricsToSyllables } from './lyrics/read';
import { resolveAccent, type Accent } from './lyrics/accents';
import { speechPlan } from './lyrics/speech';
import { BEAT_LEAD_IN, beatLine, type BeatPattern, type BeatTiming } from './lyrics/beat';
import { SHAPE_PRESETS, VOICE_SETTINGS } from './engines/vocal-settings';
import { planSung, type PlanSungOptions } from './lyrics/sing';
import { sungEvents, type SungWindow } from './sing';
import { VOCAL_PLAN_LEAD, vocalGlideLead } from './engines/vocal-lead';
import { speechHzForBody, voicePreset, type VoicePreset } from './voices';

/** One note of a sung line. `note: null` is a rest: it takes time and no syllable. */
export interface SingNote {
  note: NoteValue | null;
  /** Beats, notation ('8n', '3/8'), or { seconds }, through the tempo map. */
  dur: TimeValue | { seconds: number };
  /** Velocity 0..1, default 0.8. A phrase plays at its first note's. */
  vel?: number;
}

export interface SingOptions {
  /**
   * Context time of the first note's beat, where its vowel lands. Left out, a live line starts as
   * soon as its opening consonants can all still sound, and a line in a clock callback replayed by
   * render() starts at the callback's tick.
   */
  at?: number;
  /** Pronouncing dictionary for this line, over the singer's. */
  dictionary?: PronouncingDictionary;
  /** Scale for { degree } notes, as note()'s third argument. Default C major. */
  scale?: Scale;
  /**
   * The accent's t and l rules on English words (General American: "little" sings lɪ.ɾəɫ), default
   * true. False keeps every /t d l/ as written, as classical diction does. IPA is sung as written
   * either way.
   */
  allophones?: boolean;
  /** Accent for this line, over the singer's: an id from ACCENTS ('southern-british', ...) or an Accent. */
  accent?: Accent | string;
}

export interface SpeakOptions {
  /** Context time the first syllable's vowel lands. Left out, as soon as the opening consonants can sound. */
  at?: number;
  dictionary?: PronouncingDictionary;
  /** Accent, over the singer's. Its prosody sets the melody and rate. */
  accent?: Accent | string;
  /** Baseline pitch, Hz. Default the singer's speechHz: its preset's, or the norm for its body. */
  hz?: number;
  /** Rate over the accent's own, 1 normal. */
  rate?: number;
  /** The accent's t and l rules, default true. */
  allophones?: boolean;
  /** Breaths in: 'between' phrases (default), 'all' (before the first too), or 'none'. */
  breath?: 'between' | 'all' | 'none';
}

/**
 * What sing() planned and posted. `phrases` are the plan, each vowel on its beat. `leadIn` is the
 * longest any phrase starts before its own first beat, which can be more than the plan's own
 * lead-in: a phrase that opens on an aspirated p, t or k releases it early, so its vowel is voiced
 * on the beat. Live, call at least that far ahead of the first beat.
 */
export interface BeatboxOptions extends BeatTiming {
  /** Context time of the first step's hit. Left out, as soon as the line's lead-in can sound. */
  at?: number;
  /** A hum's pitch where its step names none: a note through the tuning, or { hz }. Default 0.75 of speechHz. */
  note?: NoteValue;
  /** Velocity 0..1: the breath behind every sound. Default 0.8. */
  vel?: number;
}

export interface SingResult extends SungPlan {
  /** IPA the vocal engine has no phoneme for, each once; those spans keep the sound before them. */
  unknown: string[];
  /**
   * Seconds of the line left out because the instrument was still singing an earlier line there, or
   * had a later one posted already: the opening consonants that would have overlapped it, or whole
   * phrases. 0 when the instrument was free.
   */
  trimmed: number;
}

export interface SingerOptions {
  /** Pronunciations: lowercase word to CMUdict ARPAbet, as parseCmudict() returns. None ships. */
  dictionary?: PronouncingDictionary | null;
  /** The accent lines are read in. Default 'general-american'. */
  accent?: Accent | string;
  /** Voices on the channel, as b.voice() takes it. */
  polyphony?: number;
  /** speak()'s default pitch, Hz, over the preset's and the body's norm. */
  speechHz?: number;
}

/**
 * A vocal channel's own phoneme and bend, which sung lines hand back when they end (undefined: the
 * engine's default), and the phrases sing() has posted on it, so the next line fits around them.
 */
interface SingState {
  restPhoneme?: number;
  restBend?: number;
  /** The channel's own glide settings, which set how early sung bends go out. */
  glide?: number;
  overshoot?: number;
  preparation?: number;
  windows: SungWindow[];
}

const EMPTY: SingResult = { phrases: [], leadIn: 0, unknown: [], trimmed: 0 };

export class Singer {
  /** The bellows instrument underneath: notes, params, fx, sends and gain go through it. */
  readonly instrument: Instrument;
  /** Pronunciations for every line, over the letter-to-sound rules. */
  dictionary: PronouncingDictionary | null;
  /** The accent every line is read in, unless a line names its own. */
  accent: Accent | string;
  /** speak()'s default baseline pitch, Hz. */
  speechHz: number;
  /** The starter voice this singer was made from, if any. */
  readonly preset: VoicePreset | undefined;
  private readonly key: string;
  private readonly offParam: () => void;

  constructor(
    private readonly b: Bellows,
    voice: Record<string, number> | string | VoicePreset = {},
    opts: SingerOptions = {},
  ) {
    const preset = typeof voice === 'string' ? voicePreset(voice) : isPreset(voice) ? voice : undefined;
    if (typeof voice === 'string' && !preset) {
      throw new Error(`bellows-voice: no starter voice "${voice}"; see VOICE_PRESETS`);
    }
    const params: Record<string, number> = preset ? { ...preset.params } : { ...(voice as Record<string, number>) };
    this.preset = preset;
    if (!listEngines().some((e) => e.id === 'vocal')) {
      throw new Error(
        "bellows-voice: this bellows instance has no 'vocal' engine. Load the voice first: " +
          'Bellows.boot({ plugins: [voice] }) or await b.use(voice). If it is loaded, the page has two ' +
          'copies of bellowsjs (a bundler that pre-bundles bellows-voice with its own, or a CDN page ' +
          "without an import map for 'bellowsjs'), and the voice cannot see the one that loaded it.",
      );
    }
    this.instrument = b.voice('vocal', params, opts.polyphony !== undefined ? { polyphony: opts.polyphony } : undefined);
    this.dictionary = opts.dictionary ?? null;
    this.accent = opts.accent ?? 'general-american';
    this.speechHz = opts.speechHz ?? preset?.speechHz ?? speechHzForBody(params.body ?? 0);
    this.key = 'bellows-voice:' + this.instrument.channel;
    // what the engine itself does with a creation value that is not a number
    const own = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    b.contextState<SingState>(this.key, {
      make: () => ({
        restPhoneme: own(params.phoneme),
        restBend: own(params.bend),
        glide: own(params.glide),
        overshoot: own(params.overshoot),
        preparation: own(params.preparation),
        windows: [],
      }),
      // a render starts from the channel's own values as they are now, and no lines
      fork: (live) => ({ ...live, windows: [] }),
    });
    this.offParam = b.onUntimedParam(this.instrument.channel, (name, value) => this.restOn(name, value));
  }

  /** The bellows channel this singer plays on. */
  get channel(): number {
    return this.instrument.channel;
  }

  /**
   * Sing a lyric on a melody. Notes are laid end to end from `at`, each `dur` through the tempo map
   * and each pitch through the tuning and `scale`. Each note's vowel lands on its beat; opening
   * consonants start before it. Lyrics are English (through the dictionary when set, letter-to-sound
   * rules otherwise) and IPA between slashes. A hyphen splits a word across notes, a free-standing
   * '-' or '~' holds the vowel onto the next note, and punctuation or a rest ends a phrase.
   *
   * One singer sings one line at a time, because `phoneme` and `bend` are channel parameters: give a
   * harmony its own singer. A line that would start while an earlier one is still singing starts
   * where that one ends, and `trimmed` says how much went.
   */
  sing(lyrics: string | readonly Syllable[], notes: readonly SingNote[], opts: SingOptions = {}): SingResult {
    if (this.instrument.disposed) return { ...EMPTY };
    return this.post(lyrics, notes, opts);
  }

  /**
   * Speak text in an accent: its vowels and consonants from the accent's rules, its rhythm
   * stress-timed and its melody from the accent's prosody, a statement falling (or, in Australian
   * and New Zealand English, rising) and a question rising.
   */
  speak(text: string, opts: SpeakOptions = {}): SingResult {
    if (this.instrument.disposed) return { ...EMPTY };
    const accent = resolveAccent(opts.accent ?? this.accent);
    const syllables: Syllable[] = [];
    const questions: boolean[] = [];
    // each sentence or clause is a phrase; its closing mark sets its tune
    for (const m of text.matchAll(/[^.!?;:,\n]+[.!?;:,\n]*/g)) {
      const part = lyricsToSyllables(m[0], {
        dictionary: opts.dictionary ?? this.dictionary ?? undefined,
        allophones: opts.allophones,
        accent,
        // running speech: weak function words
        reduce: true,
      });
      if (part.length === 0) continue;
      part[part.length - 1].phraseEnd = true;
      syllables.push(...part);
      questions.push(m[0].includes('?'));
    }
    const plan = speechPlan(syllables, { hz: opts.hz ?? this.speechHz, rate: opts.rate, prosody: accent.prosody, breath: opts.breath }, questions);
    const notes: SingNote[] = plan.notes.map((n) =>
      n.rest ? { note: null, dur: { seconds: n.dur } } : { note: { hz: n.hz }, dur: { seconds: n.dur } },
    );
    // spoken consonants at their full spoken length, where sung ones are shortened (durations.ts)
    return this.post(plan.syllables, notes, { at: opts.at }, { consonantScale: 1 });
  }

  /**
   * Beatbox a pattern ('B . t . | Pf . t .', see parseBeat and BEAT_PRESETS): each sound made on the
   * voice's own tract with a beatboxer's airstream (an ejective kick, an inward snare, clicks, a hummed
   * bass). One throat, so a pattern is monophonic, and the whole of it is one breath group.
   */
  beatbox(pattern: BeatPattern | string, opts: BeatboxOptions = {}): SingResult {
    const line = beatLine(pattern, opts);
    const humDefault: NoteValue = opts.note ?? { hz: 0.75 * this.speechHz };
    let pitch: NoteValue = humDefault;
    const notes: SingNote[] = line.steps.map((step, i) => {
      if (step !== null && step.id === 'm') pitch = step.note ?? humDefault;
      return { note: pitch, dur: { seconds: line.durs[i] }, vel: opts.vel };
    });
    const at = opts.at === undefined ? undefined : opts.at - BEAT_LEAD_IN;
    return this.post(line.syllables, notes, { at });
  }

  /**
   * Shape the mouth: voice settings and anatomy (VOICE_SETTINGS: jawSet, lipRound, larynxSet, nasal,
   * twang, throat, cheeks, size, pharynx, ...) as values, or a SHAPE_PRESETS id ('smile', 'operatic',
   * 'giant'). Settings left out go back to neutral. Size and pharynx take effect from the next line.
   */
  shape(values: Record<string, number> | string): this {
    const v = typeof values === 'string' ? SHAPE_PRESETS.find((p) => p.id === values)?.values : values;
    if (!v) throw new Error(`bellows-voice: no mouth shape '${String(values)}' (see SHAPE_PRESETS)`);
    for (const s of VOICE_SETTINGS) {
      const x = v[s.param];
      this.param(s.param, typeof x === 'number' && Number.isFinite(x) ? x : (s.neutral ?? 0));
    }
    return this;
  }

  /** Play a note on the voice's own phoneme (an "ah" unless `phoneme` is set), as the instrument's note() does. */
  note(note: NoteValue, opts: NoteOptions = {}): this {
    this.instrument.note(note, opts);
    return this;
  }

  /** Set an engine parameter, as the instrument's param() does. */
  param(name: string, value: number, at?: number): this {
    this.instrument.param(name, value, at);
    return this;
  }

  /** Sustain a note on the voice's own phoneme; returns an id for off(). */
  on(note: NoteValue, vel = 0.8, at?: number): number {
    return this.instrument.on(note, vel, at);
  }

  off(noteId: number, at?: number): this {
    this.instrument.off(noteId, at);
    return this;
  }

  /** Insert effects on the voice's channel, as the instrument's fx() does. */
  fx(...fx: FxInput[]): this {
    this.instrument.fx(...fx);
    return this;
  }

  /** Send the voice to a bus. */
  send(bus: BusHandle, level: number): this {
    this.instrument.send(bus, level);
    return this;
  }

  gain(value: number): this {
    this.instrument.gain(value);
    return this;
  }

  pan(value: number): this {
    this.instrument.pan(value);
    return this;
  }

  /** Release the channel. */
  dispose(opts: { releaseSeconds?: number } = {}): void {
    this.offParam();
    this.instrument.dispose(opts);
  }

  private state(): SingState {
    return this.b.contextState<SingState>(this.key, { make: () => ({ windows: [] }) })!;
  }

  private post(
    lyrics: string | readonly Syllable[],
    notes: readonly SingNote[],
    opts: SingOptions,
    planOpts: PlanSungOptions = {},
  ): SingResult {
    const b = this.b;
    const channel = this.instrument.channel;
    const syllables =
      typeof lyrics === 'string'
        ? lyricsToSyllables(lyrics, {
            dictionary: opts.dictionary ?? this.dictionary ?? undefined,
            allophones: opts.allophones,
            accent: opts.accent ?? this.accent,
          })
        : lyrics;
    const state = this.state();
    const rendering = b.rendering;
    const now = b.now();
    // live, a phrase that has ended can no longer meet a new one: its events are spent
    if (!rendering) state.windows = state.windows.filter((w) => w.end >= now);
    const plan1 = (at: number) => {
      const plan = planSung(b.layNotes(notes as readonly NoteSpec[], at, opts.scale), syllables, planOpts);
      const posted = sungEvents(plan, {
        channel,
        phonemeParam: b.paramIndex('phoneme'),
        bendParam: b.paramIndex('bend'),
        nextPhonemeParam: b.paramIndex('nextPhoneme'),
        nextInParam: b.paramIndex('nextIn'),
        planLead: VOCAL_PLAN_LEAD,
        bendLead: vocalGlideLead(state.glide, state.overshoot, state.preparation),
        firstNoteId: b.reserveNoteIds(0),
        restPhoneme: state.restPhoneme,
        restBend: state.restBend,
        busy: state.windows,
        // a stop released before the render starts, or before now, never sounds
        notBefore: rendering ? 0 : now,
      });
      return { plan, posted };
    };
    let { plan, posted } = plan1(opts.at ?? (rendering ? now : now + 0.005));
    // live with no `at`, the first beat goes after the opening consonants, as soon as they can all
    // still sound, instead of losing them to the past
    if (opts.at === undefined && !rendering && posted.leadIn > 0) ({ plan, posted } = plan1(now + 0.005 + posted.leadIn));
    b.reserveNoteIds(plan.phrases.length);
    b.postKernelEvents(posted.events);
    state.windows = state.windows.concat(posted.windows).sort((a, c) => a.start - c.start);
    return { phrases: plan.phrases, leadIn: posted.leadIn, unknown: posted.unknown, trimmed: posted.trimmed };
  }

  /**
   * An untimed phoneme or bend becomes the channel's own, which sung lines hand back when they end.
   * A line already posted would still hand back the old value at its end, so the new one is posted
   * there too, after that line's resets, unless another line opens at that moment and owns the
   * channel.
   */
  private restOn(name: string, value: number): void {
    if (!Number.isFinite(value)) return;
    const state = this.b.contextState<SingState>(this.key);
    if (!state) return;
    if (name === 'glide' || name === 'overshoot' || name === 'preparation') {
      state[name] = value;
      return;
    }
    if (name !== 'phoneme' && name !== 'bend') return;
    if (name === 'phoneme') state.restPhoneme = value;
    else state.restBend = value;
    const now = this.b.now();
    const idx = this.b.paramIndex(name);
    const fixes: KernelEvent[] = [];
    for (const w of state.windows) {
      if (!w.resets || w.end < now) continue;
      if (state.windows.some((o) => o.start === w.end)) continue;
      fixes.push({ time: w.end, kind: EventKind.Param, target: this.instrument.channel, a: idx, b: value, c: 0 });
    }
    if (fixes.length > 0) this.b.postKernelEvents(fixes);
  }
}

/**
 * A singer on bellows instance `b`: b.voice('vocal', ...) with sing() and speak(). `voice` is the
 * engine's params, or a starter voice by id ('soprano', 'narrator-female'; see VOICE_PRESETS) or
 * as the preset itself.
 */
export function singer(b: Bellows, voice: Record<string, number> | string | VoicePreset = {}, opts: SingerOptions = {}): Singer {
  return new Singer(b, voice, opts);
}

function isPreset(v: unknown): v is VoicePreset {
  return typeof v === 'object' && v !== null && 'params' in v && 'speechHz' in v && 'group' in v;
}
