import { describe, expect, test } from 'vitest';
import { glanceSql, readGlance } from './glance';

describe('glanceSql', () => {
  test('counts rows and cuts the time column to days', () => {
    expect(glanceSql('orders', 'order_date')).toBe(
      [
        'SELECT',
        '  CAST(COUNT(*) AS BIGINT) AS row_count,',
        '  CAST(MIN("order_date") AS DATE) AS first_day,',
        '  CAST(MAX("order_date") AS DATE) AS last_day',
        'FROM "orders"',
      ].join('\n'),
    );
  });

  test('without a time column, both days are null', () => {
    expect(glanceSql('own_file', null)).toContain('CAST(NULL AS DATE) AS first_day');
  });

  test('refuses a table name that would need escaping', () => {
    expect(() => glanceSql('a"; DROP TABLE x', 'day')).toThrow(/plain/);
  });

  test('escapes a column name from a user file', () => {
    expect(glanceSql('own_file', 'Order "Date"')).toContain('MIN("Order ""Date""")');
  });
});

describe('readGlance', () => {
  const columns = [
    { name: 'a', type: 'date' as const, nullable: true },
    { name: 'b', type: 'integer' as const, nullable: true },
  ];

  test('reads the one result row', () => {
    const result = {
      columns: [],
      rows: [[120, '2024-01-01', '2024-12-31']],
      rowCount: 1,
      elapsedMs: 1,
    };
    expect(readGlance(result, columns)).toEqual({
      rows: 120,
      columns: 2,
      firstDay: '2024-01-01',
      lastDay: '2024-12-31',
    });
  });

  test('an empty table has no day range', () => {
    const result = { columns: [], rows: [[0, null, null]], rowCount: 1, elapsedMs: 1 };
    expect(readGlance(result, columns)).toMatchObject({ rows: 0, firstDay: null, lastDay: null });
  });
});
