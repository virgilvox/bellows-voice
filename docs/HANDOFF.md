# HANDOFF

State of bellows-voice as of 2026-11-17. Read this first when picking the work back up.

## Where things stand

- **Published:** `bellows-voice@0.6.2` on npm, tagged `v0.6.2`, peer-depending on
  `bellowsjs >=0.5.0 <0.6.0`. CI (`.github/workflows/ci.yml`): typecheck, the generated plugin, the
  vocal tables and the calibrated vowels all checked current, 522 tests, build.
- **0.6.0 (2026-11-17):** voice settings and anatomy (one table, `engines/vocal-settings.ts`), the
  sinuses and piriform fossae (`dsp/side-branch.ts`), breaths between phrases, voiced-stop cavity
  enlargement and slack cheeks, the whole head to draw (`view/drawing.ts`, `view/head.ts`), handles
  (`view/handles.ts`) and plain-language helpers (`src/explain.ts`). HOW-IT-WORKS section 11 has the
  research and measurements; section 12 is a full review and comparison with CHIMERA, with a ranked plan (start there).
- **0.5.0 (2026-11-17):** speech keeps phrase-final consonants (they were dropped: "hot" said as
  "haw"); General American neutralizes tense vowels before r; the beatbox (`singer.beatbox`, twelve
  sounds, eight presets) and the `mic` param; beats in the tract view. `docs/HOW-IT-WORKS.md` maps the
  whole voice with its math and sources, and ends with an independent review and a ranked plan
  (section 10): start there for what to do next.
