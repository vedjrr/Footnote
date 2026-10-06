import { describe, expect, it } from 'vitest';
import { demoSuite } from '../demo-suite';
import { queryNumbers } from '../truth';
import { SAAS } from './index';

describe('subscriptions sample', () => {
  const { engine } = demoSuite(SAAS, ['S1', 'S6']);

  it('is a true snapshot: one row per account per month while it is active', async () => {
    const q = queryNumbers(engine());
    const [r] = await q(`
      WITH a AS (
        SELECT account_id, count(*) AS n, min(month) AS first, max(month) AS last,
          datediff('month', min(month), max(month)) + 1 AS span,
          count(*) FILTER (WHERE is_churned) AS churn_rows,
          bool_or(is_churned AND month = max_month) AS churned_last,
          count(*) FILTER (WHERE is_new) AS new_rows,
          bool_or(is_new AND month = min_month) AS new_first
        FROM (SELECT *, max(month) OVER w AS max_month, min(month) OVER w AS min_month
              FROM subscriptions WINDOW w AS (PARTITION BY account_id))
        GROUP BY account_id)
      SELECT
        count(*) FILTER (WHERE n <> span) AS gaps,
        count(*) FILTER (WHERE churn_rows > 1 OR (churn_rows = 1 AND NOT churned_last)) AS bad_churn,
        count(*) FILTER (WHERE last < DATE '2024-12-01' AND churn_rows = 0) AS vanished,
        count(*) FILTER (WHERE new_rows > 1 OR (new_rows = 1 AND NOT new_first)) AS bad_new,
        count(*) FILTER (WHERE first > DATE '2023-01-01' AND new_rows = 0) AS unmarked_new
      FROM a`);
    expect(r).toEqual({ gaps: 0, bad_churn: 0, vanished: 0, bad_new: 0, unmarked_new: 0 });
  });
});
