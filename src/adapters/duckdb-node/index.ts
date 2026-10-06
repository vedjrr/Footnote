// QueryEngine on @duckdb/node-api, for evals, precompute and tests.

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDBInstance, type DuckDBType } from '@duckdb/node-api';
import {
  cellFromBigInt,
  cellFromNumber,
  columnTypeFromSql,
  describeSql,
  loadFileSql,
  timestampFromEpochMs,
} from '@/core/engine/normalise';
import type { Cell, ColumnInfo, FileSource, QueryEngine, QueryResult } from '@/core/engine/types';

export async function createNodeEngine(): Promise<QueryEngine> {
  const instance = await DuckDBInstance.create(':memory:', {
    // A user's file must load with no network, so never fetch extensions.
    autoinstall_known_extensions: 'false',
    autoload_known_extensions: 'true',
  });
  const connection = await instance.connect();
  const tempDir = await mkdtemp(join(tmpdir(), 'footnote-'));

  async function describe(table: string): Promise<ColumnInfo[]> {
    const reader = await connection.runAndReadAll(describeSql(table));
    return reader.getRowsJS().map((row) => ({
      name: String(row[0]),
      type: columnTypeFromSql(String(row[1])),
      nullable: row[2] === 'YES',
    }));
  }

  return {
    async registerFile(table: string, source: FileSource): Promise<ColumnInfo[]> {
      let path: string;
      if (source.kind === 'path') {
        path = source.path;
      } else {
        path = join(tempDir, `${table}.${source.format}`);
        await writeFile(path, source.bytes);
      }
      await connection.run(loadFileSql(table, path, source.format));
      return describe(table);
    },

    async query(sql: string, params: Cell[] = []): Promise<QueryResult> {
      const started = performance.now();
      const reader = await connection.runAndReadAll(sql, params.length ? params : undefined);
      const types = reader.columnTypes();
      const columns = reader.columnNames().map((name, i) => ({
        name,
        type: columnTypeFromSql(types[i].toString()),
        nullable: true,
      }));
      const rows = reader.getRowsJS().map((row) => row.map((v, i) => toCell(v, types[i])));
      return { columns, rows, rowCount: rows.length, elapsedMs: performance.now() - started };
    },

    describe,

    async engineVersion(): Promise<string> {
      const reader = await connection.runAndReadAll('SELECT version()');
      return `duckdb ${String(reader.getRowsJS()[0][0])} (node-api)`;
    },

    async close(): Promise<void> {
      connection.closeSync();
      instance.closeSync();
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

function toCell(value: unknown, type: DuckDBType): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return cellFromBigInt(value);
  if (typeof value === 'number') return cellFromNumber(value);
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (value instanceof Date) {
    const kind = columnTypeFromSql(type.toString());
    return kind === 'date'
      ? value.toISOString().slice(0, 10)
      : timestampFromEpochMs(value.getTime());
  }
  return JSON.stringify(value, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v));
}
