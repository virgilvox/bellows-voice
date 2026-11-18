/*
 * Numbers, symbols and letter names as words, before a line is read: "3" is three, "21st" twenty-first,
 * "1984" nineteen eighty-four, "$5.50" five dollars and fifty cents, "10:05" ten oh five, "50%" fifty
 * percent, "&" and, and "TV" the letters tee vee. Read speech's conventions for American English; IPA
 * between slashes is left as written. Pure text: no audio.
 *
 * Compound numbers are written with spaces ("twenty three"): the reader takes a hyphen as a syllable
 * break it must show. Letter names go in as IPA between slashes ("/ti.ˈvi/"), so they are said exactly, stress on the last
 * letter as an initialism takes it. A word in capitals is spelled out when it has no vowel letter,
 * Y counting as one ("TV", "BBC", but "MY", "WHY"), or is a common initialism with one (INITIALISMS);
 * other capitals ("NASA") are words. Decades ("1990s"), clock times with a.m. and p.m., a minus sign,
 * dotted initialisms ("U.S.") and numbers against letters ("MP3") are read too.
 */

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'];
const ORDINAL_WORDS: Record<string, string> = {
  one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth',
};

/** A whole number under 1000 in words ("one hundred twenty-three"). */
function under1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(ONES[h], 'hundred');
  if (r > 0 || h === 0) parts.push(r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? ' ' + ONES[r % 10] : ''));
  return parts.join(' ');
}

/** A whole number in words ("twelve thousand three hundred"); past the safe integers, digit by digit. */
export function cardinal(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (n < 0) return 'minus ' + cardinal(-n);
  n = Math.floor(n);
  if (n === 0) return 'zero';
  if (n > Number.MAX_SAFE_INTEGER) return digits(String(n));
  const groups: string[] = [];
  for (let s = 0; n > 0 && s < SCALES.length; s++) {
    const g = n % 1000;
    if (g > 0) groups.unshift(under1000(g) + (SCALES[s] ? ' ' + SCALES[s] : ''));
    n = Math.floor(n / 1000);
  }
  return groups.join(' ');
}

/** An ordinal in words ("twenty-first"). */
export function ordinal(n: number): string {
  const words = cardinal(n);
  const m = /([a-z]+)$/.exec(words);
  if (!m) return words;
  const last = m[1];
  const ord = ORDINAL_WORDS[last] ?? (last.endsWith('y') ? last.slice(0, -1) + 'ieth' : last + 'th');
  return words.slice(0, words.length - last.length) + ord;
}

/** A year as it is read: 1984 nineteen eighty-four, 1900 nineteen hundred, 2005 two thousand five, 2026 twenty twenty-six. */
export function year(n: number): string {
  if (!Number.isInteger(n) || n < 1000 || n > 9999) return cardinal(n);
  if (n >= 2000 && n <= 2009) return cardinal(n);
  const hi = Math.floor(n / 100);
  const lo = n % 100;
  if (lo === 0) return cardinal(hi) + ' hundred';
  return cardinal(hi) + ' ' + (lo < 10 ? 'oh ' + ONES[lo] : cardinal(lo));
}

/** The letters' names as IPA. */
const LETTERS: Record<string, string> = {
  a: 'eɪ', b: 'bi', c: 'si', d: 'di', e: 'i', f: 'ɛf', g: 'dʒi', h: 'eɪtʃ', i: 'aɪ', j: 'dʒeɪ', k: 'keɪ', l: 'ɛl', m: 'ɛm',
  n: 'ɛn', o: 'oʊ', p: 'pi', q: 'kju', r: 'ɑɹ', s: 'ɛs', t: 'ti', u: 'ju', v: 'vi', w: 'dʌ.bəl.ju', x: 'ɛks', y: 'waɪ', z: 'zi',
};
/** Capitalized initialisms that have a vowel letter but are said letter by letter. */
const INITIALISMS = new Set([
  'USA', 'UK', 'EU', 'AI', 'ID', 'IOU', 'CEO', 'UFO', 'DIY', 'FAQ', 'ATM', 'URL', 'API', 'USB', 'GPU', 'CPU', 'BBQ', 'DJ',
  'MC', 'TBA', 'ETA', 'EP', 'LP', 'OK', 'FBI', 'CIA', 'IRS', 'ICU', 'IQ', 'IT', 'PE', 'PA', 'RIP', 'MVP', 'VIP', 'RV', 'BA', 'MA',
  'NY', 'NYC', 'NYU', 'NYPD', 'LA', 'DC',
]);
/* Capitals said as a word though they look like letters (a Y between consonants is a vowel). */
const VOWEL_LETTER = /[AEIOUY]/;

/** A word in capitals as its letters, IPA between slashes, the last letter stressed ("/ti.ˈvi/"); `plural` 'z' for "TVs". */
export function letters(word: string, plural: '' | 'z' = ''): string {
  const names = Array.from(word.toLowerCase())
    .map((c) => LETTERS[c])
    .filter((x): x is string => !!x);
  if (names.length === 0) return word;
  const last = names.length - 1;
  return '/' + names.map((n, i) => (i === last ? 'ˈ' + n : n)).join('.') + plural + '/';
}

