// Value and type normalisation shared by both adapters (architecture §4).
// Each adapter unpacks its engine's raw values (bigint, epoch days, epoch
// microseconds) and passes them through these, so core sees one shape.

import type { Cell, ColumnType, FileFormat } from './types';

const INTEGER_TYPES = new Set([
  'TINYINT',
  'SMALLINT',
  'INTEGER',
  'BIGINT',
  'HUGEINT',
  'UTINYINT',
  'USMALLINT',
  'UINTEGER',
  'UBIGINT',
  'UHUGEINT',
]);
const DECIMAL_TYPES = new Set(['FLOAT', 'DOUBLE', 'DECIMAL']);
const TIMESTAMP_TYPES = new Set([
  'TIMESTAMP',
  'TIMESTAMP_S',
  'TIMESTAMP_MS',
  'TIMESTAMP_NS',
  'TIMESTAMP WITH TIME ZONE',
]);

/** Maps a DuckDB SQL type name such as `DECIMAL(18,2)` to a column type. */
export function columnTypeFromSql(sqlType: string): ColumnType {
  const base = sqlType.toUpperCase().replace(/\(.*$/, '').trim();
  if (INTEGER_TYPES.has(base)) return 'integer';
  if (DECIMAL_TYPES.has(base)) return 'decimal';
  if (base === 'BOOLEAN') return 'boolean';
  if (base === 'DATE') return 'date';
  if (TIMESTAMP_TYPES.has(base)) return 'timestamp';
  return 'text';
}

/** NaN and the infinities have no place in a result: they become null. */
export function cellFromNumber(value: number): Cell {
  return Number.isFinite(value) ? value : null;
}

/** A big integer is a number when it is safe, otherwise its decimal string. */
export function cellFromBigInt(value: bigint): Cell {
  return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(value)
    : value.toString();
}

/** A scaled decimal integer (value × 10^-scale) as a number. */
export function cellFromScaledDecimal(value: bigint, scale: number): Cell {
  return cellFromNumber(Number(value) / 10 ** scale);
}

const MS_PER_DAY = 86_400_000;

/** Days since 1970-01-01 as `YYYY-MM-DD`. */
export function dateFromEpochDays(days: number): string {
  return new Date(days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Milliseconds since the epoch as ISO 8601 without a zone. Precision is the
 * millisecond, because that is what the browser engine hands back; the
 * fraction is omitted when it is zero.
 */
export function timestampFromEpochMs(ms: number): string {
  const iso = new Date(ms).toISOString(); // 2024-01-02T03:04:05.123Z
  const millis = iso.slice(20, 23);
  return millis === '000' ? iso.slice(0, 19) : iso.slice(0, 23);
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

/** Table names are plain identifiers; anything else is refused. */
export function assertTableName(table: string): void {
  if (!IDENTIFIER.test(table)) throw new Error(`Not a valid table name: ${table}`);
}

const literal = (text: string) => `'${text.replaceAll("'", "''")}'`;

/**
 * The statement that loads a file the engine can see at `fileRef`. With a
 * fixed delimiter the first line is always the header: the browser engine
 * would otherwise skip lines to find a "better" one.
 */
export function loadFileSql(
  table: string,
  fileRef: string,
  format: FileFormat,
  delimiter?: string,
): string {
  assertTableName(table);
  const ref = literal(fileRef);
  const delim = delimiter === undefined ? '' : `, delim = ${literal(delimiter)}, skip = 0`;
  const reader =
    format === 'csv'
      ? `read_csv(${ref}, header = true, auto_detect = true${delim})`
      : format === 'parquet'
        ? `read_parquet(${ref})`
        : `read_json(${ref}, auto_detect = true)`;
  return `CREATE OR REPLACE TABLE "${table}" AS SELECT * FROM ${reader}`;
}

/** The statement whose rows are (column_name, column_type, null, ...). */
export function describeSql(table: string): string {
  assertTableName(table);
  return `DESCRIBE "${table}"`;
}

/** A little-endian two's complement integer held in 32-bit words. */
export function bigIntFromWords(words: ArrayLike<number>): bigint {
  let value = 0n;
  for (let i = words.length - 1; i >= 0; i--) value = (value << 32n) | BigInt(words[i] >>> 0);
  const negative = words.length > 0 && (words[words.length - 1] & 0x80000000) !== 0;
  return negative ? value - (1n << BigInt(words.length * 32)) : value;
}
