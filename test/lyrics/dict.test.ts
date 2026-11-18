import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { cmudict, CMUDICT_SIZE } from '../../src/dict';
import { isHandWord, pronounceEnglish } from '../../src/lyrics/english';
import { arpabetToSegments } from '../../src/lyrics/arpabet';
import { toIPA } from '../../src/lyrics/pronounce';

const key = (segs: { ipa: string; stress?: number }[]) => segs.map((s) => s.ipa + (s.stress ?? '')).join(' ');

describe('the pronouncing dictionary', () => {
  it('with the English reader says every CMU word as CMU does, though it holds only the reader\'s mistakes', () => {
    const text = gunzipSync(readFileSync(new URL('../../data/cmudict/cmudict.txt.gz', import.meta.url))).toString('utf8');
    const dict = cmudict();
    let n = 0;
    let wrong = 0;
    const misses: string[] = [];
    for (const line of text.split('\n')) {
      const tab = line.indexOf('\t');
      if (tab < 0) continue;
      const word = line.slice(0, tab).trim();
      // the words the reader can look up: none with an edge apostrophe, which it strips first
      if (!/^[a-z][a-z']*[a-z]$|^[a-z]$/.test(word)) continue;
      n++;
      // the reader's own tables are its choice, ahead of the dictionary (english.ts, isHandWord)
      if (isHandWord(word)) continue;
      if (key(pronounceEnglish(word, { dictionary: dict })) !== key(arpabetToSegments(line.slice(tab + 1).trim()))) {
        wrong++;
        if (misses.length < 5) misses.push(word);
      }
    }
    expect(n).toBe(CMUDICT_SIZE);
    expect(misses).toEqual([]);
    expect(wrong).toBe(0);
    expect(dict.size).toBeLessThan(n);
  }, 120000);

  it('reads the words the rules miss', () => {
    const dict = cmudict();
    expect(toIPA('Harvard', { dictionary: dict })).toBe('ˈhɑɹ.vɚd');
    expect(toIPA('Harvard')).not.toBe('ˈhɑɹ.vɚd');
    expect(toIPA('bead', { dictionary: dict })).toBe('bid');
  });
});
