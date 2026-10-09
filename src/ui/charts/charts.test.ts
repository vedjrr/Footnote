import { describe, expect, it } from 'vitest';
import { formatChange, formatCompact, formatValue } from './format';
import { barPath, spreadLabels, thinLabels, valueTicks } from './layout';
import { CONTEXT, EMPHASIS, SERIES, seriesColor } from './palette';
import { textWidth, wrapText } from './text';
import { waterfallZooms } from './waterfall';

describe('palette', () => {
  it('uses the series in order and never invents a fifth', () => {
    expect([0, 1, 2, 3].map((i) => seriesColor(i))).toEqual([...SERIES]);
    expect(() => seriesColor(4)).toThrow(/at most 4/);
  });
  it('emphasis paints one series blue and the rest grey', () => {
    expect(seriesColor(2, 2)).toBe(EMPHASIS);
    expect(seriesColor(0, 2)).toBe(CONTEXT);
    expect(seriesColor(7, 2)).toBe(CONTEXT);
  });
  it('holds no colour values, only tokens', () => {
    for (const c of [...SERIES, CONTEXT]) expect(c).toMatch(/^var\(--series-/);
  });
});

describe('text', () => {
  it('estimates wider for longer and wider text', () => {
    expect(textWidth('', 12)).toBe(0);
    expect(textWidth('MMMM', 12)).toBeGreaterThan(textWidth('iiii', 12));
    expect(textWidth('1,210,655', 24)).toBe(
      2 * textWidth('1,210,655', 12) + (textWidth('1,210,655', 24) % 2),
    );
  });
  it('errs on the wide side for Plex Sans digits', () => {
    // Plex Sans tabular digits are 0.6 em; the estimate must not be smaller.
    expect(textWidth('0000000000', 12)).toBeGreaterThanOrEqual(72);
  });
  it('wraps at spaces and never returns a line wider than asked', () => {
    const lines = wrapText('Home and garden furniture, outdoor', 80, 12);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(textWidth(l, 12)).toBeLessThanOrEqual(80);
    expect(lines.join(' ')).toBe('Home and garden furniture, outdoor');
  });
  it('breaks a single word that is wider than the line', () => {
    const lines = wrapText('Supercalifragilisticexpialidocious', 60, 12);
    expect(lines.length).toBeGreaterThan(2);
    for (const l of lines) expect(textWidth(l, 12)).toBeLessThanOrEqual(60);
    expect(lines.join('')).toBe('Supercalifragilisticexpialidocious');
  });
  it('returns one empty line for empty text', () => {
    expect(wrapText('', 50, 12)).toEqual(['']);
  });
});

describe('format', () => {
  it('uses a real minus sign and thousands separators', () => {
    expect(formatValue(1210655)).toBe('1,210,655');
    expect(formatValue(-3200)).toBe('−3,200');
    expect(formatValue(0.125, { style: 'percent' })).toBe('12.5%');
    expect(formatValue(-0.031, { style: 'percent' })).toBe('−3.1%');
    expect(formatValue(42, { style: 'unit', unit: 'min' })).toBe('42 min');
    expect(formatValue(null)).toBe('No value');
  });
  it('signs changes, but not zero', () => {
    expect(formatChange(12400)).toBe('+12,400');
    expect(formatChange(-12400)).toBe('−12,400');
    expect(formatChange(0)).toBe('0');
  });
  it('compacts ticks to three significant digits', () => {
    expect(formatCompact(1210655)).toBe('1.21M');
    expect(formatCompact(48200)).toBe('48.2K');
    expect(formatCompact(-2000)).toBe('−2K');
    expect(formatCompact(0.25, { style: 'percent' })).toBe('25%');
  });
});

describe('valueTicks', () => {
  it('includes zero for bars and gives round ticks', () => {
    const { domain, ticks } = valueTicks([120, 340, 990], { zero: true });
    expect(domain[0]).toBe(0);
    expect(domain[1]).toBeGreaterThanOrEqual(990);
    expect(ticks[0]).toBe(0);
    for (const t of ticks) expect(t % 200).toBe(0);
  });
  it('spans negatives', () => {
    const { domain, ticks } = valueTicks([-40, 25], { zero: true });
    expect(domain[0]).toBeLessThanOrEqual(-40);
    expect(ticks).toContain(0);
  });
  it('does not force zero for lines', () => {
    const { domain } = valueTicks([1000, 1100], { zero: false });
    expect(domain[0]).toBeGreaterThan(0);
  });
  it('copes with one value and with none', () => {
    expect(valueTicks([5], { zero: false }).domain[0]).toBeLessThan(5);
    expect(valueTicks([0], { zero: true }).domain).toEqual([0, 1]);
    expect(valueTicks([], { zero: true }).domain).toEqual([0, 1]);
  });
});

describe('thinLabels', () => {
  it('shows every label when they fit and keeps the last when they do not', () => {
    const months = Array.from({ length: 27 }, (_, i) => `M${i}`);
    expect(thinLabels(months, 100)).toHaveLength(27);
    const thin = thinLabels(months, 10);
    expect(thin.length).toBeLessThan(27);
    expect(thin.at(-1)).toBe(26);
    const gaps = thin.slice(1).map((v, i) => v - thin[i]);
    expect(new Set(gaps).size).toBe(1);
  });
});

describe('spreadLabels', () => {
  it('keeps labels that do not collide where they are', () => {
    expect(spreadLabels([20, 80, 140], { top: 0, bottom: 200 })).toEqual([20, 80, 140]);
  });
  it('pushes colliding labels apart by a line each, in their order', () => {
    const ys = spreadLabels([100, 102, 104], { top: 0, bottom: 200 }) as number[];
    const sorted = [...ys].sort((a, b) => a - b);
    for (let i = 1; i < 3; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(16);
    expect(ys[0]).toBeLessThan(ys[2]);
  });
  it('stays inside the bounds', () => {
    const ys = spreadLabels([195, 198, 199], { top: 0, bottom: 200 }) as number[];
    for (const y of ys) expect(y + 8).toBeLessThanOrEqual(200);
  });
  it('gives up when the labels cannot fit', () => {
    expect(spreadLabels([1, 2, 3, 4], { top: 0, bottom: 40 })).toBeNull();
  });
});

describe('barPath', () => {
  it('rounds the data end and keeps the baseline square', () => {
    const up = barPath(0, 10, 20, 50, 'top');
    expect(up.startsWith('M0,60V14Q0,10 4,10')).toBe(true);
    expect(barPath(0, 0, 0, 10, 'top')).toBe('');
  });
  it('shrinks the radius for a short bar', () => {
    expect(barPath(0, 0, 20, 2, 'top')).toContain('Q0,0 2,0');
  });
});

describe('waterfallZooms', () => {
  it('zooms when the steps are small next to the totals', () => {
    expect(waterfallZooms(1_307_000, [-60_000, -20_000, -16_000], 1_211_000)).toBe(true);
  });
  it('starts at zero when the steps are large or cross zero', () => {
    expect(waterfallZooms(100, [80, -30], 150)).toBe(false);
    expect(waterfallZooms(20, [-50], -30)).toBe(false);
    expect(waterfallZooms(0, [0], 0)).toBe(false);
  });
});
