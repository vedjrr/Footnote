'use client';

import { useState } from 'react';
import type { ColumnType } from '@/core/engine/types';
import { formatDay, formatInteger } from '@/core/narrative/format';
import { useSample, type LoadedSample } from '@/features/workspace/sample-store';
import { findSample, type Sample } from '@/features/workspace/samples';
import { GlancePaper } from '@/features/workspace/glance-paper';
import { WorkspacePage } from '@/features/workspace/workspace-page';
import { Button } from '@/ui/button';
import { CopyButton } from '@/ui/copy-button';
import { Disclosure } from '@/ui/disclosure';
import { Highlight, Mark } from '@/ui/mark';
import { Status } from '@/ui/notice';
import { Rule } from '@/ui/rule';

// Until the briefing exists (T45), a sample's briefing route states what the
// data holds, read from the data by a query, with a working paper per number.

const TYPE_WORDS: Record<ColumnType, string> = {
  integer: 'Whole number',
  decimal: 'Decimal',
  boolean: 'True or false',
  date: 'Date',
  timestamp: 'Date and time',
  text: 'Text',
};

const TITLES: Record<number, string> = {
  1: 'Rows in the file',
  2: 'First day in the data',
  3: 'Last day in the data',
  4: 'Columns in the file',
};

export function SampleFacts({ sampleId }: { sampleId: string }) {
  const sample = findSample(sampleId)!;
  const state = useSample(sample);
  const data = state.status === 'ready' ? state.data : null;

  return (
    <WorkspacePage
      glance={<GlancePaper sample={sample} data={data} />}
      noteTitle={(n) => TITLES[n]}
      paper={(n) => (data ? <Paper note={n} sample={sample} data={data} /> : null)}
    >
      <article className="flex flex-col gap-4">
        <h1 className="type-h2 text-ink">{sample.name}</h1>
        {state.status === 'loading' && (
          <p role="status" data-loading className="type-small text-ink-2">
            {state.step}
          </p>
        )}
        {state.status === 'error' && (
          <div className="flex flex-col items-start gap-4">
            <Status tone="critical">
              The {sample.name} sample did not load. {state.message}. Reload to try again, or choose
              another sample from the menu at the top.
            </Status>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </div>
        )}
        {data && <Facts sample={sample} data={data} />}
      </article>
      <section className="mt-12 flex flex-col gap-4" aria-labelledby="briefing-next">
        <Rule kind="section" />
        <h2 id="briefing-next" className="type-h2 text-ink">
          The briefing
        </h2>
        <p className="type-prose text-ink-2">
          This is where the briefing will go: what changed in the latest period, where the change
          came from, and what to check before you rely on it.
        </p>
      </section>
    </WorkspacePage>
  );
}

function Facts({ sample, data }: { sample: Sample; data: LoadedSample }) {
  const { rows, columns, firstDay, lastDay } = data.glance;
  if (rows === 0)
    return (
      <p className="type-prose text-ink">
        This sample has no rows, so there is nothing to brief on yet.
      </p>
    );
  return (
    <p className="type-prose text-ink" data-testid="sample-facts">
      {sample.name} is a made-up business and this is synthetic sample data. It holds{' '}
      <Mark note={1} description={`how ${formatInteger(rows)} rows were counted`}>
        <span data-testid="row-count">{formatInteger(rows)}</span>
      </Mark>{' '}
      {sample.rowNoun} dated{' '}
      <Mark note={2} description="where the first day comes from">
        {firstDay ? formatDay(firstDay) : 'no day'}
      </Mark>{' '}
      to{' '}
      <Mark note={3} description="where the last day comes from">
        {lastDay ? formatDay(lastDay) : 'no day'}
      </Mark>
      , in{' '}
      <Mark note={4} description="which columns were found">
        {formatInteger(columns)}
      </Mark>{' '}
      columns.
    </p>
  );
}

function Paper({ note, sample, data }: { note: number; sample: Sample; data: LoadedSample }) {
  const isColumns = note === 4;
  const sql = isColumns ? data.describeSql : data.glanceSql;
  return (
    <>
      <div className="flex flex-col gap-2 type-small text-ink-2">
        <p>
          {note === 1 && 'Every row in the file is counted, duplicates included.'}
          {note === 2 && `The earliest ${sample.timeColumn} in the file, read as a calendar day.`}
          {note === 3 && `The latest ${sample.timeColumn} in the file, read as a calendar day.`}
          {isColumns && 'Every column the query engine found, with the type it read.'}
        </p>
        <p>All rows of the {sample.table} table. No filters.</p>
      </div>
      {isColumns ? <ColumnTable data={data} /> : <GlanceTable data={data} />}
      <div className="flex flex-col border-y border-ledger-rule">
        <Disclosure summary="SQL" className="py-1">
          <pre className="type-code break-words whitespace-pre-wrap text-ink">{sql}</pre>
        </Disclosure>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <CopyButton text={sql} />
      </div>
    </>
  );
}

function GlanceTable({ data }: { data: LoadedSample }) {
  const { rows, firstDay, lastDay } = data.glance;
  return (
    <div className="fn-table-wrap fn-table-ledger">
      <table className="fn-table">
        <thead>
          <tr>
            <th scope="col">Result</th>
            <th scope="col" className="num">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Rows</th>
            <td className="num">
              <Highlight note={1}>{formatInteger(rows)}</Highlight>
            </td>
          </tr>
          <tr>
            <th scope="row">First day</th>
            <td className="num">
              <Highlight note={2}>{firstDay ? formatDay(firstDay) : 'none'}</Highlight>
            </td>
          </tr>
          <tr>
            <th scope="row">Last day</th>
            <td className="num">
              <Highlight note={3}>{lastDay ? formatDay(lastDay) : 'none'}</Highlight>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const SHOWN = 8;

function ColumnTable({ data }: { data: LoadedSample }) {
  const [all, setAll] = useState(false);
  const shown = all ? data.columns : data.columns.slice(0, SHOWN);
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="type-small text-ink">
        <Highlight note={4}>{formatInteger(data.columns.length)}</Highlight> columns
      </p>
      <div className="fn-table-wrap fn-table-ledger">
        <table className="fn-table">
          <thead>
            <tr>
              <th scope="col">Column</th>
              <th scope="col">Type</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.name}>
                <th scope="row">{c.name}</th>
                <td>{TYPE_WORDS[c.type]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.columns.length > SHOWN && (
        <Button variant="quiet" onClick={() => setAll(!all)}>
          {all ? `Show the first ${SHOWN}` : `Show all ${data.columns.length}`}
        </Button>
      )}
    </div>
  );
}
