# HANDOFF

State of bellows-voice as of 2026-11-17. Read this first when picking the work back up.

## Where things stand

- **Published:** `bellows-voice@0.4.1` on npm and jsDelivr, tagged `v0.4.1`, peer-depending on
  `bellowsjs >=0.5.0 <0.6.0`. CI (`.github/workflows/ci.yml`) is green: typecheck, the generated
  plugin, the vocal tables and the calibrated vowels all checked current, 500-odd tests, build.
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
