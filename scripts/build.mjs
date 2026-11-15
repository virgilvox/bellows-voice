/*
 * The package's ESM bundles: dist/index.js (plugin, singer, text), dist/text.js (the text layer
 * alone) dist/engine.js (the engine on the calling thread) and dist/view.js (the
 * mouth, for a UI), sharing chunks, with bellowsjs left as an import for the host's copy.
 */

import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANNER } from './banner.mjs';

const pkg = join(dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [join(pkg, 'src/index.ts'), join(pkg, 'src/text.ts'), join(pkg, 'src/engine.ts'), join(pkg, 'src/view.ts')],
  outdir: join(pkg, 'dist'),
  bundle: true,
  splitting: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  sourcemap: true,
  external: ['bellowsjs'],
  legalComments: 'none',
  banner: { js: BANNER },
  logLevel: 'error',
});
console.log('dist/index.js, text.js, engine.js and view.js written');
