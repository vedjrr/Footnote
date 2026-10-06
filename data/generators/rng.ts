// Seeded random numbers for the sample data generators. Math.random is never
// used, so the same seed always gives the same rows.

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Integer in [min, max], both ends included. */
  int(min: number, max: number): number;
  /** Standard normal (Box-Muller). */
  normal(): number;
  /** Index into `weights`, chosen in proportion to the weights. */
  weighted(weights: readonly number[]): number;
  /** Fisher-Yates shuffle in place; returns the same array. */
  shuffle<T>(items: T[]): T[];
}

/** sfc32, seeded through splitmix32 so a small integer seed spreads well. */
export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const split = (): number => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
  let a = split();
  let b = split();
  let c = split();
  let d = split();

  const next = (): number => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  // Warm up so the first outputs do not echo the seed.
  for (let i = 0; i < 16; i++) next();

  return {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    normal() {
      const u = 1 - next();
      const v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    weighted(weights) {
      let total = 0;
      for (const w of weights) total += w;
      let r = next() * total;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r < 0) return i;
      }
      return weights.length - 1;
    },
    shuffle(items) {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    },
  };
}

/**
 * Splits `total` into whole numbers in proportion to `weights` (largest
 * remainder). The parts always add up to `total`; ties go to the lower index.
 */
export function allocate(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const parts = exact.map(Math.floor);
  let left = total - parts.reduce((acc, p) => acc + p, 0);
  const order = exact
    .map((x, i) => ({ i, rem: x - Math.floor(x) }))
    .sort((p, q) => q.rem - p.rem || p.i - q.i);
  for (let k = 0; left > 0; k++, left--) parts[order[k].i] += 1;
  return parts;
}

/** Picks from a fixed weighted list quickly, by binary search on the totals. */
export function weightedPicker(weights: readonly number[]): (rng: Rng) => number {
  const cumulative: number[] = [];
  let total = 0;
  for (const w of weights) {
    total += w;
    cumulative.push(total);
  }
  return (rng) => {
    const r = rng.next() * total;
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] > r) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  };
}
