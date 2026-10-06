import { describe, expect, it } from 'vitest';
import { allocate, createRng, weightedPicker } from './rng';

describe('createRng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRng(20261005);
    const b = createRng(20261005);
    const xs = Array.from({ length: 1000 }, () => a.next());
    const ys = Array.from({ length: 1000 }, () => b.next());
    expect(xs).toEqual(ys);
  });

  it('gives a different sequence for a different seed', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('stays in range and looks uniform', () => {
    const rng = createRng(7);
    let sum = 0;
    for (let i = 0; i < 100_000; i++) {
      const x = rng.next();
      expect(x >= 0 && x < 1).toBe(true);
      sum += x;
    }
    expect(sum / 100_000).toBeCloseTo(0.5, 2);
  });

  it('gives integers inside both ends', () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(rng.int(1, 4));
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });

  it('gives a standard normal', () => {
    const rng = createRng(11);
    const xs = Array.from({ length: 50_000 }, () => rng.normal());
    const mean = xs.reduce((a, x) => a + x, 0) / xs.length;
    const variance = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length;
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(Math.abs(variance - 1)).toBeLessThan(0.03);
  });

  it('picks in proportion to weights, both ways', () => {
    const rng = createRng(5);
    const pick = weightedPicker([1, 3]);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 40_000; i++) {
      counts[pick(rng)] += 1;
      counts[2 + rng.weighted([1, 3])] += 1;
    }
    expect(counts[1] / 40_000).toBeCloseTo(0.75, 1);
    expect(counts[3] / 40_000).toBeCloseTo(0.75, 1);
  });
});

describe('allocate', () => {
  it('adds up to the total and follows the weights', () => {
    expect(allocate(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(allocate(7, [0, 2, 5])).toEqual([0, 2, 5]);
    expect(allocate(0, [1, 2])).toEqual([0, 0]);
  });

  it('always sums to the total', () => {
    const rng = createRng(9);
    for (let k = 0; k < 200; k++) {
      const weights = Array.from({ length: rng.int(1, 12) }, () => rng.next());
      const total = rng.int(0, 5000);
      const parts = allocate(total, weights);
      expect(parts.reduce((a, p) => a + p, 0)).toBe(weights.some((w) => w > 0) ? total : 0);
    }
  });
});
