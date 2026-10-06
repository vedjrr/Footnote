import type { ReactNode } from 'react';
import { formatDay, formatInteger } from '@/core/narrative/format';
import type { LoadedSample } from './sample-store';
import type { Sample } from './samples';

// The working paper with no mark selected: the data at a glance (§5).

export function dayRange(data: LoadedSample): string {
  const { firstDay, lastDay } = data.glance;
  return firstDay && lastDay ? `${formatDay(firstDay)} to ${formatDay(lastDay)}` : 'no days';
}

export function GlancePaper({
  sample,
  data,
  marks = true,
}: {
  sample: Sample;
  data: LoadedSample | null;
  /** Whether the page has marks to select. */
  marks?: boolean;
}) {
  const rows: [string, ReactNode][] = data
    ? [
        ['Rows', formatInteger(data.glance.rows)],
        ['Days covered', dayRange(data)],
        ['Columns', formatInteger(data.glance.columns)],
        ['Dated by', sample.timeColumn],
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
      <p className="text-ink-2">
        The period being reported and a summary of data health will be added here.
      </p>
      {marks && data && (
        <p className="text-ink-2">Select a numbered mark to see how that number was worked out.</p>
      )}
    </div>
  );
}
