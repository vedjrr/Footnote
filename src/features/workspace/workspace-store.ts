'use client';

// The page's one engine (D-022) and the workspaces loaded into it: the
// samples, each loaded once, and the user's own files (FR-02), held in
// memory until the page is closed (T62 makes them persist).

import { useEffect, useSyncExternalStore } from 'react';
import { createWasmEngine } from '@/adapters/duckdb-wasm';
import { describeSql } from '@/core/engine/normalise';
import type { ColumnInfo, QueryEngine } from '@/core/engine/types';
import { checkSize, fileKind, sizeWarning } from '@/core/ingest/file';
import { ingestFile } from '@/core/ingest/ingest';
import { type HealthReport, checkHealth } from '@/core/health/health';
import { inferDictionary } from '@/core/model/infer';
import type { SemanticModel } from '@/core/model/types';
import { parseModelYaml } from '@/core/model/yaml';
import { formatMegabytes } from '@/core/narrative/format';
import { glanceSql, readGlance, type Glance } from '@/core/profile/glance';
import { type Profile, profileTable } from '@/core/profile/profile';
import { fileId } from './file-id';
import { SAMPLES, dictionaryUrl, findSample, sampleUrl, type Sample } from './samples';

/** A sample or one of the user's files: what the views need to name it. */
export interface Workspace {
  id: string;
  name: string;
  /** What one row is, plural, for sentences: "59,881 orders". */
  rowNoun: string;
  table: string;
  /** Until the dictionary exists (T12), the column that dates each row. */
  timeColumn: string | null;
  /** Present for the user's own files. */
  file?: { name: string; bytes: number; warning: string | null };
}

export interface LoadedSample {
  columns: ColumnInfo[];
  glance: Glance;
  /** The statements that ran, shown as they ran. */
  glanceSql: string;
  describeSql: string;
  /** The dictionary in use, with the user's edits (FR-13). */
  model: SemanticModel;
  /** The dictionary as first loaded, to bring hidden columns back. */
  original: SemanticModel;
}

export type SampleState =
  | { status: 'loading'; step: string }
  | { status: 'ready'; data: LoadedSample }
  | { status: 'error'; message: string }
  /** A file workspace that is not open in this page, such as after a reload. */
  | { status: 'missing' };

let pageEngine: QueryEngine | null = null;
const getEngine = () => (pageEngine ??= createWasmEngine());

