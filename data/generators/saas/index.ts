// The "Slotwise" subscriptions sample: data/demo/saas/subscriptions.parquet and truth.json.

import type { DemoSpec } from '../demo';
import { generateSubscriptions } from './generate';
import * as P from './params';
import { SAAS_EFFECTS, SUMMARY_CHECKS, summarySql, SAAS_HEALTH } from './truth';

export const SAAS: DemoSpec = {
  id: 'saas',
  name: 'Slotwise',
  seed: P.SEED,
  table: 'subscriptions',
  columns: [
    { name: 'month', sqlType: 'DATE' },
    { name: 'account_id', sqlType: 'VARCHAR' },
    { name: 'plan', sqlType: 'VARCHAR' },
    { name: 'region', sqlType: 'VARCHAR' },
    { name: 'industry', sqlType: 'VARCHAR' },
    { name: 'signup_channel', sqlType: 'VARCHAR' },
    { name: 'seats', sqlType: 'INTEGER' },
    { name: 'mrr', sqlType: 'DECIMAL(12,2)' },
    { name: 'is_new', sqlType: 'BOOLEAN' },
    { name: 'is_churned', sqlType: 'BOOLEAN' },
  ],
  rows: () => generateSubscriptions(P.SEED) as unknown as Record<string, unknown>[],
  summarySql,
  summaryChecks: SUMMARY_CHECKS,
  health: SAAS_HEALTH,
  effects: SAAS_EFFECTS,
};
