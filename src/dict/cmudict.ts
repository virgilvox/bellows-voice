/*
 * The CMU Pronouncing Dictionary as a PronouncingDictionary, for every English word the voice reads.
 * The data holds only the words the English reader gets wrong without a dictionary (scripts/gen-dict.mjs);
 * for every other word the reader already says what CMU says, so the reader with this map pronounces all
 * 124 911 of CMU's words as CMU does (test/lyrics/dict.test.ts). Decoded on first use, once.
 *
 * The Carnegie Mellon University Pronouncing Dictionary, Copyright (C) 1993-2015 Carnegie Mellon
 * University; BSD-style licence in data/cmudict/LICENSE and THIRD_PARTY_NOTICES.md.
 */

import type { PronouncingDictionary } from '../lyrics/types';
import { CMUDICT_DATA, CMUDICT_WORDS } from './cmudict-data.gen';
import { PHONES, PHONE_CHARS } from './phones';

let decoded: Map<string, string> | null = null;

/** The dictionary: lower-case word to ARPAbet with stress digits ("HH AA1 R V ER0 D"). */
export function cmudict(): PronouncingDictionary {
  if (decoded) return decoded;
  const phoneOf = new Map<string, string>();
  for (let i = 0; i < PHONES.length; i++) phoneOf.set(PHONE_CHARS[i], PHONES[i]);
  const map = new Map<string, string>();
  let prev = '';
  for (const line of CMUDICT_DATA.split('\n')) {
    const tab = line.indexOf('\t');
    const word = prev.slice(0, line.charCodeAt(0) - 48) + line.slice(1, tab);
    const ph: string[] = [];
    for (let i = tab + 1; i < line.length; i++) ph.push(phoneOf.get(line[i])!);
    map.set(word, ph.join(' '));
    prev = word;
  }
  decoded = map;
  return map;
}

/** How many words the dictionary covers (with the reader). */
export const CMUDICT_SIZE = CMUDICT_WORDS;
