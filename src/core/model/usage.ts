// Which metrics a column feeds, directly or through ratios and differences.
// Health problems name the metrics they affect (analytics-spec §3).

import { type SemanticModel, metricRefs } from './types';

export function metricsUsing(model: SemanticModel, columns: readonly string[]): string[] {
  const dimensionColumns = new Map(model.dimensions.map((d) => [d.id, d.column]));
  const touched = new Set<string>();
  for (const m of model.metrics) {
    if (m.kind !== 'simple') continue;
    const direct = m.column !== null && columns.includes(m.column);
    const filtered = m.where?.some((f) =>
      columns.includes(dimensionColumns.get(f.dimension) ?? ''),
    );
    if (direct || filtered) touched.add(m.id);
  }
  // Ratios and differences built on a touched metric are touched too.
  let grew = true;
  while (grew) {
    grew = false;
    for (const m of model.metrics) {
      if (!touched.has(m.id) && metricRefs(m).some(([, ref]) => touched.has(ref))) {
        touched.add(m.id);
        grew = true;
      }
    }
  }
  return model.metrics.filter((m) => touched.has(m.id)).map((m) => m.id);
}
