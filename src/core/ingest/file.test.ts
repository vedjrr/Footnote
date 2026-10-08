import { describe, expect, test } from 'vitest';
import {
  LIMITS,
  checkSize,
  detectDelimiter,
  fileKind,
  findRaggedLine,
  looksHeaderless,
  sizeWarning,
} from './file';

// The engine-backed failure cases are in tests/ingest/ingest.test.ts.

describe('checks without the engine', () => {
  test('file kinds come from the extension', () => {
    expect(fileKind('A.CSV').format).toBe('csv');
    expect(fileKind('a.tsv').delimiter).toBe('\t');
    expect(fileKind('a.jsonl').format).toBe('json');
    expect(() => fileKind('README')).toThrow(/not a CSV, TSV, Parquet or JSON file/);
  });

  test('size limits', () => {
    expect(() => checkSize('a.csv', LIMITS.refuseBytes)).not.toThrow();
    expect(() => checkSize('a.csv', LIMITS.refuseBytes + 1)).toThrow(
      'a.csv is 300 MB, and files up to 300 MB can be opened in the browser.',
    );
    expect(sizeWarning(LIMITS.warnBytes, LIMITS.warnRows)).toBeNull();
    expect(sizeWarning(150_000_000, 10)).toBe(
      'This file is over 100 MB, so the briefing and answers will take longer than usual.',
    );
    expect(sizeWarning(10, 2_500_000)).toMatch(/^This file has more than 2 million rows,/);
  });

  test('delimiters and ragged lines', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(detectDelimiter('a|b\n')).toBe('|');
    expect(detectDelimiter('"x,y";z;w\n')).toBe(';');
    expect(detectDelimiter('single\n1\n')).toBeUndefined();
    expect(findRaggedLine('a,b\n1,2\n\n3,4\n5\n', ',')).toEqual({ line: 5, values: 1, columns: 2 });
    // The last line may be cut off, so it is not judged.
    expect(findRaggedLine('a,b\n1,2\n3', ',')).toBeNull();
  });

  test('a header of values is not a header', () => {
    expect(looksHeaderless(['1', '2024-01-01', '3.5'])).toBe(true);
    expect(looksHeaderless(['03/04/2024', 'TRUE'])).toBe(true);
    expect(looksHeaderless(['region', '2023', '2024'])).toBe(false);
    expect(looksHeaderless(['id', 'name'])).toBe(false);
  });
});