- **Used by:** bellows.live (the bellowsjs monorepo's `apps/workbench`), which loads it as a plugin and
  hosts the voice lab. That repository's `docs/HANDOFF.md` covers the site side.
- **History:** the voice moved out of bellowsjs at 0.4.0 with its history (git filter-repo).
  `docs/VOICE-SPLIT.md` is the design and its outcome; `CHANGELOG.md` has every release since.

## What is in it

- `src/engines`, `src/dsp`: the articulatory voice (CHIMERA's 17 articulators, a waveguide airway).
  CHIMERA's MIT notice is in `THIRD_PARTY_NOTICES.md`; keep it and the header of every ported file.
- `src/lyrics`: text to timed IPA. Thirty-one accents as data in `accents.ts` (each with a `region`,
  `ACCENT_REGIONS`), Wells's lexical sets in `lexical-sets.ts`, `pronounce`/`toIPA`, speech timing and
  melody in `speech.ts`.
- `src/voices.ts`: thirteen starter voices (`VOICE_PRESETS`, `singer(b, 'soprano')`), each with a
  speaking pitch inside published norms and a classical range.
- `src/singer.ts`, `src/sing.ts`: `singer()`, `sing()`, `speak()`, through bellowsjs's public host API.
- `src/plugin.ts`, `src/worklet-entry.ts`: the plugin; `scripts/gen-plugin.mjs` writes
  `src/worklet-code.gen.ts` and `src/catalog.gen.ts`.
- `src/view`: `TractModel`, the mouth for a UI (`bellows-voice/view`).
- Entries: `bellows-voice` (plugin, singer, text, presets), `/text` (no audio, no bellows), `/engine`
  (`registerVoice()` for `renderOffline`), `/view`, `/worklet.js`.

## The science, and what it gates

`docs/VOICE-NORMS.md` has the sources and every measurement; `test/engines-physical/voice-norms.test.ts`
gates them.

- Default `roughness` is 0.02: every body measures healthy jitter and shimmer there (0.1, CHIMERA's,
  put every body past the MDVP limits and read as an old voice).
- `/ɔ æ ʌ ɛ/` are re-solved per body against Hillenbrand et al. (1995) by
  `scripts/gen-calibrated-vowels.mjs`, kept only where they measure closer and no rougher; all ten
  General American monophthongs sit within 4.6 percent RMS in F1 and 3.6 in F2 on every body.
- Open: `/ɑ/` keeps CHIMERA's shape on all three bodies because every closer fit opened the jaw and
  roughened the voice (find out why: the geometry or the airway at a wide jaw). `/ɝ/`'s F3 is not
  solved. None of the thirty-one accents has been judged by ear.

## Releasing

1. `npm test`, `npx tsc --noEmit`; after any engine or table change `npm run gen:vocal`,
   `npm run gen:plugin` (CI checks both, and `node scripts/gen-calibrated-vowels.mjs --check`).
2. Bump `package.json`, write the `CHANGELOG.md` entry, `npm run build`.
3. Commit, `git tag vX.Y.Z`, push with tags, `npm publish` (the token in `~/.npmrc` bypasses 2FA).
4. Wait until `https://registry.npmjs.org/bellows-voice/-/bellows-voice-X.Y.Z.tgz` answers 200 before
   the bellowsjs site takes the new version; the packument lists a version a minute or two before its
   tarball serves, and a deploy in that window fails.
5. In the bellowsjs monorepo: bump `apps/workbench/package.json`, `npm install`, `npm run gen:llm -w
   apps/workbench`, the site checks, commit, push, `doctl apps create-deployment
   88dc2901-3334-47d9-9cb5-8b2f1105294d`.
6. A new bellowsjs minor (0.6) needs the peer range here widened and a voice release.

## Traps

- **Articulators move on schedule, so a closure can pull a vacuum.** The anatomical -dV/dt is an ideal
  flow source: a tongue moving toward the next sound inside a voiced closure drew the mouth to -9.7
  cmH2O and clicked (0.6.2). Gate closure pressure (anatomy.test.ts) whenever timing or voiced-stop
  gestures change. An elastic drive (anatomy moving the wall's rest) was tried and made steps where a
  junction's wall surface nears zero; do it with care.

- **Side branches must be trapezoidal.** An explicit spring (the walls' scheme) on a 4 kHz branch
  blew up at 22.05 kHz; `dsp/side-branch.ts` has the passive form. The piriform fossae lower F1 by
  about dV / V: turning them on moves the vowels off Hillenbrand until the vowels are re-solved.
- **Settings scales are measured**, not guessed: change one, rerun `anatomy.test.ts`. The jaw must
  carry the tongue and lower lip, or opening it leaves F1 where it was.
- **zsh does not word-split** a variable: `for x in "a b"; set -- $x` leaves `$2` empty (a sweep wrote
  an empty constant into the planner this way).

- **Test what reaches the engine.** The coda bug lived because text-layer tests counted notes and
  checked pitch. Compare spans (`speechPlan` then `planSung`) for anything that changes timing.
- **Beat sounds are `phoneme` indices past the table** (`VOCAL_BEAT_BASE` = 54, two a sound: plain
  and accented). Anything indexing a per-phoneme table by a `phoneme` value must guard (`isVowel` in
  sing.ts does). A repeated beat must retrigger: `sungEvents` and the planner's `addNow` exempt beats
  from the "same sound held" rule.
- **The planner's breath key** scales lung pressure. Speech never sets it (rest 1); a beat line rests
  it at 0. It is sampled per articulator step and interpolated per block like the glottis keys; a
  per-block step makes a 1500 Hz line (the old onset-chirp trap).
- **Probing the engine directly:** post `nextIn`/`nextPhoneme` after `noteOn`, or the upcoming
  sound is ignored and every gesture starts late. Run probe tests with `--reporter=verbose`, or
  vitest drops their console output.
- **Renders use the generated worklet bundle:** after any engine change, `npm run gen:plugin` before
  rendering through `b.render()`, or the render runs the old engine.

- **Two copies of bellowsjs** break `singer()` ("no 'vocal' engine" though the plugin loaded): a
  bundler pre-bundling bellows-voice with its own copy (Vite: `optimizeDeps.exclude: ['bellows-voice']`),
  or a CDN page without an import map for `'bellowsjs'`. The README covers both.
- **LPC formants above about 200 Hz** lock onto harmonics; measure the tract at 100 Hz.
- **A rhotic accent must name the r** in NURSE and lettER (`'əɾ'`); a realization without it drops
  General American's r-coloured vowel.
- **Inherited tags:** filter-repo brought bellowsjs's release tags along; they were deleted, and this
  repository's tags are its own. Do not re-fetch tags from a bellowsjs clone.
- **`npm install` before a matching bellowsjs is on npm** needs `--legacy-peer-deps` and a symlink to
  the local bellowsjs package; a `file:` devDependency with the same name as the peer crashes npm.
- The site's monospace font draws u like ʊ; any UI showing IPA needs an IPA-capable font.
