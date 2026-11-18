import { describe, expect, it } from 'vitest';
import { cardinal, letters, ordinal, spellOut, year } from '../../src/lyrics/numbers';
import { toIPA } from '../../src/lyrics/pronounce';
import { cmudict } from '../../src/dict';

describe('numbers, symbols and letters as words', () => {
  it('says cardinals, ordinals and years', () => {
    expect(cardinal(0)).toBe('zero');
    expect(cardinal(123)).toBe('one hundred twenty three');
    expect(cardinal(12300)).toBe('twelve thousand three hundred');
    expect(cardinal(1000001)).toBe('one million one');
    expect(ordinal(1)).toBe('first');
    expect(ordinal(22)).toBe('twenty second');
    expect(ordinal(40)).toBe('fortieth');
    expect(ordinal(112)).toBe('one hundred twelfth');
    expect(year(1984)).toBe('nineteen eighty four');
    expect(year(1900)).toBe('nineteen hundred');
    expect(year(1905)).toBe('nineteen oh five');
    expect(year(2005)).toBe('two thousand five');
    expect(year(2026)).toBe('twenty twenty six');
  });

  it('spells out a line, leaving IPA between slashes alone', () => {
    expect(spellOut('I have 3 cats')).toBe('I have three cats');
    expect(spellOut('in 1984 & 2026')).toBe('in nineteen eighty four  and  twenty twenty six');
    expect(spellOut('$5.50 at 10:05, 50% off, the 21st')).toBe('five dollars and fifty cents at ten oh five, fifty percent off, the twenty first');
    expect(spellOut('pi is 3.14')).toBe('pi is three point one four');
    expect(spellOut('1,200 people')).toBe('one thousand two hundred people');
    expect(spellOut('watch TV with the BBC, not NASA')).toBe('watch /ti.ˈvi/ with the /bi.bi.ˈsi/, not NASA');
    expect(spellOut('/ˈtu/ 2')).toBe('/ˈtu/ two');
    expect(letters('USA')).toBe('/ju.ɛs.ˈeɪ/');
  });

  it('reads a line with numbers through, with the dictionary', () => {
    expect(toIPA('I have 2 dogs', { dictionary: cmudict() })).toBe('aɪ hæv tu dɑgz');
    expect(toIPA('TV')).toBe('ti.ˈvi');
  });
});
