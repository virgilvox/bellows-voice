# Changelog

## 0.7.3

From a second audit (a Fable review of 0.7.2):

- **Hums sound their whole step again.** 0.7.2 handed the velum back 150 ms early before every
  step, so "m m m" was chopped and a hum before a rest went silent for its last 75 ms. Only a hum
  followed by a pressure sound does that now (the planner passes the next step), and only the
  ejectives (kick, rimshot) close the velum from 100 ms ahead; a rest closes nothing.
- **Numbers and letters:** a letter against a number is its name ("3D", "B12", "R2D2"); "4x4" is four
  by four; "$1.5 million" and "$5.5" are read whole; "1,000th"; plurals of any number ("1000s",
  "5s"); a sentence's full stop after "a.m." or "U.S." is kept, and "Am" is not a time; Mr., Mrs.,
  Ms., Dr., Prof., St. before a name, e.g., i.e., etc. and vs. are said as words; version numbers
  ("1.2.3"); a line in capitals ("LA LA LA", "DO IT NOW") and sounds like "HMM" or "SHH" are not spelled.


## 0.7.2

An audit of everything since 0.5.0 (four independent reviews, every finding checked before a fix).

- **Speech keeps numbers whole.** `speak()` split phrases at `. , :` before reading numbers, so
  "$5.50" was said "five dollars", a breath, "fifty". Numbers become words first now, and IPA
  between slashes stays whole.
- **Numbers, capitals and initialisms:** capitals with Y as the vowel are words ("WHY", "MY"); OK,
  FBI, NYC and other common initialisms, dotted ones ("U.S.") and plurals ("DJs") are spelled; decades
  ("1990s", "'90s"), "3pm" and "7:30 a.m.", a minus sign, codes with leading zeros, numbers against
  letters ("MP3") and quadrillions are read; "$0.99" is ninety nine cents; a slash inside a word
  ("and/or") is not taken for IPA. `numbers: false` now works on `speak`, `sing` and `toIPA`.
- **The number words without the dictionary:** 51 that the rules misread (eleven, hundred,
  thousand, percent, ninety...) are in the reader's own table from CMU, and "square".
- **The dictionary no longer overrides the reader's own words:** a sung "fire" or "hour" keeps one
  syllable, function words keep their weak forms with `cmudict()` loaded.
