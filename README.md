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

## Accents

```js
const tenor = singer(b, { body: 0 }, { accent: 'southern-british' });
tenor.sing('the water in the bath was far too hot', melody, { accent: 'scottish' });
```

Built in: `general-american` (the default), `southern-british`, `london`, `australian`, `new-zealand`, `irish`, `scottish`, `southern-us`. An accent is plain data: each of Wells's lexical sets (KIT, BATH, GOAT, NURSE...) voiced as a vowel or a diphthong with its glide timing, whether r after a vowel is said, and its t, l, th, r and h rules. Spread a built-in to make your own:

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
