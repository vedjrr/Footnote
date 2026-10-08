// Reading column names: splitting them into words, matching them against the
// word lists in analytics-spec §2, and turning them into labels and ids.

/** `firstResponseMinutes`, `first_response minutes` -> first, response, minutes. */
export function tokens(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

/** A token matches a word as is, as a plural or as a past tense: return, returned. */
function tokenMatches(token: string, word: string): boolean {
  return (
    token === word ||
    token === `${word}s` ||
    token === `${word}es` ||
    token === `${word}d` ||
    token === `${word}ed`
  );
}

/** True when any word of the name matches any of `words`. */
export function nameHas(name: string, words: readonly string[]): boolean {
  const ts = tokens(name);
  return words.some((w) => ts.some((t) => tokenMatches(t, w)));
}

/** The first of `words`, in list order, that the name matches; else null. */
export function firstWord(name: string, words: readonly string[]): string | null {
  const ts = tokens(name);
  return words.find((w) => ts.some((t) => tokenMatches(t, w))) ?? null;
}

const ID_ENDINGS = ['id', 'key', 'code', 'number', 'no'];

/** Names ending in `id`, `_key`, `code`, `number` or `no` (analytics-spec §2.3). */
export function isIdName(name: string): boolean {
  const ts = tokens(name);
  return ts.length > 0 && ID_ENDINGS.includes(ts[ts.length - 1]);
}

/** The name without its id ending and any `is_`/`has_` prefix: customer_id -> customer. */
export function stem(name: string): string[] {
  let ts = tokens(name);
  if (ts.length > 1 && ID_ENDINGS.includes(ts[ts.length - 1])) ts = ts.slice(0, -1);
  if (ts.length > 1 && (ts[0] === 'is' || ts[0] === 'has')) ts = ts.slice(1);
  return ts;
}

const ACRONYMS = new Set(['mrr', 'arr', 'csat', 'nps', 'sla', 'gmv', 'aov', 'kpi', 'id']);
const WORD_SWAPS: Record<string, string> = { pct: '%', qty: 'quantity' };

/** Words as a label: first word capitalised, acronyms in capitals. */
export function humanize(words: string[]): string {
  return words
    .map((w, i) => {
      const swapped = WORD_SWAPS[w] ?? w;
      if (ACRONYMS.has(swapped)) return swapped.toUpperCase();
      return i === 0 ? swapped.charAt(0).toUpperCase() + swapped.slice(1) : swapped;
    })
    .join(' ');
}

export function plural(word: string): string {
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}

/** A label as an id: "Average discount %" -> average_discount. */
export function slug(text: string): string {
  const s = tokens(text).join('_');
  return /^[a-z]/.test(s) ? s : `m_${s}`;
}
