// Dictionary inference (analytics-spec §2.3 to §2.7). `assignRoles` reads
// each column's role from its profile, first matching rule wins. `inferModel`
// turns the roles into metrics, dimensions and a time column. One fact needs
// a query rather than the profile: whether the table is a snapshot (§2.7),
// which `snapshotSql` asks and `inferDictionary` runs.

import type { Cell, QueryEngine, QueryResult } from '@/core/engine/types';
import {
  type ColumnProfile,
  type Profile,
  literal,
  quoteColumn as quoteName,
  quoteTable,
} from '@/core/profile/profile';
import {
  type Dimension,
  type Direction,
  type Grain,
  type Metric,
  type MetricFormat,
  type SemanticModel,
  type SimpleMetric,
  type TimeColumn,
  semanticModelSchema,
} from './types';
import { firstWord, humanize, isIdName, nameHas, plural, slug, stem, tokens } from './words';

export type Role =
  | 'time'
  | 'identifier'
  | 'entity'
  | 'measure'
  | 'category'
  | 'free_text'
  /** Nothing fits: a second date column, a decimal named like a latitude. */
  | 'other';

// §2.3
const TIME_MIN_DAYS = 14;
const TIME_NAME_HINTS = ['date', 'created', 'month', 'day', 'time'];
const IDENTIFIER_SHARE = 0.9;
const ENTITY_MIN_DISTINCT = 50;
const NOT_MEASURE_WORDS = [
  'year',
  'zip',
  'postal',
  'postcode',
  'phone',
  'lat',
  'lon',
  'latitude',
  'longitude',
];
const CATEGORY_MAX_DISTINCT = 50;
const CATEGORY_WIDE_MAX = 1000;
const CATEGORY_WIDE_SHARE = 0.05;

// §2.4
const PRIVATE_NAME_PARTS = [
  'name',
  'email',
  'phone',
  'address',
  'dob',
  'birth',
  'ssn',
  'passport',
  'iban',
  'account',
];
const PRIVATE_VALUE_SHARE = 0.2;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^\+?[\d\s().-]{7,20}$/;

// §2.5
const SUM_WORDS = [
  'amount',
  'revenue',
  'sales',
  'total',
  'cost',
  'profit',
  'quantity',
  'qty',
  'units',
  'seats',
  'mrr',
  'value',
];
const AVG_WORDS = [
  'price',
  'rate',
  'pct',
  'percent',
  'score',
  'rating',
  'csat',
  'age',
  'minutes',
  'hours',
  'days',
  'duration',
  'discount',
];
const SKEW_RATIO = 100;
const REVENUE_WORDS = ['revenue', 'sales', 'gmv', 'amount', 'mrr'];
const COST_WORDS = ['cost', 'cogs'];
const PROFIT_WORDS = ['profit'];
const QUANTITY_WORDS = ['quantity', 'qty', 'units'];
const DURATION_UNITS = ['minutes', 'hours', 'days'];

// §2.6
const LOWER_BETTER_WORDS = [
  'cost',
  'return',
  'refund',
  'churn',
  'breach',
  'complaint',
  'error',
  'defect',
  'delay',
  'duration',
  'response',
  'resolution',
  'discount',
];
const MONEY_WORDS = [
  'revenue',
  'sales',
  'amount',
  'price',
  'cost',
  'profit',
  'mrr',
  'arr',
  'gmv',
  'value',
  'margin',
];
const MAIN_MONEY_WORDS = ['revenue', 'sales', 'amount', 'mrr', 'gmv', 'value'];
const IMPORTANT_WORDS = ['profit', 'margin', 'cost'];

// §2.7
const SNAPSHOT_UNIQUE_SHARE = 0.99;
const SNAPSHOT_MIN_PERIODS = 3;

// §4
const MONTH_GRAIN_DAYS = 90;
const WEEK_GRAIN_DAYS = 21;

const isNumber = (c: ColumnProfile) => c.type === 'integer' || c.type === 'decimal';
const isTemporal = (c: ColumnProfile) => c.type === 'date' || c.type === 'timestamp';
const filled = (c: ColumnProfile, rows: number) => rows - c.empty;

