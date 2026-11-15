/* Writes dist/worklet.js, the plugin's script as a file, for hosts whose CSP blocks blob: sources (voice.workletUrl). */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = join(dirname(fileURLToPath(import.meta.url)), '..');
const gen = readFileSync(join(pkg, 'src/worklet-code.gen.ts'), 'utf8');
const match = gen.match(/workletCode: string = (".*");/s);
if (!match) throw new Error('could not extract the worklet script from worklet-code.gen.ts');
writeFileSync(join(pkg, 'dist/worklet.js'), JSON.parse(match[1]));
console.log('dist/worklet.js written');
