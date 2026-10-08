'use client';

// Loads each sample into the page's one engine (D-022), once, and keeps
// what the shell and views need: the progress step, then the glance.

import { useEffect, useSyncExternalStore } from 'react';
import { createWasmEngine } from '@/adapters/duckdb-wasm';
import { describeSql } from '@/core/engine/normalise';
import type { ColumnInfo, QueryEngine } from '@/core/engine/types';
import { glanceSql, readGlance, type Glance } from '@/core/profile/glance';
import { sampleUrl, type Sample } from './samples';

export interface LoadedSample {
  columns: ColumnInfo[];
  glance: Glance;
  /** The statements that ran, shown as they ran. */
  glanceSql: string;
  describeSql: string;
}

export type SampleState =
  | { status: 'loading'; step: string }
  | { status: 'ready'; data: LoadedSample }
  | { status: 'error'; message: string };

let pageEngine: QueryEngine | null = null;
const getEngine = () => (pageEngine ??= createWasmEngine());

const STARTING: SampleState = { status: 'loading', step: 'Starting the query engine' };
const states = new Map<string, SampleState>();
const listeners = new Set<() => void>();

function set(id: string, state: SampleState) {
  states.set(id, state);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Starts loading `sample` unless it is loaded or loading already. */
export function ensureSample(sample: Sample): void {
  const current = states.get(sample.id);
  if (current && current.status !== 'error') return;
  set(sample.id, STARTING);
  void load(sample).then(
    (data) => set(sample.id, { status: 'ready', data }),
    (error: unknown) =>
      set(sample.id, {
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      }),
  );
}

async function load(sample: Sample): Promise<LoadedSample> {
  const engine = getEngine();
  await engine.engineVersion();

  set(sample.id, { status: 'loading', step: `Downloading the ${sample.name} sample` });
  const response = await fetch(sampleUrl(sample));
  if (!response.ok) throw new Error(`The server answered ${response.status} for the data file`);
  const bytes = new Uint8Array(await response.arrayBuffer());

  set(sample.id, { status: 'loading', step: `Reading the ${sample.rowNoun}` });
  const columns = await engine.registerFile(sample.table, {
    kind: 'bytes',
    name: `${sample.table}.parquet`,
    format: 'parquet',
    bytes,
  });

  set(sample.id, { status: 'loading', step: `Counting the ${sample.rowNoun}` });
  const sql = glanceSql(sample.table, sample.timeColumn);
  const glance = readGlance(await engine.query(sql), columns);
  return { columns, glance, glanceSql: sql, describeSql: describeSql(sample.table) };
}

/** The state of `sample`, loading it after first paint if needed. */
export function useSample(sample: Sample): SampleState {
  useEffect(() => ensureSample(sample), [sample]);
  return useSyncExternalStore(
    subscribe,
    () => states.get(sample.id) ?? STARTING,
    () => STARTING,
  );
}
