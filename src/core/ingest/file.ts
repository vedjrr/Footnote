// Checks on a user's file that need no query engine: its type, its size, its
// text encoding, its delimiter and whether its first line is a header.
// Each failure is one of a fixed set, with a message written to
// ui-ux-rules §9: what happened, then what to do.

import type { FileFormat } from '@/core/engine/types';
import { formatInteger, formatMegabytes } from '@/core/narrative/format';

/** NFR-07, as measured in T10 (D-028). A megabyte is 1,000,000 bytes. */
export const LIMITS = {
  warnBytes: 100_000_000,
  refuseBytes: 300_000_000,
  warnRows: 2_000_000,
} as const;

export type FailureKind =
  | 'unsupported-type'
  | 'too-large'
  | 'empty'
  | 'no-rows'
  | 'no-header'
  | 'inconsistent-columns'
  | 'encoding'
  | 'unreadable';

export class IngestError extends Error {
  constructor(
    readonly kind: FailureKind,
    message: string,
  ) {
    super(message);
    this.name = 'IngestError';
  }
}

export interface FileKind {
  format: FileFormat;
  /** How the file is named to the reader: "CSV", "TSV", "Parquet", "JSON". */
  label: string;
  /** The delimiter the extension promises, if any. */
  delimiter?: string;
}

const KINDS: Record<string, FileKind> = {
  csv: { format: 'csv', label: 'CSV' },
  tsv: { format: 'csv', label: 'TSV', delimiter: '\t' },
  tab: { format: 'csv', label: 'TSV', delimiter: '\t' },
  parquet: { format: 'parquet', label: 'Parquet' },
  json: { format: 'json', label: 'JSON' },
  jsonl: { format: 'json', label: 'JSON' },
  ndjson: { format: 'json', label: 'JSON' },
};

/** The `accept` list for a file chooser. */
export const ACCEPT = Object.keys(KINDS)
  .map((ext) => `.${ext}`)
  .join(',');

function extension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** The kind of file `name` is, or an `unsupported-type` failure. */
export function fileKind(name: string): FileKind {
  const kind = KINDS[extension(name)];
  if (kind) return kind;
  const ext = extension(name);
  throw new IngestError(
    'unsupported-type',
    `${name} is ${ext ? `an .${ext} file, which` : 'not a CSV, TSV, Parquet or JSON file, so it'} cannot be read here. Save it as CSV, TSV, Parquet or JSON and try again.`,
  );
}

/** Refuses an empty file or one over the hard limit. */
export function checkSize(name: string, bytes: number): void {
  if (bytes === 0)
    throw new IngestError(
      'empty',
      `${name} is empty. Choose a file with a header row and at least one row of data.`,
    );
  if (bytes > LIMITS.refuseBytes)
    throw new IngestError(
      'too-large',
      `${name} is ${formatMegabytes(bytes)}, and files up to ${formatMegabytes(LIMITS.refuseBytes)} can be opened in the browser. Remove rows or columns you do not need, or save it as Parquet, which is smaller, and try again.`,
    );
}

/** A sentence to show when the file opened but is big enough to be slow. */
export function sizeWarning(bytes: number, rows: number): string | null {
  if (bytes <= LIMITS.warnBytes && rows <= LIMITS.warnRows) return null;
  const what = rows > LIMITS.warnRows ? `${formatInteger(rows)} rows` : `${formatMegabytes(bytes)}`;
  return `This file is large (${what}), so the briefing and answers will take longer than usual.`;
}

/** Bytes looked at for the encoding and delimiter checks. */
const HEAD_BYTES = 1_000_000;

/** The start of a text file as a string, or an `encoding` failure. */
export function readHead(name: string, bytes: Uint8Array): string {
  // A UTF-16 byte order mark: the file is readable, but not by the engine.
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))
    throw encodingError(name);
  try {
    // `stream` lets the cut fall inside a character without failing.
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, HEAD_BYTES), {
      stream: bytes.length > HEAD_BYTES,
    });
  } catch {
    throw encodingError(name);
  }
}

export const encodingError = (name: string) =>
  new IngestError(
    'encoding',
    `${name} is not saved as UTF-8 text, so its characters cannot be read. Save it again as UTF-8 (in Excel, choose "CSV UTF-8") and try again.`,
  );

const DELIMITERS = [',', ';', '\t', '|'];

/** Splits one line on `delimiter`, keeping quoted parts whole. */
function countFields(line: string, delimiter: string): number {
  let fields = 1;
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === delimiter && !quoted) fields++;
  }
  return fields;
}

function lines(text: string): string[] {
  return text.split(/\r?\n/);
}

/** The delimiter the header line uses most, or undefined for one column. */
export function detectDelimiter(head: string): string | undefined {
  const header = lines(head)[0] ?? '';
  let best: string | undefined;
  let most = 1;
  for (const d of DELIMITERS) {
    const n = countFields(header, d);
    if (n > most) [best, most] = [d, n];
  }
  return best;
}

/**
 * The first line, counted from 1 with the header as line 1, whose number of
 * values differs from the header's. Only complete lines in `head` are
 * checked, and a quoted value that spans lines is not followed.
 */
export function findRaggedLine(
  head: string,
  delimiter: string,
): { line: number; values: number; columns: number } | null {
  const all = lines(head);
  const complete = all.slice(0, -1);
  const columns = countFields(all[0] ?? '', delimiter);
  for (let i = 1; i < complete.length; i++) {
    if (complete[i] === '') continue;
    const values = countFields(complete[i], delimiter);
    if (values !== columns) return { line: i + 1, values, columns };
  }
  return null;
}

export function raggedError(
  name: string,
  ragged: { line: number; values?: number; columns?: number } | null,
): IngestError {
  const where = !ragged
    ? `Some rows of ${name} have a different number of values from the header.`
    : ragged.values === undefined || ragged.columns === undefined
      ? `Line ${formatInteger(ragged.line)} of ${name} has a different number of values from the header.`
      : `Line ${formatInteger(ragged.line)} of ${name} has ${formatInteger(ragged.values)} values, but the header names ${formatInteger(ragged.columns)} columns.`;
  return new IngestError(
    'inconsistent-columns',
    `${where} Make every row the same length as the header and try again.`,
  );
}

const VALUE_LIKE = [
  /^[-+]?\d+([.,]\d+)?$/, // a number
  /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?$/, // a date or time
  /^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}$/, // 03/04/2024
  /^(true|false)$/i,
];

/**
 * Whether the first line was data rather than column names. True only when
 * every name looks like a value, so a header such as "region,2023,2024" still
 * counts as a header. A first line of plain words cannot be told apart.
 */
export function looksHeaderless(columnNames: string[]): boolean {
  return (
    columnNames.length > 0 &&
    columnNames.every((n) => VALUE_LIKE.some((pattern) => pattern.test(n.trim())))
  );
}

export const noHeaderError = () =>
  new IngestError(
    'no-header',
    'This file has no header row. Add column names as the first line and try again.',
  );
