import { describe, expect, it } from 'vitest';
import { demoSuite } from '../demo-suite';
import { queryNumbers } from '../truth';
import { SUPPORT } from './index';
import * as P from './params';

describe('support sample', () => {
  const { engine } = demoSuite(SUPPORT, ['T1', 'T4', 'T5']);

  it('keeps columns consistent with each other outside the planted problems', async () => {
    const q = queryNumbers(engine());
    const target = `CASE priority ${P.PRIORITIES.map((p, i) => `WHEN '${p}' THEN ${P.SLA_MINUTES[i]}`).join(' ')} END`;
    const [r] = await q(`
      SELECT
        count(*) FILTER (WHERE sla_breached <> (first_response_minutes > ${target})) AS breach_mismatch,
        count(*) FILTER (WHERE (resolved_at IS NULL) <> (resolution_hours IS NULL)) AS resolution_mismatch,
        count(*) FILTER (WHERE abs(epoch(resolved_at - created_at) / 3600 - resolution_hours) > 0.01) AS hours_mismatch,
        count(*) FILTER (WHERE csat NOT BETWEEN 1 AND 5) AS csat_out_of_range,
        count(*) FILTER (WHERE resolved_at IS NULL AND csat IS NOT NULL) AS open_rated
      FROM tickets`);
    expect(r).toEqual({
      breach_mismatch: 0,
      resolution_mismatch: 0,
      hours_mismatch: 0,
      csat_out_of_range: 0,
      open_rated: 0,
    });
  });
});
