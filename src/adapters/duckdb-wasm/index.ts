// QueryEngine on DuckDB-WASM. DuckDB runs in a Web Worker; this side only
// sends statements and turns the Arrow results into Cells. Nothing starts
// until the first call, so pages that never query never download the engine.

import * as duckdb from '@duckdb/duckdb-wasm';
import { Type, type DataType, type Table } from 'apache-arrow';
import {
  bigIntFromWords,
  cellFromBigInt,
  cellFromNumber,
  cellFromScaledDecimal,
  columnTypeFromSql,
  dateFromEpochDays,
  describeSql,
  loadFileSql,
  timestampFromEpochMs,
} from '@/core/engine/normalise';
import type {
  Cell,
  ColumnInfo,
  ColumnType,
  FileSource,
  QueryEngine,
  QueryResult,
} from '@/core/engine/types';

/** Where scripts/copy-duckdb.mjs puts the bundles (D-020). */
const BUNDLE_PATH = '/duckdb';

interface Started {
  db: duckdb.AsyncDuckDB;
  conn: duckdb.AsyncDuckDBConnection;
  worker: Worker;
}

export function createWasmEngine(): QueryEngine {
  let starting: Promise<Started> | null = null;
  const start = () => (starting ??= startDuckDb());

  async function run(sql: string, params: Cell[] = []): Promise<Table> {
    const { conn } = await start();
    if (params.length === 0) return conn.query(sql);
    const statement = await conn.prepare(sql);
    try {
      return await statement.query(...params);
    } finally {
      await statement.close();
    }
  }

  async function describe(table: string): Promise<ColumnInfo[]> {
    const rows = toRows(await run(describeSql(table)));
    return rows.map((row) => ({
      name: String(row[0]),
      type: columnTypeFromSql(String(row[1])),
      nullable: row[2] === 'YES',
    }));
  }

  return {
    async registerFile(table: string, source: FileSource): Promise<ColumnInfo[]> {
      if (source.kind !== 'bytes')
        throw new Error('The browser engine loads files from bytes only.');
      const { db } = await start();
      const fileName = `${table}.${source.format}`;
      await db.registerFileBuffer(fileName, source.bytes);
      await run(loadFileSql(table, fileName, source.format));
      return describe(table);
    },

    async query(sql: string, params: Cell[] = []): Promise<QueryResult> {
      const started = performance.now();
      const table = await run(sql, params);
      const columns = table.schema.fields.map((field) => ({
        name: field.name,
        type: columnTypeFromArrow(field.type),
        nullable: true,
      }));
      const rows = toRows(table);
      return { columns, rows, rowCount: rows.length, elapsedMs: performance.now() - started };
    },

    describe,

    async engineVersion(): Promise<string> {
      const { db } = await start();
      return `duckdb ${await db.getVersion()} (duckdb-wasm)`;
    },

    async close(): Promise<void> {
      if (!starting) return;
      const { db, conn, worker } = await starting;
      starting = null;
      await conn.close();
      await db.terminate();
      worker.terminate();
    },
  };
}

async function startDuckDb(): Promise<Started> {
  const base = new URL(BUNDLE_PATH, window.location.origin).href;
  const bundle = await duckdb.selectBundle({
    mvp: {
      mainModule: `${base}/duckdb-mvp.wasm`,
      mainWorker: `${base}/duckdb-browser-mvp.worker.js`,
    },
    eh: {
      mainModule: `${base}/duckdb-eh.wasm`,
      mainWorker: `${base}/duckdb-browser-eh.worker.js`,
    },
  });
  const worker = new Worker(bundle.mainWorker!);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule);
  await db.open({
    // A user's file must load with no network: never fetch extensions.
    query: { castBigIntToDouble: false, castDecimalToDouble: false },
  });
  const conn = await db.connect();
  await conn.query('SET autoinstall_known_extensions = false');
  return { db, conn, worker };
}

function columnTypeFromArrow(type: DataType): ColumnType {
  switch (type.typeId) {
    case Type.Int:
      return 'integer';
    case Type.Float:
      return 'decimal';
    case Type.Decimal:
      return isHugeInt(type) ? 'integer' : 'decimal';
    case Type.Bool:
      return 'boolean';
    case Type.Date:
      return 'date';
    case Type.Timestamp:
      return 'timestamp';
    default:
      return 'text';
  }
}

// DuckDB hands HUGEINT to Arrow as DECIMAL(38,0).
function isHugeInt(type: DataType): boolean {
  const { precision, scale } = type as unknown as { precision: number; scale: number };
  return scale === 0 && precision === 38;
}

function toRows(table: Table): Cell[][] {
  const fields = table.schema.fields;
  const vectors = fields.map((_, i) => table.getChildAt(i)!);
  const rows: Cell[][] = [];
  for (let r = 0; r < table.numRows; r++) {
    rows.push(fields.map((field, c) => toCell(vectors[c].get(r), field.type)));
  }
  return rows;
}

const MS_PER_DAY = 86_400_000;

function toCell(value: unknown, type: DataType): Cell {
  if (value === null || value === undefined) return null;
  switch (type.typeId) {
    case Type.Date:
      return dateFromEpochDays(Math.round(Number(value) / MS_PER_DAY));
    case Type.Timestamp:
      return timestampFromEpochMs(Math.floor(Number(value)));
    case Type.Decimal: {
      const unscaled = bigIntFromWords(value as ArrayLike<number>);
      const { scale } = type as unknown as { scale: number };
      return isHugeInt(type) ? cellFromBigInt(unscaled) : cellFromScaledDecimal(unscaled, scale);
    }
  }
  if (typeof value === 'bigint') return cellFromBigInt(value);
  if (typeof value === 'number') return cellFromNumber(value);
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  return JSON.stringify(value, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v));
}
