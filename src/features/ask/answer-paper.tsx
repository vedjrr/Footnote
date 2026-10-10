'use client';

// The working paper for one number of an answer (FR-41, ui-ux-rules §6):
// definition, scope, the result with the number's cell highlighted, the
// checks, the rows behind it, the SQL and the actions, in that order.

import { useEffect, useRef, useState } from 'react';
import { type Answer, rowsBehind } from '@/core/ask/answer';
import type { CellRef } from '@/core/narrative/answer-sentence';
import type { QueryResult } from '@/core/engine/types';
import { describeMetric } from '@/core/model/describe';
import type { SemanticModel } from '@/core/model/types';
import { formatInteger, formatNumber } from '@/core/narrative/format';
import type { ResultCheck } from '@/core/query/checks';
import { workspaceEngine } from '@/features/workspace/workspace-store';
import { Button } from '@/ui/button';
import { CopyButton } from '@/ui/copy-button';
import { cx } from '@/ui/cx';
import { Disclosure } from '@/ui/disclosure';
import { Highlight } from '@/ui/mark';
import { Status } from '@/ui/notice';
import { cellText, header, isNumeric, metricOf } from './cells';

/** Rows the result table shows before "Show all" (ui-ux-rules §6). */
const SHOWN = 8;

export function AnswerPaper({
  answer,
  model,
  note,
  cell,
}: {
  answer: Answer;
  model: SemanticModel;
  note: number;
  /** The cell the note's number came from; none for an answer without numbers. */
  cell: CellRef | null;
}) {
  const ref = cell ? answer.compiled.columns.find((c) => c.name === cell.column)?.ref : undefined;
  const metrics = ref ? [ref] : answer.spec.metrics;
  const kind = cell ? answer.compiled.columns.find((c) => c.name === cell.column)?.kind : undefined;
  return (
    <>
      <div className="flex flex-col gap-2 type-small text-ink-2">
        {metrics.map((id) => {
          const m = metricOf(model, id);
          return m ? <p key={id}>{describeMetric(model, m)}</p> : null;
        })}
        {(kind === 'change' || kind === 'change_pct') && (
          <p>
            The change is this period&rsquo;s value minus the earlier one
            {kind === 'change_pct' ? ', divided by the earlier one' : ''}.
          </p>
        )}
        {answer.scope.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <ResultTable answer={answer} model={model} note={note} cell={cell} />
      <Checks checks={answer.checks} />
      <div className="flex flex-col border-y border-ledger-rule">
        {cell && <RowsBehind answer={answer} model={model} cell={cell} />}
        <Disclosure summary="SQL" className={cx('py-1', cell && 'border-t border-ledger-rule')}>
          <pre
            className="type-code break-words whitespace-pre-wrap text-ink"
            data-testid="answer-sql"
          >
            {answer.compiled.displaySql}
          </pre>
        </Disclosure>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <CopyButton text={answer.compiled.displaySql} />
      </div>
    </>
  );
}

function ResultTable({
  answer,
  model,
  note,
  cell,
}: {
  answer: Answer;
  model: SemanticModel;
  note: number;
  cell: CellRef | null;
}) {
  const rows = answer.result.rows;
  const [all, setAll] = useState(false);
  // Eight rows that hold the linked cell: the first eight, or a window
  // around it further down.
  const start = all || !cell || cell.row < SHOWN ? 0 : Math.min(cell.row - 3, rows.length - SHOWN);
  const shown = all ? rows : rows.slice(start, start + SHOWN);
  const cols = answer.compiled.columns;
  const wrap = useRef<HTMLDivElement>(null);
  // The linked cell may be far down a long result: bring it into view.
  useEffect(() => {
    wrap.current?.querySelector('[data-cell="linked"]')?.scrollIntoView({ block: 'nearest' });
  }, [cell]);
  return (
    <div ref={wrap} className="flex flex-col items-start gap-2">
      <div className="fn-table-wrap fn-table-ledger max-w-full">
        <table className="fn-table" data-testid="answer-result">
          <caption>
            {shown.length < rows.length
              ? `Rows ${formatInteger(start + 1)} to ${formatInteger(start + shown.length)} of the ${formatInteger(rows.length)} in the result.`
              : `The result: ${formatInteger(rows.length)} ${rows.length === 1 ? 'row' : 'rows'}.`}
          </caption>
          <thead>
            <tr>
              {cols.map((c, i) => (
                <th key={c.name} scope="col" className={cx(i > 0 && isNumeric(c) && 'num')}>
                  {header(c, answer, model)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, k) => {
              const r = start + k;
              return (
                <tr key={r}>
                  {row.map((value, i) => {
                    const text = cellText(cols[i], value, answer, model);
                    const lit = cell !== null && cell.row === r && cell.column === cols[i].name;
                    const content = lit ? <Highlight note={note}>{text}</Highlight> : text;
                    return i === 0 && !isNumeric(cols[0]) ? (
                      <th key={cols[i].name} scope="row">
                        {content}
                      </th>
                    ) : (
                      <td
                        key={cols[i].name}
                        className={cx(isNumeric(cols[i]) && 'num')}
                        data-cell={lit ? 'linked' : undefined}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > SHOWN && (
        <Button variant="quiet" onClick={() => setAll(!all)}>
          {all ? `Show ${SHOWN} rows` : `Show all ${formatInteger(rows.length)}`}
        </Button>
      )}
    </div>
  );
}

const TONE: Record<ResultCheck['outcome'], 'good' | 'caution' | 'critical' | null> = {
  pass: 'good',
  caution: 'caution',
  fail: 'critical',
  note: null,
};

function Checks({ checks }: { checks: ResultCheck[] }) {
  return (
    <section aria-label="Checks" className="flex flex-col gap-2">
      <h3 className="type-small font-medium text-ink">Checks</h3>
      <ul className="flex flex-col gap-2">
        {checks.map((c) => {
          const tone = TONE[c.outcome];
          return (
            <li key={c.id}>
              {tone ? (
                <Status tone={tone}>{c.sentence}</Status>
              ) : (
                <p className="type-small text-ink">
                  <span className="font-medium">Note.</span> {c.sentence}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type Loaded =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; count: number; sample: QueryResult; sql: string[] }
  | { status: 'error'; message: string };

function RowsBehind({
  answer,
  model,
  cell,
}: {
  answer: Answer;
  model: SemanticModel;
  cell: CellRef;
}) {
  const [state, setState] = useState<Loaded>({ status: 'idle' });
  const load = () => {
    if (state.status !== 'idle') return;
    setState({ status: 'loading' });
    const q = rowsBehind(answer, model, cell.row, cell.column);
    const engine = workspaceEngine();
    void Promise.all([
      engine.query(q.count.sql, q.count.params),
      engine.query(q.sample.sql, q.sample.params),
    ]).then(
      ([count, sample]) =>
        setState({
          status: 'ready',
          count: Number(count.rows[0][0] ?? 0),
          sample,
          sql: [q.sample.display, q.count.display],
        }),
      (error: unknown) =>
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        }),
    );
  };
  return (
    <Disclosure summary="Rows behind it" className="py-1" onOpen={load}>
      {state.status === 'loading' || state.status === 'idle' ? (
        <p role="status" className="type-small text-ink-2">
          Reading the rows behind this number
        </p>
      ) : state.status === 'error' ? (
        <Status tone="critical">The rows could not be read: {state.message}.</Status>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="type-small text-ink">
            {formatInteger(state.count)} {state.count === 1 ? 'row is' : 'rows are'} behind this
            number.
            {state.count > state.sample.rowCount &&
              ` The first ${formatInteger(state.sample.rowCount)}:`}
          </p>
          <SampleTable sample={state.sample} />
          <Disclosure summary="SQL for these rows">
            <pre className="type-code break-words whitespace-pre-wrap text-ink">
              {state.sql.join(';\n\n')};
            </pre>
          </Disclosure>
        </div>
      )}
    </Disclosure>
  );
}

function SampleTable({ sample }: { sample: QueryResult }) {
  return (
    <div className="fn-table-wrap fn-table-ledger max-w-full">
      <table className="fn-table">
        <thead>
          <tr>
            {sample.columns.map((c) => (
              <th key={c.name} scope="col">
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sample.rows.map((row, r) => (
            <tr key={r}>
              {row.map((v, i) => (
                <td key={i} className={cx(typeof v === 'number' && 'num')}>
                  {v === null ? 'empty' : typeof v === 'number' ? formatNumber(v, 2) : String(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