/**
 * IPA between slashes, by the reader's rule (read.ts, delimitedWordEnd): the opening slash not right
 * after a letter or digit nor before a space, the closing one not right after a space. So the slash
 * of "and/or" is not IPA.
 */
export const IPA_SPAN = String.raw`(?<![\p{L}\p{M}\p{N}])\/(?![\s/])[^/\n\r]*(?<!\s)\/`;
const IPA_SPLIT = new RegExp('(' + IPA_SPAN + ')', 'u');

/** Numbers, symbols and initialisms in `text` as words, IPA between slashes untouched. */
export function spellOut(text: string): string {
  return text
    .split(IPA_SPLIT)
    .map((part, i) => (i % 2 === 1 ? part : spellPart(part)))
    .join('');
}

function spellPart(s: string): string {
  return (
    s
      .replace(/&/g, ' and ')
      // a minus sign before a number: -5, (−3)
      .replace(/(^|[\s(])[-−](?=\d)/g, '$1minus ')
      // dotted initialisms: U.S., U.K., a.m. is below
      .replace(/(?<![\p{L}.])((?:[A-Z]\.){2,})(?=[^\p{L}]|$)/gu, (w: string) => letters(w.replace(/\./g, '')))
      // money: $5, $5.50, $1,200
      .replace(/\$(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?\b/g, (_, d: string, c?: string) => {
        const dollars = Number(d.replace(/,/g, ''));
        const say = `${cardinal(dollars)} ${dollars === 1 ? 'dollar' : 'dollars'}`;
        const cents = c ? Number(c) : 0;
        const c$ = `${cardinal(cents)} ${cents === 1 ? 'cent' : 'cents'}`;
        return cents ? (dollars === 0 ? c$ : `${say} and ${c$}`) : say;
      })
      // clock times: 10:30, 9:05, 10:00, 3pm, 7:30 a.m.
      .replace(/\b(\d{1,2})(?::(\d{2}))?\s?([ap])\.?m\b\.?/gi, (_, h: string, m: string | undefined, ap: string) =>
        `${clock(h, m, true)} ${letters(ap.toUpperCase() + 'M')}`,
      )
      .replace(/\b(\d{1,2}):(\d{2})\b/g, (_, h: string, m: string) => clock(h, m, false))
      // ordinals: 1st, 22nd, 103rd, 4th
      .replace(/\b(\d+)(st|nd|rd|th)\b/gi, (_, d: string) => ordinal(Number(d)))
      // decades and plurals of numbers: 1990s, '90s, 90s, 1900s
      .replace(/'?\b(\d{2}|\d{4})'?s\b/g, (_, d: string) => plural(d.length === 4 ? year(Number(d)) : cardinal(Number(d))))
      // percentages
      .replace(/\b(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)%/g, (_, d: string) => `${number(d)} percent`)
      // a number against letters ("MP3", "4x4", "A1") is still a number
      .replace(/(\p{L})(?=\d)/gu, '$1 ')
      .replace(/(\d)(?=\p{L})/gu, '$1 ')
      // decimals and numbers with thousands separators
      .replace(/\b\d{1,3}(?:,\d{3})+\b|\b\d+\.\d+\b|\b\d+\b/g, (d: string) => {
        if (/^\d{4}$/.test(d) && Number(d) >= 1100 && Number(d) <= 2099) return year(Number(d));
        return number(d);
      })
      // initialisms: capitals with no vowel letter, or the common ones that have one; "TVs", "DJ's"
      .replace(/\b([A-Z]{2,6})('?s)?\b/g, (w: string, caps: string, pl?: string) =>
        !VOWEL_LETTER.test(caps) || INITIALISMS.has(caps) ? letters(caps, pl ? 'z' : '') : w,
      )
  );
}

/** A clock time: "ten thirty", "nine oh five", "ten o'clock" (or plain "ten" before a.m. or p.m.). */
function clock(h: string, m: string | undefined, meridiem: boolean): string {
  const mm = m === undefined ? 0 : Number(m);
  return `${cardinal(Number(h))}${mm === 0 ? (meridiem ? '' : " o'clock") : ' ' + (mm < 10 ? 'oh ' + ONES[mm] : cardinal(mm))}`;
}

/** A number's words made plural: "nineteen nineties", "twenties", "nineteen hundreds". */
function plural(words: string): string {
  return words.endsWith('y') ? words.slice(0, -1) + 'ies' : words + 's';
}

/** Digits one by one ("zero zero seven"). */
function digits(d: string): string {
  return Array.from(d.replace(/\D/g, ''), (c) => ONES[Number(c)]).join(' ');
}

/** A number written with digits, decimals read digit by digit after "point". */
function number(d: string): string {
  const clean = d.replace(/,/g, '');
  const [whole, frac] = clean.split('.');
  // a code with leading zeros ("007") or a number too long to say is read digit by digit
  const w = (whole.length > 1 && whole.startsWith('0') && !d.includes(',')) || whole.length > 15 ? digits(whole) : cardinal(Number(whole));
  return frac ? `${w} point ${digits(frac)}` : w;
}
