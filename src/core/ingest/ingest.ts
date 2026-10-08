// Loads a user's file into the query engine as a table (FR-02). The checks
// that need no engine run first; the engine's own errors are then turned
// into the same fixed set of failures, so every failure has a message.

import type { ColumnInfo, QueryEngine } from '@/core/engine/types';
import {
  IngestError,
  checkSize,
  countFields,
  detectDelimiter,
  encodingError,
  fileKind,
  findRaggedLine,
  looksHeaderless,
  noHeaderError,
  raggedError,
  readHead,
  type FileKind,
} from './file';

export interface IngestedFile {
  kind: FileKind;
  columns: ColumnInfo[];
  rows: number;
  /** The statement that counted the rows, shown as it ran. */
  countSql: string;
}

/** Steps worth naming in the progress line (ui-ux-rules §6). */
export type IngestStep = 'reading' | 'counting';

export async function ingestFile(
  engine: QueryEngine,
  file: { name: string; bytes: Uint8Array },
  table: string,
  onStep: (step: IngestStep) => void = () => {},
): Promise<IngestedFile> {
  const { name, bytes } = file;
  const kind = fileKind(name);
  checkSize(name, bytes.length);

  let head = '';
  let delimiter: string | undefined;
  if (kind.format !== 'parquet') head = readHead(name, bytes);
  if (kind.format === 'csv') delimiter = kind.delimiter ?? detectDelimiter(head);

  onStep('reading');
  let columns: ColumnInfo[];
  try {
    columns = await engine.registerFile(table, {
      kind: 'bytes',
      name,
      format: kind.format,
      bytes,
      delimiter,
    });
  } catch (error) {
    throw explain(error, name, kind, head, delimiter);
  }

  try {
    if (kind.format === 'csv') {
      // Some engine versions guess past rows of the wrong length instead of
      // refusing them. The header must give exactly the columns that loaded.
      if (delimiter && countFields(head.split(/\r?\n/)[0], delimiter) !== columns.length)
        throw raggedError(name, findRaggedLine(head, delimiter));
      if (looksHeaderless(columns.map((c) => c.name))) throw noHeaderError();
    }

    onStep('counting');
    const countSql = `SELECT CAST(COUNT(*) AS BIGINT) AS row_count FROM "${table}"`;
    const rows = Number((await engine.query(countSql)).rows[0]?.[0] ?? 0);
    if (rows === 0)
      throw new IngestError(
        'no-rows',
        `${name} has column names but no rows. Add rows of data below the header and try again.`,
      );
    return { kind, columns, rows, countSql };
  } catch (error) {
    await engine.query(`DROP TABLE IF EXISTS "${table}"`);
    throw error;
  }
}

/** The engine's error as one of the failures the interface can explain. */
function explain(
  error: unknown,
  name: string,
  kind: FileKind,
  head: string,
  delimiter: string | undefined,
): IngestError {
  if (error instanceof IngestError) return error;
  const message = error instanceof Error ? error.message : String(error);

  if (/invalid unicode|not utf-8 encoded/i.test(message)) return encodingError(name);

  if (kind.format === 'csv') {
    // With the delimiter fixed, the engine refuses rows of the wrong length
    // either while sniffing the dialect or, further in, while reading.
    if (delimiter && /detect the CSV parsing dialect|Expected Number of Columns/i.test(message)) {
      const ragged = findRaggedLine(head, delimiter);
      const line = /Line: (\d+)/.exec(message);
      return raggedError(name, ragged ?? (line ? { line: Number(line[1]) } : null));
    }
  }

  return new IngestError(
    'unreadable',
    `${name} could not be read as a ${kind.label} file. Check that it opens in another program, save it again as ${kind.label}, and try again.`,
  );
}
