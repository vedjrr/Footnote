// Copies the DuckDB-WASM bundles from node_modules into public/duckdb so the
// site serves them itself and makes no third-party request (D-020, Q-01).
// Runs after install and before dev and build. The files are not committed:
// they are large and come from the pinned package.

import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const source = join('node_modules', '@duckdb', 'duckdb-wasm', 'dist');
const target = join('public', 'duckdb');
const files = [
  'duckdb-eh.wasm',
  'duckdb-browser-eh.worker.js',
  'duckdb-mvp.wasm',
  'duckdb-browser-mvp.worker.js',
];

await mkdir(target, { recursive: true });
for (const file of files) await copyFile(join(source, file), join(target, file));
const { version } = JSON.parse(
  await readFile(join('node_modules', '@duckdb', 'duckdb-wasm', 'package.json'), 'utf8'),
);
console.log(`copy-duckdb: ${files.length} files from @duckdb/duckdb-wasm ${version}`);
