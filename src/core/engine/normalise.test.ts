import { describe, expect, test } from 'vitest';
import {
  assertTableName,
  bigIntFromWords,
  cellFromBigInt,
  cellFromNumber,
  cellFromScaledDecimal,
  columnTypeFromSql,
  dateFromEpochDays,
  loadFileSql,
  timestampFromEpochMs,
} from './normalise';

describe('normalise', () => {
  test('maps DuckDB type names to column types', () => {
    expect(columnTypeFromSql('DECIMAL(18,2)')).toBe('decimal');
    expect(columnTypeFromSql('BIGINT')).toBe('integer');
    expect(columnTypeFromSql('HUGEINT')).toBe('integer');
    expect(columnTypeFromSql('TIMESTAMP_MS')).toBe('timestamp');
    expect(columnTypeFromSql('DATE')).toBe('date');
    expect(columnTypeFromSql('BOOLEAN')).toBe('boolean');
    expect(columnTypeFromSql('VARCHAR')).toBe('text');
    expect(columnTypeFromSql('INTERVAL')).toBe('text');
  });

  test('big integers stay numbers only while safe', () => {
    expect(cellFromBigInt(BigInt('9007199254740991'))).toBe(9007199254740991);
    expect(cellFromBigInt(BigInt('9007199254740993'))).toBe('9007199254740993');
    expect(cellFromBigInt(BigInt('-9007199254740993'))).toBe('-9007199254740993');
  });

  test('NaN and infinities become null', () => {
    expect(cellFromNumber(Number.NaN)).toBeNull();
    expect(cellFromNumber(Number.POSITIVE_INFINITY)).toBeNull();
    expect(cellFromNumber(0.5)).toBe(0.5);
  });

  test('scaled decimals become numbers', () => {
    expect(cellFromScaledDecimal(BigInt(1234), 2)).toBe(12.34);
  });

  test('dates and timestamps are ISO without a zone', () => {
    expect(dateFromEpochDays(19724)).toBe('2024-01-02');
    expect(timestampFromEpochMs(Date.UTC(2024, 0, 2, 3, 4, 5))).toBe('2024-01-02T03:04:05');
    expect(timestampFromEpochMs(Date.UTC(2024, 0, 2, 3, 4, 5, 120))).toBe(
      '2024-01-02T03:04:05.120',
    );
  });

  test('table names must be plain identifiers', () => {
    expect(() => assertTableName('orders_2024')).not.toThrow();
    expect(() => assertTableName('x"; DROP TABLE y; --')).toThrow();
    expect(loadFileSql('t', "it's.csv", 'csv')).toContain("'it''s.csv'");
  });
});

test('decodes 128-bit words', () => {
  expect(bigIntFromWords([1234, 0, 0, 0])).toBe(1234n);
  expect(bigIntFromWords([0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff])).toBe(-1n);
  expect(bigIntFromWords([1, 1, 0, 0])).toBe(4294967297n);
});
