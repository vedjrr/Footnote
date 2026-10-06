// Shared shape of a truth file: each planted effect, what it should look like
// (ranges taken from the analytics spec), and what the generated data really
// holds, measured by query.

import type { QueryEngine } from '@/core/engine/types';

export interface Check {
  key: string;
  label: string;
  min?: number;
  max?: number;
}

export interface Effect {
  id: string;
  /** The spec's sentence for the effect. */
  spec: string;
  /** True when the default briefing is expected to surface it. */
  briefing: boolean;
  parameters: Record<string, unknown>;
  checks: Check[];
  measure(q: Query): Promise<Record<string, number>>;
}

export type Query = (sql: string) => Promise<Record<string, number>[]>;

export interface TruthEffect {
  id: string;
  spec: string;
  briefing: boolean;
  parameters: Record<string, unknown>;
  expected: Record<string, { label: string; min?: number; max?: number }>;
  realised: Record<string, number>;
}

/** Runs SQL and returns rows as objects of numbers (text stays as is via the key). */
export function queryNumbers(engine: QueryEngine): Query {
  return async (sql) => {
    const result = await engine.query(sql);
    return result.rows.map((row) =>
      Object.fromEntries(result.columns.map((c, i) => [c.name, Number(row[i])])),
    );
  };
}

/** Rounds to 4 decimals so truth files stay readable and stable. */
export const tidy = (x: number): number => Math.round(x * 10_000) / 10_000;

export async function measureAll(effects: Effect[], q: Query): Promise<TruthEffect[]> {
  const out: TruthEffect[] = [];
  for (const effect of effects) {
    const raw = await effect.measure(q);
    out.push({
      id: effect.id,
      spec: effect.spec,
      briefing: effect.briefing,
      parameters: effect.parameters,
      expected: Object.fromEntries(
        effect.checks.map((c) => [c.key, { label: c.label, min: c.min, max: c.max }]),
      ),
      realised: Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, tidy(v)])),
    });
  }
  return out;
}

/** Every check that the realised values fail, as readable lines. */
export function failures(effects: TruthEffect[]): string[] {
  const lines: string[] = [];
  for (const e of effects) {
    for (const [key, range] of Object.entries(e.expected)) {
      const value = e.realised[key];
      const ok =
        Number.isFinite(value) &&
        (range.min === undefined || value >= range.min) &&
        (range.max === undefined || value <= range.max);
      if (!ok)
        lines.push(`${e.id} ${key} = ${value}, expected [${range.min ?? ''}, ${range.max ?? ''}]`);
    }
  }
  return lines;
}

export interface Segment {
  n0: number;
  d0: number;
  n1: number;
  d1: number;
}

/**
 * Mix and rate parts of a ratio's change (analytics-spec §6.2), summed over
 * segments. The app's own version arrives in T42; this one only checks the
 * planted data.
 */
export function mixRate(segments: Segment[]): { mix: number; rate: number; change: number } {
  const D0 = segments.reduce((a, s) => a + s.d0, 0);
  const D1 = segments.reduce((a, s) => a + s.d1, 0);
  const R0 = segments.reduce((a, s) => a + s.n0, 0) / D0;
  const R1 = segments.reduce((a, s) => a + s.n1, 0) / D1;
  let mix = 0;
  let rate = 0;
  for (const s of segments) {
    const w0 = s.d0 / D0;
    const w1 = s.d1 / D1;
    const r1 = s.d1 ? s.n1 / s.d1 : 0;
    const r0 = s.d0 ? s.n0 / s.d0 : r1;
    mix += (w1 - w0) * (r0 - R0);
    rate += s.d1 ? w1 * (r1 - r0) : 0;
  }
  return { mix, rate, change: R1 - R0 };
}
