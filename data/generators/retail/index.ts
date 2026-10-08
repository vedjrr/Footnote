// The "Harbour & Pine" retail sample: data/demo/retail/orders.parquet and truth.json.

import type { DemoSpec } from '../demo';
import { generateRetail } from './generate';
import * as P from './params';
import { RETAIL_EFFECTS, SUMMARY_CHECKS, summarySql, RETAIL_HEALTH } from './truth';

export const RETAIL: DemoSpec = {
  id: 'retail',
  name: 'Harbour & Pine',
  seed: P.SEED,
  table: 'orders',
  columns: [
    { name: 'order_id', sqlType: 'VARCHAR' },
    { name: 'order_date', sqlType: 'DATE' },
    { name: 'region', sqlType: 'VARCHAR' },
    { name: 'channel', sqlType: 'VARCHAR' },
    { name: 'category', sqlType: 'VARCHAR' },
    { name: 'sub_category', sqlType: 'VARCHAR' },
    { name: 'customer_id', sqlType: 'VARCHAR' },
    { name: 'customer_segment', sqlType: 'VARCHAR' },
    { name: 'quantity', sqlType: 'INTEGER' },
    { name: 'unit_price', sqlType: 'DECIMAL(10,2)' },
    { name: 'discount_pct', sqlType: 'INTEGER' },
    { name: 'revenue', sqlType: 'DECIMAL(12,2)' },
    { name: 'cost', sqlType: 'DECIMAL(12,2)' },
    { name: 'returned', sqlType: 'BOOLEAN' },
  ],
  rows: () => generateRetail(P.SEED) as unknown as Record<string, unknown>[],
  summarySql,
  summaryChecks: SUMMARY_CHECKS,
  health: RETAIL_HEALTH,
  effects: RETAIL_EFFECTS,
};
