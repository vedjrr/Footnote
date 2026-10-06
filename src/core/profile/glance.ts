// The data at a glance: how many rows, which days they cover, how many
// columns. One query, shown in the working paper exactly as it ran.

import type { ColumnInfo, QueryResult } from '@/core/engine/types';

export interface Glance {
  rows: number;
  columns: number;
  /** ISO dates (YYYY-MM-DD) of the first and last day, or null with no rows. */
  firstDay: string | null;
  lastDay: string | null;
}

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quote(name: string): string {
  if (!NAME.test(name)) throw new Error(`Not a plain column or table name: ${name}`);
  return `"${name}"`;
}

/** Rows and the day range of `timeColumn`. Timestamps are cut to the day. */
export function glanceSql(table: string, timeColumn: string): string {
  const t = quote(timeColumn);
  return [
    'SELECT',
    '  CAST(COUNT(*) AS BIGINT) AS row_count,',
    `  CAST(MIN(${t}) AS DATE) AS first_day,`,
    `  CAST(MAX(${t}) AS DATE) AS last_day`,
    `FROM ${quote(table)}`,
  ].join('\n');
}

export function readGlance(result: QueryResult, columns: ColumnInfo[]): Glance {
  const [rowCount, firstDay, lastDay] = result.rows[0] ?? [];
  return {
    rows: Number(rowCount ?? 0),
    columns: columns.length,
    firstDay: typeof firstDay === 'string' ? firstDay : null,
    lastDay: typeof lastDay === 'string' ? lastDay : null,
  };
}
