/*
 * Writes data/vocal/calibrated-vowels.json: General American vowels re-solved per body against
 * Hillenbrand et al. (1995), the men's means for the male body, the women's for the female, the
 * children's for the child. CHIMERA's targets put the open vowels' F1 7 to 10 percent low on every
 * body (docs/VOICE-NORMS.md). Each vowel is solved from its current posture with
 * src/engines/vowel-solver.ts, then the loop is closed through the engine: rendered at 100 Hz (where
 * LPC reads the tract, as the norms test measures), its formants measured, the aim moved by most of
 * the error, up to six rounds. A new row is kept only if it measures closer to the human means than
 * the row it would replace and does not make the voice rougher: its local shimmer at the body's
 * norm speaking pitch may rise by at most half a point (a calibrated male /ɑ/ that read 5.9 percent
 * shimmer where CHIMERA's read 3.0 is what this rule is for). Of the candidates that pass, the
 * closest wins; with none, the vowel keeps CHIMERA's. gen-vocal-tract.mjs prefers these rows.
 *
 *   node scripts/gen-calibrated-vowels.mjs           write the file
 *   node scripts/gen-calibrated-vowels.mjs --check   exit 1 if it is stale
 */

import { build } from 'esbuild';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pkg = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Hillenbrand et al. (1995) steady-state F1, F2, F3 means: men, women, children. */
const HILLENBRAND = {
  'ɑ': [[768, 1333, 2522], [936, 1551, 2815], [1002, 1688, 2950]],
  'ɔ': [[652, 997, 2538], [781, 1136, 2824], [803, 1210, 2982]],
  'æ': [[588, 1952, 2601], [669, 2349, 2972], [717, 2501, 3289]],
  'ʌ': [[623, 1200, 2550], [753, 1426, 2933], [749, 1546, 3145]],
  'ɛ': [[580, 1799, 2605], [731, 2058, 2979], [749, 2267, 3310]],
  /* F3 from the released data (vowdata.dat, steady state, "heard"): 1711, 1930, 2154 Hz */
  'ɝ': [[474, 1379, 1711], [523, 1588, 1930], [586, 1719, 2154]],
};
/*
 * Vowels fitted on F3 as well: the r-coloured vowel, whose low F3 is its identity (CHIMERA's /ɝ/ read F3
 * 8 to 18 percent high on every body). The rest are fitted on F1 and F2, as before.
 */
const F3_VOWELS = new Set(['ɝ']);
const KEYS = ['tbX', 'tbY', 'jaw', 'lipAp', 'lipProt', 'lipWidth', 'root', 'larynx', 'ttCurl'];
/* An F3 vowel's row and solve also take the tongue tip, which sets an r-coloured vowel's F3. */
const TIP_KEYS = ['ttX', 'ttY'];
const keysFor = (ipa) => (F3_VOWELS.has(ipa) ? [...KEYS, ...TIP_KEYS] : KEYS);
const BODIES = ['male', 'female', 'child'];
const F0 = 100;
/* the norm speaking pitches (src/voices.ts) the shimmer check renders at */
const SPEECH_HZ = [115, 199, 240];
const SHIMMER_SLACK = 0.5;

