/**
 * Text width estimates for chart labels. Charts render on the server, where
 * nothing can be measured, so label placement uses these estimates. They are
 * deliberately a little wide for IBM Plex Sans: a label placed with room to
 * spare never clips; one placed too tight would.
 */

// Advance widths in em, rounded up from IBM Plex Sans. Digits are tabular.
const NARROW = new Set("il.,:;'!|ijtf()[] ");
const SEMI = new Set('rsIJ-−"/');
const WIDE = new Set('mwMW@%');
const UPPER_WIDE = new Set('ABCDGHKNOQRUVXYZ&');

function charWidth(ch: string): number {
  if (ch >= '0' && ch <= '9') return 0.6;
  if (ch === ' ') return 0.28;
  if (NARROW.has(ch)) return 0.3;
  if (SEMI.has(ch)) return 0.42;
  if (WIDE.has(ch)) return 0.88;
  if (UPPER_WIDE.has(ch)) return 0.7;
  if (ch >= 'A' && ch <= 'Z') return 0.62;
  return 0.56;
}

/** Estimated rendered width in px of `text` at `size` px. */
export function textWidth(text: string, size: number): number {
  let em = 0;
  for (const ch of text) em += charWidth(ch);
  return Math.ceil(em * size * 1.04);
}

/**
 * Breaks `text` into lines no wider than `width` at `size` px, at spaces.
 * A single word wider than the line is broken by characters, so the result
 * never overflows. Returns at least one line.
 */
export function wrapText(text: string, width: number, size: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size) <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (textWidth(word, size) <= width) {
      line = word;
      continue;
    }
    // Break a word that is wider than the line on its own.
    let part = '';
    for (const ch of word) {
      if (part && textWidth(part + ch, size) > width) {
        lines.push(part);
        part = ch;
      } else {
        part += ch;
      }
    }
    line = part;
  }
  if (line) lines.push(line);
  return lines;
}