/** The time column, by the rule in §2.3, or null. */
function pickTime(profile: Profile): ColumnProfile | null {
  const candidates = profile.columns.filter(
    (c) => isTemporal(c) && (c.temporal?.distinctDays ?? 0) >= TIME_MIN_DAYS,
  );
  // A word of the name starts with the hint: order_date, timestamp, but not
  // updated, which would otherwise beat created (D-031).
  const hint = (c: ColumnProfile) => {
    const words = tokens(c.name);
    const i = TIME_NAME_HINTS.findIndex((h) => words.some((w) => w.startsWith(h)));
    return i === -1 ? TIME_NAME_HINTS.length : i;
  };
  candidates.sort(
    (a, b) =>
      hint(a) - hint(b) || (b.temporal?.distinctDays ?? 0) - (a.temporal?.distinctDays ?? 0),
  );
  return candidates[0] ?? null;
}

/** Each column's role, in profile order (analytics-spec §2.3). */
export function assignRoles(profile: Profile): Map<string, Role> {
  const rows = profile.rows;
  const time = pickTime(profile);
  const roles = new Map<string, Role>();
  for (const c of profile.columns) {
    roles.set(c.name, roleOf(c, rows, c === time));
  }
  return roles;
}

function roleOf(c: ColumnProfile, rows: number, isTime: boolean): Role {
  if (isTime) return 'time';
  if (filled(c, rows) === 0) return 'other';
  const idName = isIdName(c.name);
  const unique = c.distinct === rows && c.empty === 0;
  if (
    rows > 0 &&
    ((c.distinct >= IDENTIFIER_SHARE * rows && (idName || c.type === 'text')) ||
      (c.type === 'integer' && unique))
  ) {
    return 'identifier';
  }
  if (idName && c.distinct >= ENTITY_MIN_DISTINCT) return 'entity';
  // An id-like name is never a measure, even with few values (D-031).
  if (isNumber(c) && !idName && !nameHas(c.name, NOT_MEASURE_WORDS)) return 'measure';
  if (
    (c.type === 'text' || c.type === 'boolean' || c.type === 'integer') &&
    (c.distinct <= CATEGORY_MAX_DISTINCT ||
      (c.distinct <= CATEGORY_WIDE_MAX && c.distinct < CATEGORY_WIDE_SHARE * rows))
  ) {
    return 'category';
  }
  if (c.type === 'text') return 'free_text';
  return 'other';
}

/** §2.4: private by name, by the values seen, or by role. */
export function isPrivate(c: ColumnProfile, role: Role): boolean {
  if (role === 'entity' || role === 'free_text') return true;
  const name = c.name.toLowerCase();
  if (PRIVATE_NAME_PARTS.some((p) => name.includes(p))) return true;
  // The profile keeps the ten most common values, so the share is measured on
  // those, weighted by count (D-031).
  const top = c.categorical?.top ?? [];
  const seen = top.reduce((n, t) => n + t.count, 0);
  if (seen === 0) return false;
  const matching = top
    .filter((t) => EMAIL.test(t.value.trim()) || isPhone(t.value.trim()))
    .reduce((n, t) => n + t.count, 0);
  return matching / seen >= PRIVATE_VALUE_SHARE;
}

function isPhone(value: string): boolean {
  return PHONE.test(value) && (value.match(/\d/g)?.length ?? 0) >= 7;
}

/**
 * One statement asking, for each entity column, in what share of rows the
 * pair (entity, day) is unique and over how many days (§2.7). Null when there
 * is no time column or no entity column.
 */