const dir = mkdtempSync(join(tmpdir(), 'bellows-calibrate-'));
const outfile = join(dir, 'solver.mjs');
try {
  await build({
    stdin: {
      contents: `export * from './src/engines/vowel-solver';
export { VOCAL_BODIES, VOCAL_NEUTRAL, VOCAL_ARTICULATOR_NAMES, VOCAL_TABLE_PHONEMES } from './src/engines/vocal-tables.gen';
export { vocalEngine } from './src/engines/vocal';
export { estimateFormants, rng } from 'bellowsjs';`,
      resolveDir: pkg,
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'error',
  });
  const m = await import(pathToFileURL(outfile).href);
  /*
   * Start from CHIMERA's rows, not the generated tables, which already hold the last calibration: so a
   * run measures the same "before" every time and --check can tell whether the file is current. The
   * row is built as gen-vocal-tract.mjs builds a vowel's (its keys, the tip only for a curled tongue).
   */
  const art = JSON.parse(readFileSync(join(pkg, 'data/vocal/chimera-articulation.json'), 'utf8'));
  for (const [b, name] of BODIES.entries()) {
    for (const ipa of Object.keys(HILLENBRAND)) {
      const vt = art.vowelTargetsByBody[name][ipa];
      const keys = [...KEYS];
      if ((vt.ttCurl ?? 0) > 0.05) keys.push('ttX', 'ttY');
      m.VOCAL_BODIES[b].vowelTargets[m.VOCAL_TABLE_PHONEMES.indexOf(ipa)] = Array.from(m.VOCAL_ARTICULATOR_NAMES, (k) =>
        keys.includes(k) && vt[k] !== undefined ? vt[k] : NaN,
      );
    }
  }
  const posture = (body, ipa) => {
    const row = m.VOCAL_BODIES[body].vowelTargets[m.VOCAL_TABLE_PHONEMES.indexOf(ipa)];
    return Float64Array.from(m.VOCAL_NEUTRAL, (n, k) => (row[k] === row[k] ? row[k] : n));
  };
  const geos = BODIES.map((_, b) => m.vowelGeometry(b));
  /* A held vowel through the engine with `post` as its target row (or the table's when null); median F1, F2. */
  const render = (b, ipa, post) => {
    const rows = m.VOCAL_BODIES[b].vowelTargets;
    const idx = m.VOCAL_TABLE_PHONEMES.indexOf(ipa);
    const saved = rows[idx];
    if (post) rows[idx] = Array.from(m.VOCAL_ARTICULATOR_NAMES, (k, i) => (keysFor(ipa).includes(k) ? post[i] : NaN));
    const sr = 48000;
    const params = {};
    for (const p of m.vocalEngine.params) params[p.name] = p.default;
    Object.assign(params, { body: b, vibratoDepth: 0, drift: 0, roughness: 0 });
    const v = m.vocalEngine.createVoice(sr, params, m.rng('calibrate-' + ipa));
    for (const [k, val] of Object.entries(params)) v.setParam(k, val);
    v.setParam('phoneme', idx);
    v.noteOn(F0, 0.8);
    const l = new Float32Array(sr);
    const r = new Float32Array(sr);
    for (let i = 0; i < sr; i += 128) v.process(l, r, i, Math.min(sr, i + 128));
    rows[idx] = saved;
    const f1 = [];
    const f2 = [];
    const f3 = [];
    for (let t = 0.45; t <= 0.9; t += 0.05) {
      const fm = m.estimateFormants(l, sr, Math.round(t * sr)).filter((f) => f.f > 200 && f.bw < 600);
      if (fm.length >= 2) {
        f1.push(fm[0].f);
        f2.push(fm[1].f);
        if (fm.length >= 3) f3.push(fm[2].f);
      }
    }
    const med = (a) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];
    return F3_VOWELS.has(ipa) ? [med(f1), med(f2), med(f3)] : [med(f1), med(f2)];
  };
  const err = (meas, t) =>
    meas.length > 2
      ? Math.hypot(meas[0] / t[0] - 1, meas[1] / t[1] - 1, meas[2] / t[2] - 1) / Math.sqrt(3)
      : Math.hypot(meas[0] / t[0] - 1, meas[1] / t[1] - 1) / Math.SQRT2;
  /* Local shimmer, percent, of the vowel held 3 s at the body's speaking pitch with the default source. */
  const shimmer = (b, ipa, post) => {
    const rows = m.VOCAL_BODIES[b].vowelTargets;
    const idx = m.VOCAL_TABLE_PHONEMES.indexOf(ipa);
    const saved = rows[idx];
    if (post) rows[idx] = Array.from(m.VOCAL_ARTICULATOR_NAMES, (k, i) => (keysFor(ipa).includes(k) ? post[i] : NaN));
    const sr = 48000;
    const f0 = SPEECH_HZ[b];
    const params = {};
    for (const p of m.vocalEngine.params) params[p.name] = p.default;
    Object.assign(params, { body: b, vibratoDepth: 0, drift: 0 });
    const v = m.vocalEngine.createVoice(sr, params, m.rng('norms-' + ipa + b));
    for (const [k, val] of Object.entries(params)) v.setParam(k, val);
    v.setParam('phoneme', idx);
    v.noteOn(f0, 0.8);
    const n = 3 * sr;
    const x = new Float32Array(n);
    const r = new Float32Array(n);
    for (let i = 0; i < n; i += 128) v.process(x, r, i, Math.min(n, i + 128));
    rows[idx] = saved;
    const a = Math.exp((-2 * Math.PI * 1.25 * f0) / sr);
    const y = Float32Array.from(x);
    for (let pass = 0; pass < 6; pass++) {
      let s = 0;
      for (let i = 0; i < y.length; i++) {
        s = a * s + (1 - a) * y[i];
        y[i] = s;
      }
    }
    const from = Math.round(0.8 * sr);
    const to = n - Math.round(0.1 * sr);
    let dc = 0;
    for (let i = from; i < to; i++) dc += y[i];
    dc /= to - from;
    const zc = [];
    for (let i = from; i < to; i++) if (y[i - 1] - dc < 0 && y[i] - dc >= 0) zc.push(i);
    const A = [];
    for (let k = 1; k < zc.length; k++) {
      let pk = 0;
      for (let i = zc[k - 1]; i < zc[k]; i++) pk = Math.max(pk, Math.abs(x[i]));
      A.push(pk);
    }
    let ds = 0;
    for (let k = 1; k < A.length; k++) ds += Math.abs(A[k] - A[k - 1]);
    return (100 * ds) / (A.length - 1) / (A.reduce((p, c) => p + c, 0) / A.length);
  };

  const out = {
    note: 'Generated by scripts/gen-calibrated-vowels.mjs. Bellows data (MIT): General American vowels re-solved per body against Hillenbrand et al. (1995), kept only where they measure closer than CHIMERA\'s.',
    targets: HILLENBRAND,
    measured: {},
    vowelTargetsByBody: {},
  };
  for (const [b, name] of BODIES.entries()) {
    out.vowelTargetsByBody[name] = {};
    out.measured[name] = {};
    for (const [ipa, groups] of Object.entries(HILLENBRAND)) {
      const t = groups[b];
      const before = render(b, ipa, null);
      const beforeErr = err(before, t);
      const aim = { f1: t[0], f2: t[1], f3: t[2] };
      const candidates = [];
      for (let round = 0; round < 6; round++) {
        const names = m.VOCAL_ARTICULATOR_NAMES;
        const free = F3_VOWELS.has(ipa)
          ? ['jaw', 'tbX', 'tbY', 'root', 'lipAp', 'lipProt', 'ttX', 'ttY', 'ttCurl'].map((k) => names.indexOf(k))
          : undefined;
        const fit = m.solveVowel(geos[b], aim, posture(b, ipa), { free, f3Weight: F3_VOWELS.has(ipa) ? 1 : 0.5 });
        const meas = render(b, ipa, fit.posture);
        const e = err(meas, t);
        if (e < beforeErr) candidates.push({ err: e, posture: fit.posture, meas });
        if (e < 0.02) break;
        aim.f1 *= (t[0] / meas[0]) ** 0.7;
        aim.f2 *= (t[1] / meas[1]) ** 0.7;
        if (meas.length > 2) aim.f3 *= (t[2] / meas[2]) ** 0.7;
      }
      candidates.sort((p, q) => p.err - q.err);
      const shimBefore = shimmer(b, ipa, null);
      let best = { err: beforeErr, posture: null, meas: before, shim: shimBefore };
      for (const c of candidates) {
        const sh = shimmer(b, ipa, c.posture);
        if (sh <= shimBefore + SHIMMER_SLACK) {
          best = { ...c, shim: sh };
          break;
        }
        console.log(`  ${name} ${ipa}: a fit at ${(100 * c.err).toFixed(1)}% rejected, shimmer ${sh.toFixed(2)}% against ${shimBefore.toFixed(2)}%`);
      }
      const kept = best.posture !== null;
      console.log(
        `${name} ${ipa}: ${before.map(Math.round).join('/')} (${(100 * beforeErr).toFixed(1)}%, shimmer ${shimBefore.toFixed(2)}%) -> ` +
          `${best.meas.map(Math.round).join('/')} (${(100 * best.err).toFixed(1)}%, shimmer ${best.shim.toFixed(2)}%) for ${t.slice(0, before.length).join('/')}` +
          (kept ? '' : ', kept CHIMERA\'s'),
      );
      out.measured[name][ipa] = {
        target: t.slice(0, before.length),
        before: before.map(Math.round),
        after: best.meas.map(Math.round),
        shimmer: [Number(shimBefore.toFixed(2)), Number(best.shim.toFixed(2))],
      };
      if (kept) {
        const row = {};
        for (const k of keysFor(ipa)) row[k] = Number(best.posture[m.VOCAL_ARTICULATOR_NAMES.indexOf(k)].toPrecision(6));
        out.vowelTargetsByBody[name][ipa] = row;
      }
    }
  }
  const text = JSON.stringify(out, null, 1) + '\n';
  const target = join(pkg, 'data/vocal/calibrated-vowels.json');
  if (process.argv.includes('--check')) {
    let old = '';
    try {
      old = readFileSync(target, 'utf8');
    } catch {}
    if (old !== text) {
      console.error('data/vocal/calibrated-vowels.json is stale: run npm run gen:calibrate');
      process.exit(1);
    }
    console.log('calibrated vowels up to date');
  } else {
    writeFileSync(target, text);
    console.log('calibrated vowels written');
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
