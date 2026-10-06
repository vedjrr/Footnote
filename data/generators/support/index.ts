// The "Kettle Helpdesk" support sample: data/demo/support/tickets.parquet and truth.json.

import type { DemoSpec } from '../demo';
import { generateTickets } from './generate';
import * as P from './params';
import { SUMMARY_CHECKS, SUPPORT_EFFECTS, summarySql } from './truth';

export const SUPPORT: DemoSpec = {
  id: 'support',
  name: 'Kettle Helpdesk',
  seed: P.SEED,
  table: 'tickets',
  columns: [
    { name: 'ticket_id', sqlType: 'VARCHAR' },
    { name: 'created_at', sqlType: 'TIMESTAMP' },
    { name: 'resolved_at', sqlType: 'TIMESTAMP' },
    { name: 'team', sqlType: 'VARCHAR' },
    { name: 'priority', sqlType: 'VARCHAR' },
    { name: 'category', sqlType: 'VARCHAR' },
    { name: 'channel', sqlType: 'VARCHAR' },
    { name: 'first_response_minutes', sqlType: 'INTEGER' },
    { name: 'resolution_hours', sqlType: 'DECIMAL(8,2)' },
    { name: 'sla_breached', sqlType: 'BOOLEAN' },
    { name: 'csat', sqlType: 'TINYINT' },
    { name: 'reopened', sqlType: 'BOOLEAN' },
  ],
  rows: () => generateTickets(P.SEED) as unknown as Record<string, unknown>[],
  summarySql,
  summaryChecks: SUMMARY_CHECKS,
  effects: SUPPORT_EFFECTS,
};
