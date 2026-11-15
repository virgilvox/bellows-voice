# bellows-voice

An articulatory singing and speaking voice for bellowsjs, published to npm as `bellows-voice`. It
moved out of the bellowsjs monorepo (github.com/virgilvox/bellowsjs) at 0.4.0 with its history.

## Layout

- `src/engines`, `src/dsp`: the engine (pure DSP, no browser globals, runs and tests in Node).
- `src/lyrics`: the text layer (text and notes to timed IPA; no audio). `src/text.ts` exports it alone.
- `src/sing.ts`, `src/singer.ts`: plans and posts sung and spoken lines through bellows' public host API.
- `src/plugin.ts`, `src/worklet-entry.ts`: the bellows plugin. `scripts/gen-plugin.mjs` bundles the
  engine into `src/worklet-code.gen.ts` and writes `src/catalog.gen.ts`.
- `data/vocal`, `scripts/gen-vocal-tract.mjs`, `scripts/gen-extra-vowels.mjs`: the tables.

## Hard rules for writing

- Never use emojis anywhere: not in code, comments, docs, commit messages, or UI copy.
- Never use em dashes. Use commas, periods, colons, or parentheses instead.
- Avoid stock AI phrasing ("delve", "seamless", "robust", "leverage", "utilize", "comprehensive" and the like). Write plainly.
- Never add Claude attribution, Co-Authored-By trailers, or "Generated with" lines to git commits.

## Engineering rules

- Depend on bellowsjs only through its public exports, never its source paths. It is a peer dependency.
- No allocation on the audio path at steady state; every DSP unit takes its sample rate at construction.
- Every stochastic decision draws from a named PRNG stream; nothing calls Math.random.
- Test driven, vitest. `npm test`. Regenerate the plugin (`npm run gen:plugin`) after engine changes;
  CI checks it is current.
- Keep CHIMERA's notice (THIRD_PARTY_NOTICES.md) and the header of every ported file.
