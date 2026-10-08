// Every failure case runs through the real engine (Node adapter), so the
// mapping from DuckDB's errors to messages is tested against what DuckDB
// actually says.

import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createNodeEngine } from '@/adapters/duckdb-node';
import type { QueryEngine } from '@/core/engine/types';
import { IngestError } from '@/core/ingest/file';
import { ingestFile } from '@/core/ingest/ingest';

let engine: QueryEngine;

beforeAll(async () => {
  engine = await createNodeEngine();
});

afterAll(async () => {
  await engine.close();
});

const text = (s: string) => new TextEncoder().encode(s);

async function ingest(name: string, bytes: Uint8Array) {
  return ingestFile(engine, { name, bytes }, 'own_file');
}

async function failure(name: string, bytes: Uint8Array): Promise<IngestError> {
  try {
    await ingest(name, bytes);
  } catch (error) {
    if (error instanceof IngestError) return error;
    throw error;
  }
  throw new Error(`${name} loaded, but should have failed`);
}

describe('files that load', () => {
  test('a CSV gives its columns and row count', async () => {
    const steps: string[] = [];
    const result = await ingestFile(
      engine,
      {
        name: 'sales.csv',
        bytes: text('day,region,revenue\n2024-01-01,North,10.5\n2024-01-02,South,3\n'),
      },
      'own_file',
      (s) => steps.push(s),
    );
    expect(result.rows).toBe(2);
    expect(result.columns.map((c) => `${c.name}:${c.type}`)).toEqual([
      'day:date',
      'region:text',
      'revenue:decimal',
    ]);
    expect(steps).toEqual(['reading', 'counting']);
  });

  test('a TSV and a semicolon file split on their delimiter', async () => {
    expect((await ingest('a.tsv', text('a\tb\n1\t2\n3\t4\n'))).columns).toHaveLength(2);
    expect((await ingest('a.csv', text('a;b;c\n1;2;3\n'))).columns).toHaveLength(3);
  });

  test('a quoted comma is one value, not a ragged row', async () => {
    const result = await ingest('q.csv', text('a,b,c\n1,"x,y",3\n4,z,6\n'));
    expect(result.rows).toBe(2);
  });

  test('a Parquet and a JSON file load', async () => {
    await engine.query(
      "CREATE OR REPLACE TABLE src AS SELECT range AS id, 'r' || range AS name FROM range(5)",
    );
    const dir = await mkdtemp(join(tmpdir(), 'ingest-'));
    await engine.query(`COPY src TO '${dir}/x.parquet' (FORMAT parquet)`);
    await engine.query(`COPY src TO '${dir}/x.json' (FORMAT json, ARRAY true)`);
    const parquet = new Uint8Array(await readFile(`${dir}/x.parquet`));
    const json = new Uint8Array(await readFile(`${dir}/x.json`));
    expect((await ingest('x.parquet', parquet)).rows).toBe(5);
    expect((await ingest('x.json', json)).rows).toBe(5);
    expect((await ingest('x.ndjson', text('{"a":1}\n{"a":2}\n'))).rows).toBe(2);
  });

  test('a header of years still counts as a header', async () => {
    expect((await ingest('w.csv', text('region,2023,2024\nNorth,1,2\n'))).rows).toBe(1);
  });
});

describe('each failure has its message', () => {
  test('unsupported type', async () => {
    const e = await failure('book.xlsx', text('x'));
    expect(e.kind).toBe('unsupported-type');
    expect(e.message).toBe(
      'book.xlsx is an .xlsx file, which cannot be read here. Save it as CSV, TSV, Parquet or JSON and try again.',
    );
  });

  test('empty file', async () => {
    const e = await failure('blank.csv', new Uint8Array());
    expect(e.kind).toBe('empty');
    expect(e.message).toMatch(/^blank\.csv is empty\./);
  });

  test('a header and no rows', async () => {
    const e = await failure('head.csv', text('id,value\n'));
    expect(e.kind).toBe('no-rows');
    expect(e.message).toMatch(/has column names but no rows/);
  });

  test('no header row', async () => {
    const e = await failure('raw.csv', text('1,2024-01-01,3.5\n2,2024-01-02,4.5\n'));
    expect(e.kind).toBe('no-header');
    expect(e.message).toBe(
      'This file has no header row. Add column names as the first line and try again.',
    );
  });

  test('a row with too many values, found in the first lines', async () => {
    const e = await failure('ragged.csv', text('a,b,c\n1,2,3\n4,5,6,7\n8,9,10\n'));
    expect(e.kind).toBe('inconsistent-columns');
    expect(e.message).toBe(
      'Line 3 of ragged.csv has 4 values, but the header names 3 columns. Make every row the same length as the header and try again.',
    );
  });

  test('a row with too few values', async () => {
    const e = await failure('short.csv', text('a,b,c\n1,2,3\n4,5\n'));
    expect(e.kind).toBe('inconsistent-columns');
    expect(e.message).toMatch(/^Line 3 of short\.csv has 2 values/);
  });

  test('a ragged row far past the first megabyte', async () => {
    const good = 'a,b,c\n' + '1,2,3\n'.repeat(200_000);
    const e = await failure('late.csv', text(good + '4,5,6,7\n'));
    expect(e.kind).toBe('inconsistent-columns');
  });

  test('Latin-1 text', async () => {
    const latin1 = new Uint8Array([
      ...text('name,city\nJos'),
      0xe9,
      ...text(',Le'),
      0xf3,
      0x6e,
      10,
    ]);
    const e = await failure('latin.csv', latin1);
    expect(e.kind).toBe('encoding');
    expect(e.message).toMatch(/is not saved as UTF-8 text/);
  });

  test('UTF-16 text', async () => {
    const e = await failure('wide.csv', new Uint8Array([0xff, 0xfe, 0x61, 0x00, 0x0a, 0x00]));
    expect(e.kind).toBe('encoding');
  });

  test('a broken Parquet or JSON file', async () => {
    expect((await failure('bad.parquet', text('PAR1garbage'))).message).toBe(
      'bad.parquet could not be read as a Parquet file. Check that it opens in another program, save it again as Parquet, and try again.',
    );
    expect((await failure('bad.json', text('not json {'))).kind).toBe('unreadable');
  });

  test('a failed file leaves no table behind', async () => {
    await failure('raw.csv', text('1,2\n3,4\n'));
    const tables = await engine.query(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'own_file'",
    );
    expect(tables.rows[0][0]).toBe(0);
  });
});
