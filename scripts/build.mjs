/*
 * The package's ESM bundles: dist/index.js (plugin, singer, text), dist/text.js (the text layer
 * alone), dist/engine.js (the engine on the calling thread), dist/view.js (the mouth, for a UI)
 * and dist/dict.js (the CMU dictionary), sharing chunks, with bellowsjs left as an import for the host's copy.
 */

import { build } from 'esbuild';
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANNER } from './banner.mjs';

const pkg = join(dirname(fileURLToPath(import.meta.url)), '..');

// a clean folder: esbuild names chunks by content, so an old build's chunks would otherwise ship too
rmSync(join(pkg, 'dist'), { recursive: true, force: true });

await build({
  entryPoints: [join(pkg, 'src/index.ts'), join(pkg, 'src/text.ts'), join(pkg, 'src/engine.ts'), join(pkg, 'src/view.ts'), join(pkg, 'src/dict.ts')],
  outdir: join(pkg, 'dist'),
  bundle: true,
  splitting: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  sourcemap: true,
  external: ['bellowsjs'],
  // kept: the CMU dictionary's copyright line travels with its data (src/dict/cmudict-data.gen.ts)
  legalComments: 'inline',
  banner: { js: BANNER },
  logLevel: 'error',
});
console.log('dist/index.js, text.js, engine.js, view.js and dict.js written');
