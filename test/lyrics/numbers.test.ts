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

describe('the cases the 2026-11-17 audit found', () => {
  it('reads capitals with Y as a word, and the initialisms that have a vowel', () => {
    expect(spellOut('WHY DO YOU CRY')).toBe('WHY DO YOU CRY');
    expect(spellOut('OK, the FBI')).toBe('/oʊ.ˈkeɪ/, the /ɛf.bi.ˈaɪ/');
    expect(spellOut('in the U.S. army')).toBe('in the /ju.ˈɛs/ army');
    expect(spellOut('DJs')).toBe('/di.ˈdʒeɪz/');
    expect(spellOut('NYC')).toBe('/ɛn.waɪ.ˈsi/');
  });
  it('keeps decades, clock times, a minus sign, codes and numbers against letters', () => {
    expect(spellOut('the 1990s and the 90s')).toBe('the nineteen nineties and the nineties');
    expect(spellOut('3pm')).toBe('three /pi.ˈɛm/');
    expect(spellOut('-5')).toBe('minus five');
    expect(spellOut('007')).toBe('zero zero seven');
    expect(spellOut('MP3')).toBe('/ɛm.ˈpi/ three');
    expect(spellOut('1,000%')).toBe('one thousand percent');
    expect(spellOut('$0.99')).toBe('ninety nine cents');
    expect(cardinal(1e15)).toBe('one quadrillion');
    expect(year(-5)).toBe('minus five');
  });
  it('takes a slash inside a word as a slash, not IPA, as the reader does', () => {
    expect(spellOut('and/or 3 pads/books')).toBe('and/or three pads/books');
    expect(spellOut('/ti.ˈvi/ 2')).toBe('/ti.ˈvi/ two');
  });
  it('says the number words right without the dictionary', () => {
    expect(toIPA('eleven hundred thousand percent')).toBe(toIPA('eleven hundred thousand percent', { dictionary: cmudict() }));
  });
  it('keeps the reader\'s one-syllable "fire" and "hour" with the dictionary loaded', () => {
    expect(toIPA('fire hour', { dictionary: cmudict() })).toBe(toIPA('fire hour'));
  });
});
