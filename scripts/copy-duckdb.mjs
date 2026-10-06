// Puts everything DuckDB-WASM needs under public/duckdb so the site serves it
// itself and makes no third-party request at run time (D-020, Q-01):
// - the eh and mvp bundles, copied from node_modules;
// - the parquet and json extensions, which the browser build does not include,
//   downloaded once from extensions.duckdb.org into the layout DuckDB expects
//   for a custom extension repository: <repo>/<version>/<platform>/<name>.duckdb_extension.wasm
// Runs after install (a failed download only warns) and before dev and build
// (`--strict`: a missing extension fails the build). Nothing here is committed.

import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// The DuckDB engine inside @duckdb/duckdb-wasm; engineVersion() reports it.
// Change it together with the package, or the extension paths will 404.
const ENGINE_VERSION = 'v1.5.4';
const PLATFORMS = ['wasm_eh', 'wasm_mvp'];
const EXTENSIONS = ['parquet', 'json'];

const strict = process.argv.includes('--strict');
const source = join('node_modules', '@duckdb', 'duckdb-wasm', 'dist');
const target = join('public', 'duckdb');
const bundles = [
  'duckdb-eh.wasm',
  'duckdb-browser-eh.worker.js',
  'duckdb-mvp.wasm',
  'duckdb-browser-mvp.worker.js',
];

await mkdir(target, { recursive: true });
for (const file of bundles) await copyFile(join(source, file), join(target, file));

let missing = 0;
for (const platform of PLATFORMS) {
  const dir = join(target, 'extensions', ENGINE_VERSION, platform);
  await mkdir(dir, { recursive: true });
  for (const name of EXTENSIONS) {
    const file = join(dir, `${name}.duckdb_extension.wasm`);
    if (await exists(file)) continue;
    const url = `https://extensions.duckdb.org/${ENGINE_VERSION}/${platform}/${name}.duckdb_extension.wasm`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await writeFile(file, new Uint8Array(await response.arrayBuffer()));
    } catch (error) {
      missing++;
      console.warn(`copy-duckdb: could not download ${url}: ${error.message}`);
    }
  }
}

const { version } = JSON.parse(
  await readFile(join('node_modules', '@duckdb', 'duckdb-wasm', 'package.json'), 'utf8'),
);
console.log(
  `copy-duckdb: bundles from @duckdb/duckdb-wasm ${version}, extensions for ${ENGINE_VERSION}` +
    (missing ? `, ${missing} missing` : ''),
);
if (missing && strict) process.exit(1);

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
