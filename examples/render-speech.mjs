/*
 * Text to a WAV file, with the phoneme spans and the articulator track beside it as JSON, in Node.
 * No AudioContext: the engine runs on this thread.
 *
 *   npm run build
 *   node examples/render-speech.mjs "Shall we meet at noon?" out
 *
 * writes out.wav and out.json. The same text and seed give the same files.
 */

import { writeFileSync } from 'node:fs';
import { renderSpeech } from 'bellows-voice/engine';

const text = process.argv[2] ?? 'Shall we meet at noon?';
const base = process.argv[3] ?? 'speech';

const out = renderSpeech(text, { voice: 'narrator-female', seed: 'example', frameRate: 60 });

writeFileSync(base + '.wav', Buffer.from(out.wav()));
writeFileSync(
  base + '.json',
  JSON.stringify({ text, sampleRate: out.sampleRate, frameRate: out.frameRate, spans: out.spans, track: out.track }, null, 1),
);
console.log(
  `${base}.wav: ${(out.samples.length / out.sampleRate).toFixed(2)} s; ` +
    `${base}.json: ${out.spans.length} spans, ${out.track.length} frames`,
);
