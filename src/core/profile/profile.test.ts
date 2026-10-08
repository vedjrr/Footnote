import { describe, expect, test } from 'vitest';
import { baseSql, numberFromText } from './profile';

describe('baseSql', () => {
  const columns = [{ name: `it's "x"`, type: 'text' as const, nullable: true }];

  test('refuses a table name that would need escaping', () => {
    expect(() => baseSql('a"; DROP TABLE x', columns)).toThrow(/plain/);
  });

  test('escapes a column name from a user file', () => {
    expect(baseSql('own_file', columns)).toContain('"it\'s ""x"""');
  });
});

describe('numberFromText', () => {
  test('strips currency, separators and a trailing percent, and drops non-finite values', () => {
    const sql = numberFromText('"v"');
    expect(sql).toContain("'[\\s$€£¥₹,]'");
    expect(sql).toContain("'%$'");
    expect(sql).toContain('isfinite');
  });
});
