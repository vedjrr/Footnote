'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatDay, formatInteger } from '@/core/narrative/format';
import { viewHref } from '@/features/shell/routes';
import { useHealth, type HealthState, type LoadedSample, type Workspace } from './workspace-store';

// The working paper with no mark selected: the data at a glance (§5).

export function dayRange(data: LoadedSample): string {
  const { firstDay, lastDay } = data.glance;
  return firstDay && lastDay ? `${formatDay(firstDay)} to ${formatDay(lastDay)}` : 'no days';
}

export function GlancePaper({
  workspace,
  data,
  marks = true,
}: {
  workspace: Workspace;
  data: LoadedSample | null;
  /** Whether the page has marks to select. */
  marks?: boolean;
}) {
  const health = useHealth(workspace.id);
  const rows: [string, ReactNode][] = data
    ? [
        ['Rows', formatInteger(data.glance.rows)],
        ['Days covered', dayRange(data)],
        ['Columns', formatInteger(data.glance.columns)],
        ['Dated by', data.model.time?.column ?? 'No date column'],
        ['Data health', <HealthSummary key="health" workspace={workspace} health={health} />],
      ]
    : [];
  return (
    <div className="flex flex-col gap-4 type-small">
      <h2 className="type-body font-medium text-ink">The data at a glance</h2>
      {data ? (
        <dl className="flex flex-col">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between gap-4 border-b border-ledger-rule py-2 last:border-0"
            >
              <dt className="text-ink-2">{label}</dt>
              <dd className="text-right text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-ink-2">Waiting for the data to load.</p>
      )}
      <p className="text-ink-2">The period being reported will be added here.</p>
      {marks && data && (
        <p className="text-ink-2">Select a numbered mark to see how that number was worked out.</p>
      )}
    </div>
  );
}

function HealthSummary({
  workspace,
  health,
}: {
  workspace: Workspace;
  health: HealthState | null;
}) {
  if (!health || health.status === 'checking') return <>Checking</>;
  if (health.status === 'error') return <>Not checked</>;
  const problems = health.report.problems;
  const serious = problems.filter((p) => p.severity === 'serious').length;
  const minor = problems.filter((p) => p.severity === 'minor').length;
  const parts = [...(serious ? [`${serious} serious`] : []), ...(minor ? [`${minor} minor`] : [])];
  return (
    <Link
      href={viewHref(workspace.id, 'health')}
      className="text-mark underline-offset-3 hover:underline"
    >
      {parts.length
        ? `${parts.join(', ')} ${serious + minor === 1 ? 'problem' : 'problems'}`
        : 'Nothing to fix'}
    </Link>
  );
}
