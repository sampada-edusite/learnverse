/**
 * Understanding what a child said during voice ("Talk mode") practice:
 * spoken commands (next / repeat / hint / stop) and matching a spoken answer to a
 * multiple-choice option, in English and Marathi.
 */

export type VoiceCommand = 'next' | 'repeat' | 'hint' | 'stop';

const DEVANAGARI_DIGITS: Record<string, string> = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };

const EN_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  hundred: 100,
};

const MR_NUMBERS: Record<string, number> = {
  'शून्य': 0, 'एक': 1, 'दोन': 2, 'तीन': 3, 'चार': 4, 'पाच': 5, 'सहा': 6, 'सात': 7, 'आठ': 8, 'नऊ': 9, 'दहा': 10,
  'अकरा': 11, 'बारा': 12, 'तेरा': 13, 'चौदा': 14, 'पंधरा': 15, 'सोळा': 16, 'सतरा': 17, 'अठरा': 18, 'एकोणीस': 19,
  'वीस': 20, 'तीस': 30, 'चाळीस': 40, 'पन्नास': 50, 'साठ': 60, 'सत्तर': 70, 'ऐंशी': 80, 'नव्वद': 90, 'शंभर': 100,
};

const COMMANDS: { cmd: VoiceCommand; phrases: string[] }[] = [
  { cmd: 'next', phrases: ['next', 'next question', 'go next', 'continue', 'go on', 'पुढे', 'पुढचा', 'पुढील', 'पुढचा प्रश्न', 'पुढे चल'] },
  { cmd: 'repeat', phrases: ['repeat', 'again', 'say again', 'read again', 'once more', 'पुन्हा', 'परत', 'पुन्हा वाचा', 'पुन्हा सांग'] },
  { cmd: 'hint', phrases: ['hint', 'help', 'clue', 'give me a hint', 'सूचना', 'मदत', 'इशारा', 'संकेत'] },
  { cmd: 'stop', phrases: ['stop', 'stop listening', 'cancel', 'थांब', 'थांबा', 'बंद'] },
];

const ORDINALS: { index: number; words: string[] }[] = [
  { index: 0, words: ['a', 'first', 'option a', 'option one', 'number one', 'पहिला', 'पहिले', 'पहिली'] },
  { index: 1, words: ['b', 'second', 'option b', 'option two', 'number two', 'दुसरा', 'दुसरे', 'दुसरी'] },
  { index: 2, words: ['c', 'third', 'option c', 'option three', 'number three', 'तिसरा', 'तिसरे', 'तिसरी'] },
  { index: 3, words: ['d', 'fourth', 'option d', 'option four', 'number four', 'चौथा', 'चौथे', 'चौथी'] },
];

/** Lower-case, strip punctuation, convert Devanagari digits; keeps Devanagari letters. */
export const normalizeSpoken = (text: string) =>
  (text || '')
    .toLowerCase()
    .replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS[d] ?? d)
    .replace(/[.,!?।"'`’“”()\[\]{}:;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** "twenty five" -> 25, "पाच" -> 5, "7" -> 7; null when the phrase is not a number. */
export const spokenNumber = (text: string): number | null => {
  const t = normalizeSpoken(text);
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  if (MR_NUMBERS[t] !== undefined) return MR_NUMBERS[t];
  const words = t.replace(/-/g, ' ').split(' ').filter((w) => w && w !== 'and');
  if (!words.length || !words.every((w) => EN_NUMBERS[w] !== undefined)) return null;
  let total = 0;
  for (const w of words) {
    const v = EN_NUMBERS[w];
    total = v === 100 ? (total || 1) * 100 : total + v;
  }
  return total;
};

export const parseVoiceCommand = (text: string): VoiceCommand | null => {
  const t = normalizeSpoken(text);
  if (!t || t.split(' ').length > 4) return null; // commands are short; longer speech is an answer
  for (const { cmd, phrases } of COMMANDS) {
    if (phrases.some((p) => t === p || t === `${p} please` || t === `please ${p}`)) return cmd;
  }
  return null;
};

/** The option the child meant, or null. Accepts the option text, its number, or "first"/"option B"/"दुसरा". */
export const matchSpokenOption = (text: string, options: string[]): string | null => {
  const t = normalizeSpoken(text);
  if (!t || !options?.length) return null;
  const norm = options.map((o) => normalizeSpoken(o.replace(/^\s*\(?[A-Da-d1-4]\)?[.\-:)]\s*/, '')));

  const exact = norm.findIndex((o) => o === t);
  if (exact >= 0) return options[exact];

  const said = spokenNumber(t);
  if (said !== null) {
    const byNumber = norm.findIndex((o) => spokenNumber(o) === said);
    if (byNumber >= 0) return options[byNumber];
  }

  for (const { index, words } of ORDINALS) {
    if (index < options.length && words.includes(t)) return options[index];
  }

  // The answer said inside a short sentence ("the answer is seven", "उत्तर सात")
  const padded = ` ${t} `;
  const contained = norm
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => o.length >= 2 && padded.includes(` ${o} `))
    .sort((a, b) => b.o.length - a.o.length);
  if (contained.length === 1 || (contained.length > 1 && contained[0].o.length > contained[1].o.length)) {
    return options[contained[0].i];
  }
  const tail = t.split(' ').slice(-2).join(' ');
  const tailNumber = spokenNumber(tail) ?? spokenNumber(t.split(' ').slice(-1)[0]);
  if (tailNumber !== null) {
    const byTail = norm.findIndex((o) => spokenNumber(o) === tailNumber);
    if (byTail >= 0) return options[byTail];
  }
  return null;
};
