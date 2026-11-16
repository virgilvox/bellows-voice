# bellows-voice

A singing and speaking voice for [bellows](https://bellows.live). It is an articulatory synthesizer, a physical model of a singer: lyrics move 17 articulators (jaw, tongue, lips, velum and the rest), their positions become the shape of the throat and mouth, and air from the lungs flows through that shape in a waveguide airway. It sings and speaks English in eight accents, and IPA.

```sh
npm install bellowsjs bellows-voice
```

```js
import { Bellows } from 'bellowsjs';
import { voice, singer } from 'bellows-voice';

const b = await Bellows.boot({ plugins: [voice] });   // from a click handler
const alto = singer(b, { body: 1 });                   // 0 male, 1 female, 2 child

alto.sing('twinkle twinkle little star', [
  { note: 'C4', dur: '4n' }, { note: 'C4', dur: '4n' },
  { note: 'G4', dur: '4n' }, { note: 'G4', dur: '4n' },
  { note: 'A4', dur: '4n' }, { note: 'A4', dur: '4n' },
  { note: 'G4', dur: '2n' },
], { at: b.now() + 0.5 });

alto.speak('Good morning. Where are you from?', { accent: 'australian' });
```

`voice` is a bellows plugin: the engine, prebuilt as one script that loads into bellows' AudioWorklet beside its kernel, so a page that never sings never loads it. `singer(b, params, opts)` makes an instrument on it and gives it `sing()` and `speak()`, which reach bellows only through its public API. Notes go through bellows' tempo map and tuning like any other note.

## In a single HTML file, from a CDN

bellows-voice imports `bellowsjs` by name, so a page without a bundler maps that name with an import map. The map is also what makes the page and the voice share one copy of bellows; with two copies, `singer()` cannot see the plugin and throws.

```html
<script type="importmap">
  { "imports": { "bellowsjs": "https://cdn.jsdelivr.net/npm/bellowsjs@0.5/dist/bellows.js" } }
</script>
<script type="module">
  import { Bellows } from 'bellowsjs';
  import { voice, singer } from 'https://cdn.jsdelivr.net/npm/bellows-voice@0.4/dist/index.js';

  document.querySelector('button').onclick = async () => {
    const b = await Bellows.boot({ plugins: [voice] });
    singer(b, { body: 1 }).speak('Hello from a single file.');
  };
</script>
<button>Speak</button>
```

The other entries load the same way: `.../dist/text.js`, `.../dist/view.js`, `.../dist/engine.js`. unpkg serves the same files (`https://unpkg.com/bellows-voice@0.4/dist/index.js`).

## Starter voices

```js
const soprano = singer(b, 'soprano');            // or 'bass', 'baritone', 'tenor', 'contralto', 'mezzo',
const host = singer(b, 'narrator-female');       // 'narrator-male', 'pop-female', 'pop-male', 'child', 'rock', 'elder'
host.speak('Good evening.');                     // at the voice's own speaking pitch
```

`VOICE_PRESETS` lists them, each with its group (male, female, child), the engine params, a speaking pitch inside the published range for its group, and the range it sings in. The values come from published norms and from measuring this voice against them; `docs/VOICE-NORMS.md` has the sources and the measurements.

## With Vite

Vite's dev server pre-bundles dependencies, and would fold its own copy of bellowsjs into
bellows-voice, which then cannot see the plugin your copy loaded. Keep it out of the pre-bundle:

```js
// vite.config.js
export default { optimizeDeps: { exclude: ['bellows-voice'] } };
```

## Accents

```js
const tenor = singer(b, { body: 0 }, { accent: 'southern-british' });
tenor.sing('the water in the bath was far too hot', melody, { accent: 'scottish' });
```

Thirty-one are built in, each with a `region` (`ACCENT_REGIONS`):

| Region | Accents |
|---|---|
| North America | `general-american` (the default), `canadian`, `californian`, `new-york`, `boston`, `inland-north`, `southern-us` |
| England | `received-pronunciation`, `southern-british`, `london`, `west-country`, `brummie`, `scouse`, `northern-english`, `geordie` |
| Scotland, Wales and Ireland | `scottish`, `welsh`, `irish`, `northern-irish` |
| Southern hemisphere | `australian`, `new-zealand`, `south-african` |
| Africa | `nigerian`, `ghanaian`, `kenyan` |
| Caribbean | `jamaican`, `trinidadian` |
| Asia | `indian`, `singaporean`, `filipino` |
| Europe (English as a second language) | `russian` |

Each is a broad transcription of the accent's mainstream form, from the published lexical-set tables (sources in `src/lyrics/accents.ts`), not a recording of any one speaker. An accent is plain data: each of Wells's lexical sets (KIT, BATH, GOAT, NURSE...) voiced as a vowel or a diphthong with its glide timing, whether r after a vowel is said, its t, l, th, r and h rules, consonants it swaps (Russian w as v) and whether it devoices a word's last consonant, vowels raised before voiceless consonants (Canadian "price" and "house"), and a speech melody: the final tune, the pitch range, the rate, and how much longer a stressed syllable is than an unstressed one (about twice in British or American English, nearly the same in the syllable-timed Englishes of India, Nigeria, Singapore and Jamaica). Spread a built-in to make your own:

```js
import { ACCENTS } from 'bellows-voice';
const mine = { ...ACCENTS.irish, id: 'mine', sets: { ...ACCENTS.irish.sets, FACE: 'eɪ' } };
```

## Text to IPA, without audio

```js
import { toIPA, pronounce } from 'bellows-voice/text';

toIPA('far away', { accent: 'southern-british' });   // 'fɑɹ ə.ˈweɪ'
pronounce('hello').words[0].sets;                     // [undefined, 'GOAT']
```

`bellows-voice/text` is pure TypeScript with no audio and no bellows, for a page, a server or a test.

## Drawing the mouth

`bellows-voice/view` runs the voice's own geometry on its articulator targets, for a UI to draw:

```js
import { TractModel } from 'bellows-voice/view';
const tract = new TractModel(1);          // body
tract.target('i');                        // follow the plan's spans as they play
tract.step(1 / 60);                       // articulators move at the engine's speeds
const { upper, lower, velumPort, lipArea } = tract.shape();   // centimetres, glottis to lips
```

## Rendering

`b.render()` renders through the worklet with the plugin loaded, exactly as it plays. To render with `renderOffline()` or in Node without a worklet, register the engine on that thread:

```js
import { renderOffline, registerBuiltins } from 'bellowsjs';
import { registerVoice } from 'bellows-voice/engine';
registerBuiltins();
registerVoice();
```

## Pronunciations

Words go through English letter-to-sound rules unless you give a pronouncing dictionary: `alto.dictionary = parseCmudict(text)` with your own copy of CMUdict (none ships). IPA between slashes, `/ˈlɪt.əl/`, sets the sounds directly.

## Content-Security-Policy

The plugin loads through a blob URL, as bellows' kernel does. A host that blocks blob: script sources serves `bellows-voice/worklet.js` itself and passes `{ ...voice, workletUrl: '/path/to/worklet.js' }`.

## Credits

The voice owes a large debt to [CHIMERA](https://github.com/jamesondh/chimera-vocal-synth), Jameson Hodge's physical-model voice synthesizer (MIT): the articulators and their speeds, the gesture planner, the mouth geometry, the airway's physical elements, the glottal source and the lyric front end are ported from it or learned from its code (THIRD_PARTY_NOTICES.md). The waveguide airway, the pitch behaviour, accents, speech and the vowel solver are bellows-voice's own.

Documentation: [bellows.live/docs/singing](https://bellows.live/docs/singing). Design notes: `docs/`.

MIT License.