const STARTING: SampleState = { status: 'loading', step: 'Starting the query engine' };
const MISSING: SampleState = { status: 'missing' };
const states = new Map<string, SampleState>();
let files: Workspace[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function set(id: string, state: SampleState) {
  states.set(id, state);
  notify();
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
  const model = await sampleDictionary(sample);
  return glance(engine, sample, columns, model);
}

async function sampleDictionary(sample: Sample): Promise<SemanticModel> {
  const response = await fetch(dictionaryUrl(sample));
  if (!response.ok) throw new Error(`The server answered ${response.status} for the dictionary`);
  const parsed = parseModelYaml(await response.text());
  if (!parsed.ok) {
    const first = parsed.problems[0];
    throw new Error(
      `The sample's dictionary has a problem on line ${first.line}: ${first.message}`,
    );
  }
  return parsed.model;
}

async function glance(
  engine: QueryEngine,
  workspace: Workspace,
  columns: ColumnInfo[],
  model: SemanticModel,
): Promise<LoadedSample> {
  const sql = glanceSql(workspace.table, workspace.timeColumn);
  return {
    columns,
    glance: readGlance(await engine.query(sql), columns),
    glanceSql: sql,
    describeSql: describeSql(workspace.table),
    model,
    original: model,
  };
}

/**
 * Replaces the dictionary in use for a loaded workspace. The model must
 * already be checked (core/model/edit.ts does that); edits last until the
 * page is closed.
 */
export function setModel(id: string, model: SemanticModel): void {
  const state = states.get(id);
  if (state?.status !== 'ready') return;
  // Health names affected metrics and treats dictionary columns differently,
  // so it is checked again against the new dictionary.
  healthStates.delete(id);
  set(id, { status: 'ready', data: { ...state.data, model } });
}

export type HealthState =
  | { status: 'checking' }
  | { status: 'ready'; report: HealthReport; profile: Profile }
  | { status: 'error'; message: string };

const CHECKING: HealthState = { status: 'checking' };
const healthStates = new Map<string, HealthState>();

/** Today as an ISO date: no row should be dated after it (H9). */
const today = () => new Date().toISOString().slice(0, 10);

function ensureHealth(id: string): void {
  const state = states.get(id);
  if (state?.status !== 'ready' || healthStates.has(id)) return;
  healthStates.set(id, CHECKING);
  const workspace = findWorkspace(id);
  if (!workspace) return;
  const model = state.data.model;
  void (async () => {
    const engine = getEngine();
    const profile = await profileTable(engine, workspace.table);
    const report = await checkHealth(engine, profile, model, { latestPlausible: today() });
    return { profile, report };
  })().then(
    ({ profile, report }) => {
      // An edit made while checking starts a new check; drop this one.
      const now = states.get(id);
      if (now?.status !== 'ready' || now.data.model !== model) return;
      healthStates.set(id, { status: 'ready', report, profile });
      notify();
    },
    (error: unknown) => {
      healthStates.set(id, {
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
      notify();
    },
  );
}

/** The data health of a loaded workspace, checked once the data is ready. */
export function useHealth(id: string): HealthState | null {
  const { state } = useWorkspace(id);
  const ready = state.status === 'ready';
  const model = ready ? state.data.model : null;
  useEffect(() => {
    if (ready) ensureHealth(id);
  }, [id, ready, model]);
  const health = useSyncExternalStore(
    subscribe,
    () => healthStates.get(id) ?? null,
    () => null,
  );
  if (!ready) return null;
  return health ?? CHECKING;
}

let opened = 0;

/** A table name from the file name, unique in the page's engine. */
function tableFor(fileName: string): string {
  const stem = fileName
    .replace(/\.[^.]*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  const base = /^[a-z_]/.test(stem) ? stem : `file_${stem}`;
  const taken = new Set([...SAMPLES.map((s) => s.table), ...files.map((f) => f.table)]);
  let table = base || 'file';
  for (let n = 2; taken.has(table); n++) table = `${base}_${n}`;
  return table;
}

/**
 * Reads `file` into the engine as a new workspace. `onStep` gets the step in
 * words for the progress line. Throws an `IngestError` with the message to
 * show when the file cannot be used.
 */
export async function openFile(file: File, onStep: (step: string) => void): Promise<Workspace> {
  // Refuse the wrong type or size before reading anything into memory.
  fileKind(file.name);
  checkSize(file.name, file.size);
  const engine = getEngine();
  onStep(`Opening ${file.name} (${formatMegabytes(file.size)})`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  onStep('Starting the query engine');
  await engine.engineVersion();

  const table = tableFor(file.name);
  const ingested = await ingestFile(engine, { name: file.name, bytes }, table, (step) =>
    onStep(step === 'reading' ? `Reading the rows of ${file.name}` : 'Counting the rows'),
  );
  const timeColumn =
    ingested.columns.find((c) => c.type === 'date' || c.type === 'timestamp')?.name ?? null;
  const workspace: Workspace = {
    id: fileId(++opened),
    name: file.name,
    rowNoun: 'rows',
    table,
    timeColumn,
    file: { name: file.name, bytes: file.size, warning: sizeWarning(file.size, ingested.rows) },
  };
  onStep('Working out what each column holds');
  const model = await inferDictionary(engine, await profileTable(engine, table));
  if (timeColumn) onStep(`Finding the first and last ${timeColumn}`);
  const data = await glance(engine, workspace, ingested.columns, model);
  files = [...files, workspace];
  set(workspace.id, { status: 'ready', data });
  return workspace;
}

const noFiles: Workspace[] = [];

/** The user's files open in this page, oldest first. */
export function useFiles(): Workspace[] {
  return useSyncExternalStore(
    subscribe,
    () => files,
    () => noFiles,
  );
}

/** A sample or open file by id, or null. */
export function findWorkspace(id: string): Workspace | null {
  return findSample(id) ?? files.find((f) => f.id === id) ?? null;
}

/** The workspace `id` names and its state, loading a sample after first paint if needed. */
export function useWorkspace(id: string): { workspace: Workspace | null; state: SampleState } {
  const sample = findSample(id);
  useEffect(() => {
    if (sample) ensureSample(sample);
  }, [sample]);
  const state = useSyncExternalStore(
    subscribe,
    () => states.get(id) ?? (sample ? STARTING : MISSING),
    () => (sample ? STARTING : MISSING),
  );
  const workspace = useSyncExternalStore(
    subscribe,
    () => findWorkspace(id),
    () => sample ?? null,
  );
  return { workspace, state };
}
