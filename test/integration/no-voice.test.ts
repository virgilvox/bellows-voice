/*
 * A singer on a bellows instance that never loaded the voice. Its own file, because the engine
 * catalog is per thread: once any test in a worker loads the plugin, 'vocal' is listed for all.
 */

import { describe, it, expect } from 'vitest';
import { Bellows } from 'bellowsjs';
import { singer } from '../../src/singer';
import { FakeAudioContext, installFakeAudio } from './fake-context';

describe('singer() without the voice', () => {
  it('throws, saying how to load it', async () => {
    installFakeAudio();
    const b = await Bellows.boot({ seed: 'none', workletUrl: 'fake://worklet', context: new FakeAudioContext() as unknown as AudioContext });
    expect(() => singer(b)).toThrow(/plugins: \[voice\]/);
    b.dispose();
  });
});
