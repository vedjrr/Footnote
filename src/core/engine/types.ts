// The query engine port (architecture §4). Core sees only these shapes; each
// adapter normalises its engine's values into them at the boundary.

export type ColumnType = 'integer' | 'decimal' | 'boolean' | 'date' | 'timestamp' | 'text';

export interface ColumnInfo {
  name: string;
  type: ColumnType;
  nullable: boolean;
}

export type Cell = string | number | boolean | null; // dates as ISO strings

export interface QueryResult {
  columns: ColumnInfo[];
  rows: Cell[][];
  rowCount: number;
  elapsedMs: number;
}

export type FileFormat = 'csv' | 'parquet' | 'json';

// A file to load as a table. Bytes work in every adapter; a path only where
// the engine can read the file system (Node).
export type FileSource =
  | { kind: 'bytes'; name: string; format: FileFormat; bytes: Uint8Array }
  | { kind: 'path'; path: string; format: FileFormat };

export interface QueryEngine {
  registerFile(table: string, source: FileSource): Promise<ColumnInfo[]>;
  query(sql: string, params?: Cell[]): Promise<QueryResult>;
  describe(table: string): Promise<ColumnInfo[]>;
  engineVersion(): Promise<string>;
  close(): Promise<void>;
}