- **Canadian, Californian, Inland North and Southern US** get General American's vowels before r.
- **Vowel lengths in speech** follow an accent's lexical set (Southern British "go" was timed as a
  schwa), weigh less in a syllable-timed accent, and never go under half (Klatt's minimum).
- **Beatbox:** a kick straight after a hum builds its pressure again (the hum hands the velum back
  150 ms before the next step; 0.5 to 13.8 cmH2O, steps under about 0.2 s still leak); an accented
  kick or rimshot drops the larynx first for a longer stroke (rimshot +1.8 dB, kick +0.6); swing
  alternates across repeats of an odd-length pattern; `m:` alone is a hum, hum pitches clamp to MIDI.
- **Engine:** the piriform branch moves off the velum junction when that junction moves onto it (it
  was a bare leak there: 1.1 cmH2O lost behind a closure at 22050 Hz); moving `mic` mid-note glides
  over 5 ms instead of thumping; `size` mid-note waits for the next note, as the tract does; side
  branches allocate nothing on the audio thread and their damping uses the pre-warped frequency.
- **Helpers:** `describeSound` explains vowel glides and long vowels; `describeShape` says strong
  settings in plain words ("tongue pushed far forward", "throat pockets on").
- **Licensing and docs:** `dist/dict.js` carries Carnegie Mellon's copyright line with its data,
  THIRD_PARTY_NOTICES lists the view files as ported from CHIMERA and the dictionary as shipped,
  stale chunks no longer ship (`dist` is cleaned before each build: 9.4 MB unpacked to 6.9), and
  stale numbers and pointers across README, HOW-IT-WORKS and HANDOFF are corrected.
- Unreleased work from main is in too: a two-rate lungs' end, off by default (HOW-IT-WORKS 13).


## 0.7.1

- **The r-coloured vowel's F3**, the one formant left unsolved: /ɝ/ ("heard", "bird") is now fitted to
  Hillenbrand et al.'s F1, F2 and F3 with the tongue tip free, F3 1826, 1968 and 2218 Hz against
  1711, 1930 and 2154 (it was 1845, 2123, 2543). Gated within 8 percent on every body.
- The vowel solver (internal, used by `scripts/gen-calibrated-vowels.mjs`) takes `{ free, f3Weight }`: the articulators a solve may move.
- A sublingual side branch was built and measured, and left out: in this geometry it moved /ɝ/'s F2,
  not its F3 (HOW-IT-WORKS 13).


## 0.7.0

- **Every word CMU has, said as CMU says it.** `bellows-voice/dict` (`cmudict()`), the CMU
  Pronouncing Dictionary as a residual of the English reader's mistakes: with it the reader says all
  124 101 lookup-able words exactly as CMU does (homographs aside), about 570 KB gzipped, loaded only by pages
  that import it. "Harvard" is ˈhɑɹ.vɚd. `singer(b, voice, { dictionary: cmudict() })`.
- **Numbers, symbols and initialisms as words**, on by default (`numbers: false` turns it off):
  "21st", "$5.50", "10:05", "50%", "1984", "TV". `spellOut`, `cardinal`, `ordinal`, `year`, `letters`.
- **Vowel length carries the final consonant in speech** (Klatt 1979): "bead" over 1.4 times "beat",
  and each vowel its own inherent length.
- `docs/HOW-IT-WORKS.md` section 13.


## 0.6.2

- **No click after "Harvard" in "Harvard Yard".** A tongue moving toward /j/ during the /d/ closure
  grew the cavity behind it while the voicing folds let little air in: the mouth fell to -9.7 cmH2O
  and the release popped inward (75 times the line's median sharpness). Voiced stops now part the
  glottis slightly through the closure (0.02 cm^2, as English /b d g/ often partly devoice), in place
  of 0.6.0's cavity enlargement, which deepened the suction: -3.3 cmH2O, 15 times. Late in a long
  closure /b/ voices 11.7 dB over /p/ (0.6.0's 38 was partly the suction), 16 dB more with slack
  cheeks. Gated in anatomy.test.ts. Open: /ɹgj/ still reaches -10.8 cmH2O without clicking; tissue
  that yields to suction (an elastic anatomical wall) is the real fix and is on the plan.


## 0.6.1

- **The `nasal` setting no longer leaks consonants through the nose.** It lowered the velum through
  every obstruent (MEASURED: /p/ kept 24 percent of its mouth pressure); the velum now gives way to
  any consonant gesture, as the other settings do (gated in anatomy.test.ts).
- `docs/HOW-IT-WORKS.md` section 12: a full review of the model and a comparison with CHIMERA.


## 0.6.0

- **Shaping the mouth.** Voice settings after Laver's articulatory settings, as params and through
  `singer.shape(values | presetId)`: `jawSet`, `lipRound`, `lipOpen`, `tongueFront`, `tongueHigh`,
  `larynxSet`, `throat`, `twang`, `nasal`, `cheeks`, and anatomy, `size` (formants as 1 / size,
  MEASURED within 1 to 7 percent) and `pharynx`. Each moves the formants the way acoustic theory says
  (gated). A setting gives way where a consonant closes. `VOICE_SETTINGS` describes each in plain
  words and acoustic terms; `SHAPE_PRESETS` has ten shapes.
- **The throat's cavities.** The maxillary sinuses on the nasal path (Dang and Honda 1996: 2.4 to
  7.4 dB out of 400 to 1100 Hz on /m/) and the piriform fossae (Dang and Honda 1997: 3 to 7 dB out of
  4 to 6 kHz), the fossae behind the `piriform` param, off until the vowels are re-solved with them.
  Branches are trapezoidal, so they stay stable at any rate (`src/dsp/side-branch.ts`).
- **Breathing.** `speak()` breathes in between phrases: air drawn in through a narrowed glottis,
  quiet noise with no pitch (`breath: 'between' | 'all' | 'none'`).
- **Voicing through a closure.** Voiced stops enlarge the cavity behind them (Westbury 1983) and
  `cheeks` relaxes the oral walls toward Ishizaka et al.'s cheek: /b/ keeps its voice bar 38 dB over
  /p/'s, 4 dB more with slack cheeks.
- **The whole head to draw.** `shape().drawing`, `headProfile()`, `mouthHandles()`,
  `settingsForHandle()` and `formants()` in `bellows-voice/view`.
- **The voice explained.** `describeSound`, `nearestVowel`, `describeShape`.
- `docs/HOW-IT-WORKS.md` section 11: the research, mathematics and measurements behind all of it.


## 0.5.0

- **Final consonants in speech.** `speak()` dropped the consonants that end a phrase, so a word said
  alone lost its coda: "hot" as "haw", "trade" as "tray", "board" as "bou". The last syllable's
  nuclear tone splits it into two notes, and its coda went on the second, a melisma, where the
  sung planner never reads it. It now stays on the first, as a sung melisma's does.
- **General American before r.** "fair", "chair", "board", "roar", "near" and "poor" no longer glide
  through a tense vowel (feɪɹ, boʊɹd): General American now realizes NEAR, SQUARE, FORCE and CURE as
  ɪ ɛ ɔ ʊ before r, as CMUdict writes them (pre-rhotic neutralization).
- **Beatbox.** `singer.beatbox(pattern, { bpm, swing, repeat })`: twelve drum sounds made on the
  tract with the airstreams beatboxers use (ejective kick and rimshot, pulmonic hats and snares, an
  inward snare, tongue click and lip pop, a hummed bass), `BEAT_PRESETS`, `VOCAL_BEATS`, `parseBeat`,
  `formatBeat`. After CHIMERA's beatbox; the breath key, the ejective's push through the release,
  the kick's raised tongue body (MEASURED: 21 cmH2O behind the lips, from 7) and two sounds are new.
- **`mic` param**, a close directional microphone: it adds the near field's flow term, dU/dt +
  (c / 2r) U, so it hears the air of kicks and plosives. 0, the default, leaves the output exactly as
  it was. A `beatboxer` starter voice uses 0.8.
- **The mouth view** draws beats (`TractModel.target('beat:B')`) and reports the narrowest point
  (`shape().constriction`).
- `docs/HOW-IT-WORKS.md` maps the voice from text to air, with its mathematics and sources.


## 0.4.1

- singer() names the likely cause when the voice is loaded but cannot be found: two copies of
  bellowsjs on the page (a bundler pre-bundling bellows-voice with its own copy, as Vite's dev
  server does unless `optimizeDeps.exclude: ['bellows-voice']`, or a CDN page without an import
  map). No other changes.

## 0.4.0

- **Russian**, the first accent of English as a second language, in a new Europe region: KIT with
  FLEECE, TRAP as ɛ, a tapped r, a dark l everywhere, and three rules other accents can use too:
- `th: 'sibilant'`: "think" as sink, "this" as zis (Russian, French and German speakers).
- `replace`: consonants said as others everywhere, `{ w: 'v' }` for "west" as vest.
- `devoiceFinal`: a voiced stop or fricative ending a word is devoiced, "bed" as bet, "dog" as dok.

## 0.3.0

The voice measured against human norms, and tuned to them (docs/VOICE-NORMS.md).

- **Healthier default source.** `roughness` defaults to 0.02, from 0.1. MEASURED: at 0.1 every body
  read 1.2 to 1.3 percent jitter and 3.8 to 4.8 percent shimmer, past the MDVP screening limits and
  heard as an older voice; at 0.02, 0.71 to 0.78 and 2.2 to 3.0 percent, near the healthy means.
  Every render that relied on the default changes; set `roughness: 0.1` for the old texture.
- **Vowels calibrated per body** against Hillenbrand et al. (1995): /ɔ æ ʌ ɛ/ re-solved for the
  male, female and child bodies against the men's, women's and children's means
  (`scripts/gen-calibrated-vowels.mjs`), kept only where they measure closer and no rougher (ten of
  fifteen; the open /ɑ/ shapes that fit better all read rougher). All ten General American
  monophthongs now sit within 4.6 percent RMS in F1 and 3.6 percent in F2 on every body, from up to
  5.8; `voice-norms.test.ts` gates it.
- **Starter voices**: `VOICE_PRESETS` and `singer(b, 'soprano')`. Narrators at the conversational
  means, bass, baritone, tenor, contralto, mezzo-soprano and soprano with their classical ranges and
  vibrato, pop voices, a child, a rock voice and an elder, each with a speaking pitch inside Baken's
  published range for its group.
- **speak() at the voice's own pitch**: a preset's `speechHz`, or the norm for the body (115, 199,
  240 Hz) where it was 110 Hz for every voice. `singer.speechHz` and `opts.speechHz` set it.
- **Ten more accents**, thirty in all: Received Pronunciation, Scouse, Brummie, West Country,
  Boston, Inland North (the Northern Cities Shift), Filipino, Ghanaian, Kenyan and Trinidadian.
  Every accent has a `region`; `ACCENT_REGIONS` lists them in order.

## 0.2.1

- README: how to load the voice in a single HTML file from a CDN, with the import map that gives the
  page and the voice one copy of bellows. No code changes.

## 0.2.0

- **Twelve more accents**, twenty in all: Canadian, Californian, New York, Northern English,
  Geordie, Welsh, Northern Irish (Belfast), South African, Nigerian, Jamaican, Indian and
  Singaporean join General American, Southern US, Southern British, London, Scottish, Irish,
  Australian and New Zealand.
- **Syllable timing**: an accent's prosody can set `stressRatio`, how much longer a stressed vowel
  is than an unstressed one in speech (2 by default; near 1 for Indian, Nigerian, Singaporean and
  Jamaican English, 1.5 for Welsh).
- **Raising**: an accent's `raised` realizations apply before a voiceless consonant in the same
  word, which is Canadian raising ("price" and "house" against "prize" and "how").
- **`bellows-voice/view`**: `TractModel`, the voice's geometry on its articulator targets, moving
  at the engine's speeds, for drawing the mouth.
- **Fixed:** a one-syllable function word ("the", "a") no longer takes an accent's commA vowel, which
  is a longer word's final schwa ("comma", "sofa"): Scottish "the" was ðʌ and is ðə again. Indian
  English keeps its tapped r in NURSE and lettER. Every other reference render still matches 0.4.0
  sample for sample.

## 0.1.0

The singing voice leaves bellowsjs (where it shipped through 0.4.0) for its own package, with its
history. It sounds exactly as it did: renders of five lines across bodies, glottis models,
accents and speech match bellowsjs 0.4.0 sample for sample, through `renderOffline` and through
the worklet.

- `voice`, a bellows plugin (bellowsjs 0.5.0): `Bellows.boot({ plugins: [voice] })` or
  `await b.use(voice)`.
- `singer(b, params, opts)` in place of `b.voice('vocal').sing()`: `sing()`, `speak()`, plus the
  instrument's `note`, `on`, `off`, `param`, `fx`, `send`, `gain`, `pan`, `dispose`. The
  dictionary and accent are the singer's (`alto.dictionary`, `alto.accent`), where they were
  `b.dictionary` and `b.accent`.
- `bellows-voice/text`: the text layer alone, no audio. `bellows-voice/engine`: the engine on the
  calling thread (`registerVoice()` for `renderOffline`).
