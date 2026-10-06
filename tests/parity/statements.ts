// Reads the parity statements: NN-name.sql files, each one statement, with
// optional bound parameters on a first line `-- params: [...]`.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ParityStatement {
  name: string;
  sql: string;
  params: (string | number | boolean | null)[];
}

const here = dirname(fileURLToPath(import.meta.url));

export const fixtureSql = readFileSync(join(here, 'fixture.sql'), 'utf8');
export const expectedPath = join(here, 'expected.json');

export function loadStatements(): ParityStatement[] {
  return readdirSync(here)
    .filter((f) => /^\d+-.+\.sql$/.test(f))
    .sort()
    .map((file) => {
      const text = readFileSync(join(here, file), 'utf8');
      const match = /^-- params: (.*)\n/.exec(text);
      return {
        name: file.replace(/\.sql$/, ''),
        sql: (match ? text.slice(match[0].length) : text).trim(),
        params: match ? (JSON.parse(match[1]) as ParityStatement['params']) : [],
      };
    });
}
