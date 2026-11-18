/*
 * The pronouncing dictionary, its own entry ('bellows-voice/dict', about 590 KB gzipped) so a page loads
 * it only when it wants every word right:
 *
 *   import { cmudict } from 'bellows-voice/dict';
 *   const v = singer(b, 'narrator-female', { dictionary: cmudict() });
 *   toIPA('Harvard', { dictionary: cmudict() });   // 'ˈhɑɹ.vɚd'
 *
 * Without it the English reader's rules read about 77 percent of common words exactly as CMU does.
 */

export { cmudict, CMUDICT_SIZE } from './dict/cmudict';
