// npm run data:generate: regenerates the sample datasets and their truth files.

import { join } from 'node:path';
import { createNodeEngine } from '@/adapters/duckdb-node';
import { generateDemo } from '../data/generators/demo';
import { RETAIL } from '../data/generators/retail';

const root = join(import.meta.dirname, '..', 'data', 'demo');

const engine = await createNodeEngine();
try {
  for (const spec of [RETAIL]) {
    const lines = await generateDemo(engine, spec, join(root, spec.id));
    for (const line of lines) console.log(line);
    if (lines.some((l) => l.includes('out of range'))) process.exitCode = 1;
  }
} finally {
  await engine.close();
}
