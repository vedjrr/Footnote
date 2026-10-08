// The column profile (analytics-spec §2.1, §2.2). At most five statements,
// whatever the column count: one for counts and type probes, one to try date
// formats on text shaped like dates, then one per column family (numbers,
// dates, text and booleans). The probes decide each column's refined type
// before the family statements run, so a text column of prices gets number
// statistics on its parsed values.

import type { Cell, ColumnInfo, ColumnType, QueryEngine, QueryResult } from '@/core/engine/types';

export interface NumericStats {
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
  p05: number | null;
  p95: number | null;
  /** Shares of the non-empty values, 0..1. */
  zeroShare: number | null;
  negativeShare: number | null;
}

export interface TemporalStats {
  /** ISO dates, or ISO timestamps for a timestamp column. */
  min: string | null;
  max: string | null;
  distinctDays: number;
  /** Days between the first and the last with no value. */
  gapDays: number;
}

export interface TopValue {
  value: string;
  count: number;
}

export interface CategoricalStats {
  /** Up to ten most common non-empty values, most common first. */
  top: TopValue[];
  /** Length in characters of the non-empty values; null for booleans. */
  minLength: number | null;
  maxLength: number | null;
}

/** How a column's storage type was refined (analytics-spec §2.2). */
export interface Refinement {
  from: ColumnType;
  /** Non-empty values that read as the refined type, and those that did not. */
  parsed: number;
  unparsed: number;
  /** The date format the values were read with, for dates; else null. */
  format: string | null;
}

export interface ColumnProfile {
  name: string;
  storageType: ColumnType;
  /** The type after refinement; equals `storageType` when nothing changed. */
  type: ColumnType;
  /** Null, and for text also blank after trimming. */
  empty: number;
  /** Distinct non-empty values, compared exactly as stored. */
  distinct: number;
  refinement: Refinement | null;
  numeric: NumericStats | null;
  temporal: TemporalStats | null;
  categorical: CategoricalStats | null;
}

export interface Profile {
  table: string;
  rows: number;
  columns: ColumnProfile[];
  /** Every statement that ran, in order. */
  sql: string[];
}

/** Share of non-empty values that must read as the new type (§2.2). */
export const REFINE_SHARE = 0.98;

/** Date formats tried on text, in order of preference when counts tie. */
export const DATE_FORMATS = [
  '%Y-%m-%d',
  '%Y/%m/%d',
  '%d/%m/%Y',
  '%m/%d/%Y',
  '%d-%m-%Y',
  '%d.%m.%Y',
] as const;

/** Text worth probing with the date formats: three groups of digits. */
const DATE_SHAPE = '\\d{1,4}[-/.]\\d{1,2}[-/.]\\d{1,4}';

/** Value pairs that make a two-valued column boolean, lower case (§2.2). */
const BOOLEAN_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['false', 'true'],
  ['no', 'yes'],
  ['n', 'y'],
  ['0', '1'],
];

const TOP_VALUES = 10;

const TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteTable(name: string): string {
  if (!TABLE_NAME.test(name)) throw new Error(`Not a plain table name: ${name}`);
  return `"${name}"`;
}

