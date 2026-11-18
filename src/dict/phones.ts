/*
 * ARPAbet phones with their stress, one character each, for the compact dictionary data
 * (scripts/gen-dict.mjs writes it, src/dict/cmudict.ts reads it). The 15 vowels at stress 0, 1 and 2,
 * then the 24 consonants: 69 phones on 69 characters chosen to need no escaping in a JSON string.
 */

const VOWELS = ['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW'];
const CONSONANTS = ['B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K', 'L', 'M', 'N', 'NG', 'P', 'R', 'S', 'SH', 'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH'];

/** Every phone, in the order of PHONE_CHARS. */
export const PHONES: readonly string[] = [...VOWELS.flatMap((v) => [v + '0', v + '1', v + '2']), ...CONSONANTS];

/** One character a phone. */
export const PHONE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#%&()*+';
