'use client';

import type { ReactNode } from 'react';
import { Highlight, Mark, Notes, useNotes } from '@/ui/mark';
import { Status } from '@/ui/notice';

// A specimen of the briefing's one designed moment: select a mark and the
// number and its evidence light up together. Figures are a specimen only.

const PAPER_ID = 'styleguide-working-paper';

function Row({ label, value, note }: { label: string; value: string; note?: number }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td className="num">{note ? <Highlight note={note}>{value}</Highlight> : value}</td>
    </tr>
  );
}

function ResultTable({ children }: { children: ReactNode }) {
  return (
    <div className="fn-table-wrap fn-table-ledger">
      <table className="fn-table">
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col" className="num">
              Revenue
            </th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const notes: Record<number, { title: string; body: ReactNode }> = {
  1: {
    title: 'Revenue, March 2025 against February',
    body: (
      <ResultTable>
        <Row label="Feb 2025" value="1,307,412" />
        <Row label="Mar 2025" value="1,210,655" note={2} />
        <Row label="Change" value="−7.4%" note={1} />
      </ResultTable>
    ),
  },
  2: {
    title: 'Revenue, March 2025',
    body: (
      <ResultTable>
        <Row label="Feb 2025" value="1,307,412" />
        <Row label="Mar 2025" value="1,210,655" note={2} />
        <Row label="Change" value="−7.4%" note={1} />
      </ResultTable>
    ),
  },
  3: {
    title: 'Where the fall came from',
    body: (
      <div className="fn-table-wrap fn-table-ledger">
        <table className="fn-table">
          <thead>
            <tr>
              <th scope="col">Segment</th>
              <th scope="col" className="num">
                Change
              </th>
              <th scope="col" className="num">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Electronics, online, West</th>
              <td className="num">−72,568</td>
              <td className="num">
                <Highlight note={3}>75%</Highlight>
              </td>
            </tr>
            <tr>
              <th scope="row">Everything else</th>
              <td className="num">−24,189</td>
              <td className="num">25%</td>
            </tr>
          </tbody>
        </table>
      </div>
    ),
  },
  4: {
    title: 'Exact duplicate rows',
    body: (
      <div className="flex flex-col gap-3">
        <p className="type-small text-ink">
          <Highlight note={4}>1.2%</Highlight> of rows, 578 of 48,210, repeat another row in every
          column.
        </p>
        <Status tone="caution">Duplicates are counted in the totals above.</Status>
      </div>
    ),
  },
};

function WorkingPaper() {
  const { selected } = useNotes();
  const note = selected ? notes[selected] : null;
  return (
    <aside
      id={PAPER_ID}
      aria-label="Working paper"
      aria-live="polite"
      className="flex flex-col gap-4 border-t border-ledger-rule bg-ledger p-6 lg:border-t-0 lg:border-l"
    >
      {note ? (
        <div key={selected} className="fn-fade flex flex-col gap-4">
          <h3 className="flex gap-3 type-small font-medium text-ink">
            <span className="text-mark">{selected}</span>
            <span>{note.title}</span>
          </h3>
          {note.body}
          <Status tone="good">Parts add up to the total.</Status>
        </div>
      ) : (
        <div className="flex flex-col gap-2 type-small text-ink-2">
          <p className="font-medium text-ink">The data at a glance</p>
          <p>48,210 rows from 1 January 2024 to 31 March 2025.</p>
          <p>Select a numbered mark to see how that number was worked out.</p>
        </div>
      )}
    </aside>
  );
}

export function MarkDemo() {
  return (
    <Notes paperId={PAPER_ID}>
      <div className="grid grid-cols-1 border border-rule lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="flex flex-col gap-4 p-6">
          <p className="type-lead text-ink">
            Revenue fell{' '}
            <Mark note={1} description="how 7.4% was computed">
              7.4%
            </Mark>{' '}
            in March, from 1.31M to{' '}
            <Mark note={2} description="where 1.21M comes from">
              1.21M
            </Mark>
            .{' '}
            <Mark note={3} description="how three quarters was computed">
              Three quarters
            </Mark>{' '}
            of the fall came from Electronics sold online in the West.
          </p>
          <p className="type-prose text-ink-2">
            <Mark
              note={4}
              description="how 1.2% was counted"
              caution="duplicates are counted in the totals"
            >
              1.2%
            </Mark>{' '}
            of rows are exact duplicates.
          </p>
        </div>
        <WorkingPaper />
      </div>
    </Notes>
  );
}

/** Static states for the reference: rest, hover or focus, selected. */
export function MarkStates() {
  return (
    <Notes paperId={PAPER_ID} selected={3}>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <dt className="type-caption text-ink-3">Rest</dt>
          <dd className="type-prose text-ink">
            <Mark note={1} description="specimen at rest">
              7.4%
            </Mark>
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="type-caption text-ink-3">Hover or focus</dt>
          <dd className="type-prose text-ink">
            <span className="fn-mark">
              <span className="fn-number underline decoration-mark decoration-1 underline-offset-4">
                7.4%
              </span>
              <sup className="fn-ref">2</sup>
            </span>
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="type-caption text-ink-3">Selected</dt>
          <dd className="type-prose text-ink">
            <Mark note={3} description="specimen selected">
              7.4%
            </Mark>
          </dd>
        </div>
      </dl>
    </Notes>
  );
}
