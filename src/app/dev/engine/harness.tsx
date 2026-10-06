'use client';

import { useEffect, useState } from 'react';
import { createWasmEngine } from '@/adapters/duckdb-wasm';
import type { FileFormat, QueryEngine } from '@/core/engine/types';

declare global {
  interface Window {
    footnoteEngine?: QueryEngine;
  }
}

const FORMATS: Record<string, FileFormat> = { csv: 'csv', parquet: 'parquet', json: 'json' };

// One engine for the life of the page. Effects run twice in development, and
// starting a second worker while the first is torn down can stall it.
let pageEngine: QueryEngine | null = null;
const getEngine = () => (pageEngine ??= createWasmEngine());

export function EngineHarness() {
  const [status, setStatus] = useState('starting');
  const [loaded, setLoaded] = useState('');

  useEffect(() => {
    const engine = getEngine();
    engine.engineVersion().then(
      (v) => {
        window.footnoteEngine = engine;
        setStatus(`ready: ${v}`);
      },
      (err: unknown) => setStatus(`failed: ${String(err)}`),
    );
  }, []);

  async function onFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const format = FORMATS[ext];
    if (!format) return setLoaded(`error: cannot read ${file.name}`);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const columns = await getEngine().registerFile('upload', {
        kind: 'bytes',
        name: file.name,
        format,
        bytes,
      });
      const count = await getEngine().query('SELECT CAST(COUNT(*) AS BIGINT) AS n FROM upload');
      setLoaded(
        `loaded ${String(count.rows[0][0])} rows: ${columns.map((c) => `${c.name} ${c.type}`).join(', ')}`,
      );
    } catch (err) {
      setLoaded(`error: ${String(err)}`);
    }
  }

  return (
    <main>
      <h1>Engine harness</h1>
      <p data-testid="status">{status}</p>
      <input
        type="file"
        aria-label="Data file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
        }}
      />
      <p data-testid="loaded">{loaded}</p>
    </main>
  );
}