export function snapshotSql(profile: Profile): string | null {
  const roles = assignRoles(profile);
  const time = profile.columns.find((c) => roles.get(c.name) === 'time');
  const entities = profile.columns.filter((c) => roles.get(c.name) === 'entity');
  if (!time || entities.length === 0) return null;
  const table = quoteTable(profile.table);
  const day = `CAST(${quoteName(time.name)} AS DATE)`;
  return entities
    .map((e) => {
      const col = quoteName(e.name);
      return (
        `SELECT ${literal(e.name)} AS entity, ` +
        `CAST(sum(CASE WHEN n = 1 THEN 1 ELSE 0 END) AS DOUBLE) / NULLIF(sum(n), 0) AS unique_share, ` +
        `CAST(count(DISTINCT period) AS BIGINT) AS periods ` +
        `FROM (SELECT ${day} AS period, count(*) AS n FROM ${table} ` +
        `WHERE ${col} IS NOT NULL AND ${day} IS NOT NULL GROUP BY ${col}, ${day}) pairs`
      );
    })
    .join('\nUNION ALL\n');
}

/** The entity columns that make the table a snapshot, from `snapshotSql`'s result. */
export function snapshotEntities(result: QueryResult): string[] {
  const at = (name: string) => result.columns.findIndex((c) => c.name === name);
  const [e, share, periods] = [at('entity'), at('unique_share'), at('periods')];
  return result.rows
    .filter(
      (r: Cell[]) =>
        Number(r[share] ?? 0) >= SNAPSHOT_UNIQUE_SHARE &&
        Number(r[periods] ?? 0) >= SNAPSHOT_MIN_PERIODS,
    )
    .map((r) => String(r[e]));
}

export interface InferFacts {
  /** Entity columns that are unique per period (§2.7); empty when not a snapshot. */
  snapshotEntities: string[];
}

