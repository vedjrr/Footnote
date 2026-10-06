import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Checks the colour tokens against ui-ux-rules §2: text pairs reach WCAG AA,
// the two dark blocks match, and no raw hex colour lives outside the token
// file and the chart palette file.

const ROOT = join(__dirname, '..', '..');
const TOKENS = join(__dirname, 'tokens.css');
const css = readFileSync(TOKENS, 'utf8');

function block(source: string, selector: string): string {
  const start = source.indexOf(selector);
  if (start < 0) throw new Error(`Selector not found: ${selector}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`Unclosed block: ${selector}`);
}

function vars(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const light = vars(block(css, ':root {'));
const darkMedia = vars(
  block(block(css, '@media (prefers-color-scheme: dark)'), ":root:not([data-theme='light'])"),
);
const darkAttr = vars(block(css, ":root[data-theme='dark']"));
const dark = { ...light, ...darkAttr };

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Text on surface. The first group is the table in §2; the rest are pairs the
// primitives use.
const TEXT_PAIRS: Array<[string, string]> = [
  ['--ink', '--paper'],
  ['--ink-2', '--paper'],
  ['--ink-3', '--paper'],
  ['--ink-3', '--ledger'],
  ['--mark', '--paper'],
  ['--mark', '--ledger'],
  ['--highlight-ink', '--highlight'],
  ['--good', '--paper'],
  ['--caution', '--paper'],
  ['--critical', '--paper'],
  // Working paper, tables, inputs, tooltip, primary button, selection.
  ['--ink', '--ledger'],
  ['--ink-2', '--ledger'],
  ['--good', '--ledger'],
  ['--caution', '--ledger'],
  ['--critical', '--ledger'],
  ['--ink', '--wash'],
  ['--ink-2', '--wash'],
  ['--ink-3', '--wash'],
  ['--paper', '--ink'],
  ['--paper', '--mark'],
];

describe('colour tokens', () => {
  it('declares every token in light and dark', () => {
    for (const name of [
      '--paper',
      '--ledger',
      '--ink',
      '--mark',
      '--highlight',
      '--highlight-ink',
    ]) {
      expect(light[name]).toMatch(/^#[0-9a-f]{6}$/);
      expect(darkAttr[name]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('keeps the two dark blocks identical', () => {
    expect(darkMedia).toEqual(darkAttr);
  });

  for (const [theme, set] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    it.each(TEXT_PAIRS)(`${theme}: %s on %s reaches 4.5:1`, (fg, bg) => {
      const ratio = contrast(set[fg], set[bg]);
      expect(
        ratio,
        `${fg} ${set[fg]} on ${bg} ${set[bg]} is ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('matches the figures written in ui-ux-rules §2', () => {
    // A few anchors, so a changed value without an updated table is caught.
    expect(contrast(light['--ink'], light['--paper'])).toBeCloseTo(16.4, 0);
    expect(contrast(light['--mark'], light['--paper'])).toBeCloseTo(6.8, 0);
    expect(contrast(dark['--ink'], dark['--paper'])).toBeCloseTo(15.1, 0);
    expect(contrast(dark['--mark'], dark['--paper'])).toBeCloseTo(8.4, 0);
  });
});

describe('raw hex colours', () => {
  const ALLOWED = new Set(['src/ui/tokens.css', 'src/ui/tokens.test.ts']);
  const ALLOWED_PATTERN = /^src\/ui\/charts\/palette\.(ts|css)$/;
  const HEX = /#[0-9a-fA-F]{3,8}\b/g;

  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return files(path);
      return /\.(tsx?|css|mjs)$/.test(name) ? [path] : [];
    });
  }

  it('appear only in tokens.css and the chart palette file', () => {
    const offenders: string[] = [];
    for (const path of files(join(ROOT, 'src'))) {
      const rel = relative(ROOT, path).split('\\').join('/');
      if (ALLOWED.has(rel) || ALLOWED_PATTERN.test(rel)) continue;
      const text = readFileSync(path, 'utf8');
      for (const m of text.matchAll(HEX)) offenders.push(`${rel}: ${m[0]}`);
    }
    expect(offenders).toEqual([]);
  });
});
