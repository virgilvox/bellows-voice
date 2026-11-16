# Changelog

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