/** The dictionary for a table, from its profile and the snapshot fact. */
export function inferModel(
  profile: Profile,
  facts: InferFacts = { snapshotEntities: [] },
): SemanticModel {
  const roles = assignRoles(profile);
  const byRole = (role: Role) => profile.columns.filter((c) => roles.get(c.name) === role);
  const snapshot = facts.snapshotEntities.length > 0;
  const ids = new Set<string>();
  const uniqueId = (base: string) => {
    let candidate = base;
    for (let n = 2; ids.has(candidate); n++) candidate = `${base}_${n}`;
    ids.add(candidate);
    return candidate;
  };

  // Dimensions: categories and entities.
  const dimensions: Dimension[] = profile.columns
    .filter((c) => roles.get(c.name) === 'category' || roles.get(c.name) === 'entity')
    .map((c) => {
      const role = roles.get(c.name) as 'category' | 'entity';
      return {
        id: uniqueId(slug(c.name)),
        label: humanize(role === 'entity' ? stem(c.name) : tokens(c.name)),
        column: c.name,
        role,
        distinct: c.distinct,
        synonyms: [],
        private: isPrivate(c, role),
      };
    });
  ids.clear();
  const dimensionOf = (column: string) => dimensions.find((d) => d.column === column);

  // Metrics, before direction, format and importance are filled in.
  type Draft =
    | Omit<SimpleMetric, 'format' | 'direction' | 'importance'>
    | {
        kind: 'ratio';
        id: string;
        label: string;
        synonyms: string[];
        numerator: string;
        denominator: string;
      }
    | {
        kind: 'difference';
        id: string;
        label: string;
        synonyms: string[];
        minuend: string;
        subtrahend: string;
      };
  const drafts: Draft[] = [];
  const simple = (label: string, column: string | null, agg: SimpleMetric['agg'], extra = {}) => {
    const m: Draft = {
      kind: 'simple',
      id: uniqueId(slug(label)),
      label,
      column,
      agg,
      overTime: 'sum',
      synonyms: [],
      ...extra,
    };
    drafts.push(m);
    return m;
  };
  const ratio = (label: string, numerator: string, denominator: string) => {
    drafts.push({
      kind: 'ratio',
      id: uniqueId(slug(label)),
      label,
      synonyms: [],
      numerator,
      denominator,
    });
  };

  // Count of rows, named after a unique identifier or the table when clear.
  const rowIdentifier = byRole('identifier').find(
    (c) => c.distinct === profile.rows && c.empty === 0,
  );
  const entityStems = byRole('entity').map((c) => plural(stem(c.name).join(' ')));
  const tableWords = tokens(profile.table);
  let rowLabel = 'Rows';
  if (rowIdentifier) rowLabel = humanize([plural(stem(rowIdentifier.name).join(' '))]);
  else if (tableWords.length === 1 && !entityStems.includes(tableWords[0])) {
    rowLabel = humanize(tableWords);
  }
  const rowCount = simple(rowLabel, null, 'count', { overTime: snapshot ? 'last' : 'sum' });

  // One metric per measure.
  const measureMetrics = new Map<string, Draft>();
  for (const c of byRole('measure')) {
    const n = c.numeric;
    let agg: 'sum' | 'avg';
    if (nameHas(c.name, SUM_WORDS)) agg = 'sum';
    else if (nameHas(c.name, AVG_WORDS)) agg = 'avg';
    else {
      const neverNegative = (n?.min ?? 0) >= 0;
      const notSkewed = n?.p95 != null && n.median != null && n.p95 < SKEW_RATIO * n.median;
      agg = neverNegative && notSkewed ? 'sum' : 'avg';
    }
    const words = tokens(c.name);
    const label = agg === 'avg' ? `Average ${humanize(words).toLowerCase()}` : humanize(words);
    measureMetrics.set(
      c.name,
      simple(fixAcronyms(label), c.name, agg, {
        overTime: agg === 'sum' && snapshot ? 'last' : 'sum',
      }),
    );
  }

  // Booleans: rows where true over rows.
  for (const c of profile.columns.filter((c) => c.type === 'boolean')) {
    const dim = dimensionOf(c.name);
    if (!dim) continue;
    const words = humanize(stem(c.name));
    const count = simple(`${words} rows`, null, 'count', {
      where: [{ dimension: dim.id, op: 'in', values: ['true'] }],
    });
    ratio(`${words} rate`, count.id, rowCount.id);
  }

  // Entities: count distinct, named as a plural.
  for (const c of byRole('entity')) {
    simple(humanize([plural(stem(c.name).join(' '))]), c.name, 'count_distinct');
  }

  // Derived ratios (§2.5).
  const sumMetric = (words: string[]) => {
    for (const w of words) {
      for (const [column, m] of measureMetrics) {
        if (m.kind === 'simple' && m.agg === 'sum' && firstWord(column, [w])) return m;
      }
    }
    return undefined;
  };
  const revenue = sumMetric(REVENUE_WORDS);
  const cost = sumMetric(COST_WORDS);
  const profit = sumMetric(PROFIT_WORDS);
  const quantity = sumMetric(QUANTITY_WORDS);
  if (revenue && cost && !profit) {
    const gross = {
      kind: 'difference' as const,
      id: uniqueId('gross_profit'),
      label: 'Gross profit',
      synonyms: [],
      minuend: revenue.id,
      subtrahend: cost.id,
    };
    drafts.push(gross);
    ratio('Margin', gross.id, revenue.id);
  }
  if (profit && revenue) ratio('Profit margin', profit.id, revenue.id);
  if (revenue) {
    const label = rowIdentifier
      ? `Average ${stem(rowIdentifier.name).join(' ')} value`
      : `Average ${revenue.label.toLowerCase()} per row`;
    ratio(fixAcronyms(label), revenue.id, rowCount.id);
  }
  if (revenue && quantity) ratio('Average price', revenue.id, quantity.id);

  // Direction, format, importance.
  const draftById = new Map(drafts.map((d) => [d.id, d]));
  const nameOf = (d: Draft) => `${d.label} ${d.kind === 'simple' ? (d.column ?? '') : ''}`;
  const direction = (d: Draft): Direction => {
    const name = nameOf(d);
    if (nameHas(name, LOWER_BETTER_WORDS)) return 'lower_better';
    if (nameHas(name, MONEY_WORDS)) return 'higher_better';
    if (d.kind === 'simple' && (d.agg === 'count' || d.agg === 'count_distinct')) {
      return 'higher_better';
    }
    return 'neutral';
  };
  const format = (d: Draft): MetricFormat => {
    if (d.kind === 'simple' && (d.agg === 'count' || d.agg === 'count_distinct')) {
      return { style: 'number', decimals: 0 };
    }
    if (d.kind === 'ratio') {
      const num = draftById.get(d.numerator);
      const den = draftById.get(d.denominator);
      // A rate (rows over rows) or a share of the same money is a percentage.
      if (num && den && format(num).style === format(den).style) {
        return { style: 'percent', decimals: 1 };
      }
      return nameHas(d.label, MONEY_WORDS) ? { style: 'currency' } : { style: 'number' };
    }
    const name = nameOf(d);
    const column = d.kind === 'simple' && d.column ? profileColumn(profile, d.column) : null;
    const unit = firstWord(name, DURATION_UNITS);
    if (unit) return { style: 'duration', unit };
    if (nameHas(name, ['pct', 'percent'])) {
      return (column?.numeric?.max ?? 0) <= 1
        ? { style: 'percent', decimals: 1 }
        : { style: 'number', unit: '%', decimals: 1 };
    }
    if (nameHas(name, MONEY_WORDS)) return { style: 'currency' };
    return { style: 'number' };
  };
  const mainMoney = (() => {
    for (const w of MAIN_MONEY_WORDS) {
      const m = drafts.find(
        (d) => d.kind === 'simple' && d.agg === 'sum' && firstWord(nameOf(d), [w]),
      );
      if (m) return m;
    }
    return drafts.find((d) => d.kind === 'simple' && d.agg === 'sum');
  })();

  const metrics: Metric[] = drafts.map((d) => {
    const dir = direction(d);
    let importance = 0.4;
    if (d === mainMoney) importance = 1;
    else if (nameHas(nameOf(d), IMPORTANT_WORDS)) importance = 0.8;
    else if (d === rowCount) importance = 0.7;
    else if (d.kind === 'ratio' && dir === 'lower_better') importance = 0.6;
    return { ...d, format: format(d), direction: dir, importance } as Metric;
  });

  const timeProfile = byRole('time')[0];
  const time: TimeColumn | null =
    timeProfile?.temporal?.min && timeProfile.temporal.max
      ? {
          id: slug(timeProfile.name),
          label: humanize(tokens(timeProfile.name)),
          column: timeProfile.name,
          min: timeProfile.temporal.min,
          max: timeProfile.temporal.max,
          defaultGrain: defaultGrain(timeProfile.temporal.min, timeProfile.temporal.max),
        }
      : null;

  const hidden = profile.columns
    .filter((c) => {
      const role = roles.get(c.name);
      return role === 'identifier' || role === 'free_text' || role === 'other';
    })
    .map((c) => c.name);

  return semanticModelSchema.parse({
    table: profile.table,
    version: 1,
    time,
    metrics,
    dimensions,
    hidden,
    starters: [],
  });
}

/** Month for 90 days or more, week for 21 to 89, else day (analytics-spec §4). */
export function defaultGrain(min: string, max: string): Grain {
  const days = (Date.parse(max.slice(0, 10)) - Date.parse(min.slice(0, 10))) / 86_400_000 + 1;
  if (days >= MONTH_GRAIN_DAYS) return 'month';
  if (days >= WEEK_GRAIN_DAYS) return 'week';
  return 'day';
}

/** Profile, snapshot probe and inference in one call. */
export async function inferDictionary(
  engine: QueryEngine,
  profile: Profile,
): Promise<SemanticModel> {
  const sql = snapshotSql(profile);
  const entities = sql ? snapshotEntities(await engine.query(sql)) : [];
  return inferModel(profile, { snapshotEntities: entities });
}

function profileColumn(profile: Profile, name: string): ColumnProfile | undefined {
  return profile.columns.find((c) => c.name === name);
}

/** "Average csat" -> "Average CSAT" after lower-casing a label. */
function fixAcronyms(label: string): string {
  return label.replace(/\b(mrr|arr|csat|nps|sla|gmv|aov)\b/g, (a) => a.toUpperCase());
}
