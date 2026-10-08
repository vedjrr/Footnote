// The raw SQL guard: hostile statements are refused before they reach the
// engine; legitimate analytic statements pass, are wrapped and run on the
// retail sample.

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createNodeEngine } from '@/adapters/duckdb-node';
import type { QueryEngine } from '@/core/engine/types';
import { GUARD_ROW_LIMIT, guardSql, withTimeout } from '@/core/query/guard';

const HOSTILE: Array<[string, string]> = [
  ['two statements', 'SELECT * FROM orders; DROP TABLE orders'],
  ['two selects', 'SELECT 1; SELECT 2'],
  ['drop', 'DROP TABLE orders'],
  ['delete', 'DELETE FROM orders'],
  ['insert', "INSERT INTO orders VALUES (1, 'x')"],
  ['update', 'UPDATE orders SET revenue = 0'],
  ['create table as', 'CREATE TABLE stolen AS SELECT * FROM orders'],
  ['copy out', "COPY orders TO '/tmp/orders.csv'"],
  ['copy of a select', "COPY (SELECT * FROM orders) TO 'out.parquet' (FORMAT parquet)"],
  ['attach', "ATTACH 'other.db' AS other"],
  ['install', 'INSTALL httpfs'],
  ['load', 'LOAD httpfs'],
  ['pragma', 'PRAGMA database_list'],
  ['set', 'SET threads = 1'],
  ['export database', "EXPORT DATABASE '/tmp/x'"],
  ['call', 'CALL duckdb_settings()'],
  ['read_csv', "SELECT * FROM read_csv('/etc/passwd')"],
  ['read_parquet', "SELECT * FROM read_parquet('https://example.com/x.parquet')"],
  ['read_text', "SELECT read_text('/etc/hosts')"],
  ['file by name', "SELECT * FROM 'secrets.csv'"],
  ['glob', "SELECT * FROM glob('*')"],
  ['settings function', "SELECT current_setting('home_directory')"],
  ['getenv', "SELECT getenv('HOME')"],
  ['catalog table', 'SELECT * FROM information_schema.tables'],
  ['another table in a join', 'SELECT * FROM orders JOIN customers ON true'],
  ['another table after a comma', 'SELECT * FROM orders, duckdb_tables'],
  ['schema-qualified', 'SELECT * FROM main.orders'],
  [
    'table function in a subquery',
    "SELECT * FROM orders WHERE order_id IN (SELECT * FROM read_json('x'))",
  ],
  ['union with a file', "SELECT region FROM orders UNION ALL SELECT * FROM sniff_csv('x')"],
  ['write hidden in a CTE', 'WITH x AS (DELETE FROM orders RETURNING *) SELECT * FROM x'],
  ['insert hidden in a CTE', 'WITH x AS (INSERT INTO orders VALUES (1) RETURNING *) SELECT 1'],
  ['comment splitting a keyword', 'SEL/**/ECT * FROM orders'],
  ['comment before a drop', '/* harmless */ DROP TABLE orders'],
  ['statement after a comment', "SELECT 1 /* ; */ ; ATTACH 'x'"],
  ['unclosed comment', 'SELECT 1 /* DROP TABLE orders'],
  ['unclosed string', "SELECT 'abc FROM orders"],
  ['quoted function name', 'SELECT "read_text"(\'x\')'],
  ['dollar quoting', 'SELECT $$abc$$'],
  ['select into', 'SELECT * INTO copy FROM orders'],
  ['describe', 'DESCRIBE orders'],
  ['summarize', 'SUMMARIZE orders'],
  ['checkpoint', 'CHECKPOINT'],
  ['empty', '   '],
  ['unbalanced brackets', 'SELECT (1 FROM orders'],
];

const LEGIT = [
  'SELECT count(*) AS n FROM orders',
  'SELECT region, sum(revenue) AS revenue FROM orders GROUP BY region ORDER BY revenue DESC',
  "SELECT date_trunc('month', order_date) AS m, avg(discount_pct) FROM orders GROUP BY 1 ORDER BY 1",
  "WITH monthly AS (SELECT date_trunc('month', order_date) AS m, sum(revenue) AS r FROM orders GROUP BY 1) SELECT m, r, lag(r) OVER (ORDER BY m) AS prev FROM monthly",
  'SELECT category, count(*) FILTER (WHERE returned) / count(*) AS return_rate FROM orders GROUP BY category',
  'SELECT customer_id, sum(revenue) AS r, rank() OVER (ORDER BY sum(revenue) DESC) AS k FROM orders GROUP BY 1 ORDER BY k LIMIT 20',
  'SELECT extract(year FROM order_date) AS y, quantile_cont(revenue, 0.9) FROM orders GROUP BY 1;',
  'SELECT o.region, count(DISTINCT p.customer_id) FROM orders o JOIN orders p USING (order_id) GROUP BY 1',
  "SELECT * FROM (SELECT region, CAST(sum(cost) AS DOUBLE) AS c FROM orders WHERE channel IN ('Online', 'Store') GROUP BY region) sub WHERE c > 0",
  'SELECT "region", coalesce(customer_segment, \'Unknown\') AS seg, round(avg(unit_price), 2) FROM "orders" -- by segment\nGROUP BY ALL',
  'SELECT * FROM orders',
];

let engine: QueryEngine;

beforeAll(async () => {
  engine = await createNodeEngine();
  await engine.registerFile('orders', {
    kind: 'path',
    format: 'parquet',
    path: 'data/demo/retail/orders.parquet',
  });
});

afterAll(async () => {
  await engine.close();
});

describe('hostile statements are refused', () => {
  test('there are at least 30', () => {
    expect(HOSTILE.length).toBeGreaterThanOrEqual(30);
  });

  test.each(HOSTILE)('%s', (_, sql) => {
    const result = guardSql(sql, 'orders');
    expect(result.ok, sql).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/\.$/);
  });
});

describe('legitimate statements pass and run', () => {
  test('there are at least 10', () => {
    expect(LEGIT.length).toBeGreaterThanOrEqual(10);
  });

  test.each(LEGIT)('%s', async (sql) => {
    const result = guardSql(sql, 'orders');
    if (!result.ok) throw new Error(result.reason);
    expect(result.sql.endsWith(`LIMIT ${GUARD_ROW_LIMIT}`)).toBe(true);
    const out = await withTimeout(engine.query(result.sql));
    expect(out.rowCount).toBeGreaterThan(0);
    expect(out.rowCount).toBeLessThanOrEqual(GUARD_ROW_LIMIT);
  });
});

test('a slow query is stopped after the time limit', async () => {
  const never = new Promise<never>(() => {});
  await expect(withTimeout(never, 20)).rejects.toThrow('longer than 0.02 seconds');
  await expect(withTimeout(Promise.reject(new Error('boom')), 20)).rejects.toThrow('boom');
});
