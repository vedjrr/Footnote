// Puts the sample Parquet files where the site serves them: data/demo/<id>/
// to public/demo/<id>/ (architecture §8, D-026). data/demo/ is the committed
// source; public/demo/ is rebuilt here before dev and build and never committed.

import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const source = join('data', 'demo');
const target = join('public', 'demo');

let copied = 0;
for (const entry of await readdir(source, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = join(target, entry.name);
  await mkdir(dir, { recursive: true });
  for (const file of await readdir(join(source, entry.name))) {
    if (!file.endsWith('.parquet')) continue;
    await copyFile(join(source, entry.name, file), join(dir, file));
    copied++;
  }
}
console.log(`copy-demo: ${copied} sample files in ${target}`);