function quoteColumn(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function literal(text: string): string {
  return `'${text.replaceAll("'", "''")}'`;
}

const nonEmpty = (c: string) => `trim(${c}) <> ''`;

/** A text value as a finite number after removing currency, separators and `%`. */
export function numberFromText(c: string): string {
  const stripped = `regexp_replace(regexp_replace(trim(${c}), '[\\s$€£¥₹,]', '', 'g'), '%$', '')`;
  return `CASE WHEN isfinite(TRY_CAST(${stripped} AS DOUBLE)) THEN TRY_CAST(${stripped} AS DOUBLE) END`;
}

function dateFromText(c: string, format: string): string {
  return `CAST(try_strptime(trim(${c}), ${literal(format)}) AS DATE)`;
}

/** Column families decide which statistics a column gets. */
function family(type: ColumnType): 'numeric' | 'temporal' | 'categorical' {
  if (type === 'integer' || type === 'decimal') return 'numeric';
  if (type === 'date' || type === 'timestamp') return 'temporal';
  return 'categorical';
}

// ---------------------------------------------------------------- statement 1

/** Counts, distinct values and the probes type refinement needs. */
export function baseSql(table: string, columns: ColumnInfo[]): string {
  const parts = ['CAST(COUNT(*) AS BIGINT) AS row_count'];
  columns.forEach((col, i) => {
    const c = quoteColumn(col.name);
    const p = `c${i}_`;
    if (col.type === 'text') {
      parts.push(
        `COUNT(*) FILTER (WHERE ${c} IS NULL OR NOT ${nonEmpty(c)}) AS ${p}empty`,
        `COUNT(DISTINCT CASE WHEN ${nonEmpty(c)} THEN ${c} END) AS ${p}distinct`,
        `MIN(length(${c})) FILTER (WHERE ${nonEmpty(c)}) AS ${p}min_len`,
        `MAX(length(${c})) FILTER (WHERE ${nonEmpty(c)}) AS ${p}max_len`,
        `COUNT(DISTINCT CASE WHEN ${nonEmpty(c)} THEN lower(trim(${c})) END) AS ${p}bool_distinct`,
        `MIN(lower(trim(${c}))) FILTER (WHERE ${nonEmpty(c)}) AS ${p}bool_min`,
        `MAX(lower(trim(${c}))) FILTER (WHERE ${nonEmpty(c)}) AS ${p}bool_max`,
        `COUNT(${numberFromText(c)}) AS ${p}num`,
        `COUNT(*) FILTER (WHERE regexp_full_match(trim(${c}), ${literal(DATE_SHAPE)})) AS ${p}date_shaped`,
      );
    } else {
      parts.push(`COUNT(*) - COUNT(${c}) AS ${p}empty`, `COUNT(DISTINCT ${c}) AS ${p}distinct`);
      if (col.type === 'integer') {
        parts.push(
          `CAST(MIN(${c}) AS DOUBLE) AS ${p}int_min`,
          `CAST(MAX(${c}) AS DOUBLE) AS ${p}int_max`,
        );
      }
    }
  });
  return ['SELECT', parts.map((p) => `  ${p}`).join(',\n'), `FROM ${quoteTable(table)}`].join('\n');
}

/** Reads one result row into a map from column alias to value. */
function rowByAlias(result: QueryResult): Map<string, Cell> {
  const row = result.rows[0] ?? [];
  return new Map(result.columns.map((col, i) => [col.name, row[i] ?? null]));
}

const num = (v: Cell | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

interface Base {
  rows: number;
  columns: ColumnProfile[];
  /** Text columns shaped like dates, to be probed with each date format. */
  dateCandidates: ColumnProfile[];
}

/** Refines each column's type from the probe counts (analytics-spec §2.2). */
export function readBase(result: QueryResult, columns: ColumnInfo[]): Base {
  const v = rowByAlias(result);
  const rows = num(v.get('row_count')) ?? 0;
  const dateCandidates: ColumnProfile[] = [];
  return {
    rows,
    dateCandidates,
    columns: columns.map((col, i) => {
      const get = (stat: string) => num(v.get(`c${i}_${stat}`));
      const empty = get('empty') ?? 0;
      const filled = rows - empty;
      const profile: ColumnProfile = {
        name: col.name,
        storageType: col.type,
        type: col.type,
        empty,
        distinct: get('distinct') ?? 0,
        refinement: null,
        numeric: null,
        temporal: null,
        categorical: null,
      };
      const refine = (type: ColumnType, parsed: number, format: string | null) => {
        profile.type = type;
        profile.refinement = { from: col.type, parsed, unparsed: filled - parsed, format };
      };

      if (col.type === 'integer') {
        if (profile.distinct === 2 && get('int_min') === 0 && get('int_max') === 1) {
          refine('boolean', filled, null);
        }
      } else if (col.type === 'text' && filled > 0) {
        const low = v.get(`c${i}_bool_min`);
        const high = v.get(`c${i}_bool_max`);
        const twoValued =
          get('bool_distinct') === 2 && BOOLEAN_PAIRS.some(([a, b]) => a === low && b === high);
        const parsedNumbers = get('num') ?? 0;
        if (twoValued) {
          refine('boolean', filled, null);
        } else if (parsedNumbers >= REFINE_SHARE * filled) {
          refine('decimal', parsedNumbers, null);
        } else if ((get('date_shaped') ?? 0) >= REFINE_SHARE * filled) {
          dateCandidates.push(profile);
        }
        if (profile.type !== 'decimal') {
          profile.categorical = {
            top: [],
            minLength: get('min_len'),
            maxLength: get('max_len'),
          };
        }
      }
      return profile;
    }),
  };
}

/** The SQL expression a column's statistics are computed on. */
function valueExpr(col: ColumnProfile): string {
  const c = quoteColumn(col.name);
  if (col.storageType !== 'text' || col.refinement === null) return c;
  if (col.type === 'decimal') return numberFromText(c);
  if (col.type === 'date') return dateFromText(c, col.refinement.format ?? DATE_FORMATS[0]);
  return c;
}

// ------------------------------------------------ statement 2, only if needed

/**
 * Counts how many values each date format reads. Parsing dates is the
 * slowest probe by far, so it runs only on columns already shaped like dates.
 */
export function datesSql(table: string, columns: ColumnProfile[]): string {
  const parts = columns.flatMap((col, i) =>
    DATE_FORMATS.map(
      (f, j) =>
        `COUNT(try_strptime(trim(${quoteColumn(col.name)}), ${literal(f)})) AS c${i}_date${j}`,
    ),
  );
  return ['SELECT', parts.map((p) => `  ${p}`).join(',\n'), `FROM ${quoteTable(table)}`].join('\n');
}

/** The format reading the most values wins; earlier formats win ties. */
function readDates(result: QueryResult, columns: ColumnProfile[], rows: number): void {
  const v = rowByAlias(result);
  columns.forEach((col, i) => {
    const filled = rows - col.empty;
    const best = DATE_FORMATS.map((format, j) => ({
      format,
      count: num(v.get(`c${i}_date${j}`)) ?? 0,
    })).reduce((a, b) => (b.count > a.count ? b : a));
    if (best.count >= REFINE_SHARE * filled) {
      col.type = 'date';
      col.refinement = {
        from: col.storageType,
        parsed: best.count,
        unparsed: filled - best.count,
        format: best.format,
      };
      col.categorical = null;
    }
  });
}

// ---------------------------------------------------------------- statement 3

export function numericSql(table: string, columns: ColumnProfile[]): string {
  const parts = columns.flatMap((col, i) => {
    const x = valueExpr(col);
    const p = `c${i}_`;
    return [
      `CAST(MIN(${x}) AS DOUBLE) AS ${p}min`,
      `CAST(MAX(${x}) AS DOUBLE) AS ${p}max`,
      `CAST(AVG(${x}) AS DOUBLE) AS ${p}mean`,
      `CAST(MEDIAN(${x}) AS DOUBLE) AS ${p}median`,
      `CAST(QUANTILE_CONT(${x}, 0.05) AS DOUBLE) AS ${p}p05`,
      `CAST(QUANTILE_CONT(${x}, 0.95) AS DOUBLE) AS ${p}p95`,
      `CAST(COUNT(${x}) AS BIGINT) AS ${p}n`,
      `CAST(COUNT(*) FILTER (WHERE ${x} = 0) AS BIGINT) AS ${p}zeros`,
      `CAST(COUNT(*) FILTER (WHERE ${x} < 0) AS BIGINT) AS ${p}negatives`,
    ];
  });
  return ['SELECT', parts.map((p) => `  ${p}`).join(',\n'), `FROM ${quoteTable(table)}`].join('\n');
}

function readNumeric(result: QueryResult, columns: ColumnProfile[]): void {
  const v = rowByAlias(result);
  columns.forEach((col, i) => {
    const get = (stat: string) => num(v.get(`c${i}_${stat}`));
    const n = get('n') ?? 0;
    col.numeric = {
      min: get('min'),
      max: get('max'),
      mean: get('mean'),
      median: get('median'),
      p05: get('p05'),
      p95: get('p95'),
      zeroShare: n > 0 ? (get('zeros') ?? 0) / n : null,
      negativeShare: n > 0 ? (get('negatives') ?? 0) / n : null,
    };
  });
}

// ---------------------------------------------------------------- statement 4

export function temporalSql(table: string, columns: ColumnProfile[]): string {
  const parts = columns.flatMap((col, i) => {
    const x = valueExpr(col);
    const day = col.type === 'timestamp' ? `CAST(${x} AS DATE)` : x;
    const p = `c${i}_`;
    return [
      `MIN(${x}) AS ${p}min`,
      `MAX(${x}) AS ${p}max`,
      `CAST(COUNT(DISTINCT ${day}) AS BIGINT) AS ${p}days`,
      `CAST(date_diff('day', MIN(${day}), MAX(${day})) + 1 - COUNT(DISTINCT ${day}) AS BIGINT) AS ${p}gaps`,
    ];
  });
  return ['SELECT', parts.map((p) => `  ${p}`).join(',\n'), `FROM ${quoteTable(table)}`].join('\n');
}

function readTemporal(result: QueryResult, columns: ColumnProfile[]): void {
  const v = rowByAlias(result);
  columns.forEach((col, i) => {
    const text = (stat: string) => {
      const value = v.get(`c${i}_${stat}`);
      return value === null || value === undefined ? null : String(value);
    };
    col.temporal = {
      min: text('min'),
      max: text('max'),
      distinctDays: num(v.get(`c${i}_days`)) ?? 0,
      gapDays: num(v.get(`c${i}_gaps`)) ?? 0,
    };
  });
}

// ---------------------------------------------------------------- statement 5

/** The ten most common values of each column, one union, one statement. */
export function topValuesSql(table: string, columns: ColumnProfile[]): string {
  const from = quoteTable(table);
  const parts = columns.map((col, i) => {
    const c = quoteColumn(col.name);
    const filled =
      col.storageType === 'text' ? `${c} IS NOT NULL AND ${nonEmpty(c)}` : `${c} IS NOT NULL`;
    return [
      `(SELECT ${i} AS col, CAST(${c} AS VARCHAR) AS value, CAST(COUNT(*) AS BIGINT) AS n`,
      ` FROM ${from} WHERE ${filled}`,
      ` GROUP BY 2 ORDER BY 3 DESC, 2 LIMIT ${TOP_VALUES})`,
    ].join('\n');
  });
  return [parts.join('\nUNION ALL\n'), 'ORDER BY col, n DESC, value'].join('\n');
}

function readTopValues(result: QueryResult, columns: ColumnProfile[]): void {
  for (const col of columns) col.categorical ??= { top: [], minLength: null, maxLength: null };
  for (const [index, value, count] of result.rows) {
    columns[Number(index)].categorical?.top.push({ value: String(value), count: Number(count) });
  }
}

// ------------------------------------------------------------------- profile

/** Profiles every column of `table`. Never changes the data. */
export async function profileTable(engine: QueryEngine, table: string): Promise<Profile> {
  const info = await engine.describe(table);
  const sql: string[] = [];
  const run = async (statement: string) => {
    sql.push(statement);
    return engine.query(statement);
  };

  const { rows, columns, dateCandidates } = readBase(await run(baseSql(table, info)), info);
  if (dateCandidates.length > 0) {
    readDates(await run(datesSql(table, dateCandidates)), dateCandidates, rows);
  }

  const numeric = columns.filter((c) => family(c.type) === 'numeric');
  if (numeric.length > 0) readNumeric(await run(numericSql(table, numeric)), numeric);

  const temporal = columns.filter((c) => family(c.type) === 'temporal');
  if (temporal.length > 0) readTemporal(await run(temporalSql(table, temporal)), temporal);

  const categorical = columns.filter((c) => family(c.type) === 'categorical');
  if (categorical.length > 0) {
    readTopValues(await run(topValuesSql(table, categorical)), categorical);
  }

  return { table, rows, columns, sql };
}
