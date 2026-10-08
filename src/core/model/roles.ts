// Reading a column's role back out of a dictionary, so an inferred dictionary
// and a hand-written one can be compared column by column (analytics-spec
// §2.8). Identifier, free-text and other columns all end up hidden, so they
// compare as one role.

import type { SemanticModel } from './types';

export type ModelRole = 'time' | 'category' | 'entity' | 'measure' | 'hidden' | 'unused';

export function columnRole(model: SemanticModel, column: string): ModelRole {
  if (model.time?.column === column) return 'time';
  if (model.hidden.includes(column)) return 'hidden';
  const dim = model.dimensions.find((d) => d.column === column);
  if (dim) return dim.role;
  const measured = model.metrics.some(
    (m) => m.kind === 'simple' && m.column === column && m.agg !== 'count_distinct',
  );
  return measured ? 'measure' : 'unused';
}

export interface RoleDisagreement {
  column: string;
  inferred: ModelRole;
  written: ModelRole;
}

export interface RoleComparison {
  columns: number;
  agreeing: number;
  /** agreeing / columns; 1 for a table with no columns. */
  share: number;
  disagreements: RoleDisagreement[];
}

export function compareRoles(
  inferred: SemanticModel,
  written: SemanticModel,
  columns: string[],
): RoleComparison {
  const disagreements: RoleDisagreement[] = [];
  for (const column of columns) {
    const a = columnRole(inferred, column);
    const b = columnRole(written, column);
    if (a !== b) disagreements.push({ column, inferred: a, written: b });
  }
  const agreeing = columns.length - disagreements.length;
  return {
    columns: columns.length,
    agreeing,
    share: columns.length === 0 ? 1 : agreeing / columns.length,
    disagreements,
  };
}
