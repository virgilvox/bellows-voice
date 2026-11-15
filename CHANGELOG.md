# Changelog

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
