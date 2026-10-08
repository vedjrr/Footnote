'use client';

// The data health screen (FR-10, FR-11): problems most serious first, each
// with its sentence, the count under a reference mark, the metrics it
// affects and a working paper holding example rows and the SQL. Then the
// column profile as a table, with its own working paper.

import type { ReactNode } from 'react';
import type { Cell, ColumnType } from '@/core/engine/types';
import type { HealthProblem, HealthReport, Severity } from '@/core/health/health';
import type { SemanticModel } from '@/core/model/types';
import { formatDay, formatInteger, formatShare } from '@/core/narrative/format';
import type { ColumnProfile, Profile } from '@/core/profile/profile';
import { FileNotOpen, FileNotOpenGlance } from '@/features/workspace/file-not-open';
import { GlancePaper } from '@/features/workspace/glance-paper';
import { useHealth, useWorkspace, type Workspace } from '@/features/workspace/workspace-store';
import { WorkspacePage } from '@/features/workspace/workspace-page';
import { Button } from '@/ui/button';
import { CopyButton } from '@/ui/copy-button';
import { Disclosure } from '@/ui/disclosure';
import { Highlight, Mark } from '@/ui/mark';
import { Status } from '@/ui/notice';
import { Rule } from '@/ui/rule';

const GROUPS: Array<{ severity: Severity; title: string }> = [
  { severity: 'serious', title: 'Fix before you rely on the numbers' },
  { severity: 'minor', title: 'Worth a look' },
  { severity: 'information', title: 'Good to know' },
];

/** What each check looks for, in words, for the working paper. */
const RULES: Record<HealthProblem['check'], string> = {
  H1: 'Rows that match an earlier row in every column. Serious from 0.5% of rows.',
  H2: 'An identifier that is almost always unique but repeats on some rows. Always serious.',
  H3: 'Values that are empty or blank. Reported from 0.1% of rows on columns the metrics use, 1% on others. Serious from 20% on a column the metrics use.',
  H4: 'Labels in one column that differ only by capital letters or spaces. Serious from 2% of rows.',
  H5: 'Values more than ten median absolute deviations from the median, on the log scale for values that are almost always above 0.',
  H6: 'Negative values in a column where 99% or more of values are zero or above.',
  H7: 'Values that could not be read as the type the rest of the column has.',
  H8: 'Days, weeks or months inside the date range with no rows at all.',
  H9: 'An end date before its start date, or a date after today. Always serious.',
  H10: 'The latest period has fewer days of data than usual, so comparisons skip it.',
  H11: 'A column with the same value in every row.',
  H12: 'One amount is 0 while another amount on the same row is above 0, which rarely happens elsewhere. Serious from 0.5% of rows.',
};

const TYPE_WORDS: Record<ColumnType, string> = {
  integer: 'Whole number',
  decimal: 'Decimal',
  boolean: 'True or false',
  date: 'Date',
  timestamp: 'Date and time',
  text: 'Text',
};

export function HealthView({ workspaceId }: { workspaceId: string }) {
  const { workspace, state } = useWorkspace(workspaceId);
  const health = useHealth(workspaceId);
  const data = state.status === 'ready' ? state.data : null;
  const report = health?.status === 'ready' ? health : null;

  if (!workspace || state.status === 'missing')
    return (
      <WorkspacePage glance={<FileNotOpenGlance />} noteTitle={() => ''} paper={() => null}>
        <FileNotOpen />
      </WorkspacePage>
    );

  const problems = report?.report.problems ?? [];
  const profileNote = problems.length + 1;

  return (
    <WorkspacePage
      glance={<GlancePaper workspace={workspace} data={data} marks={report !== null} />}
      noteTitle={(n) => (n === profileNote ? 'The column profile' : (problems[n - 1]?.title ?? ''))}
      paper={(n) =>
        report && data ? (
          n === profileNote ? (
            <ProfilePaper profile={report.profile} />
          ) : problems[n - 1] ? (
            <ProblemPaper
              note={n}
              problem={problems[n - 1]}
              report={report.report}
              model={data.model}
            />
          ) : null
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        <h1 className="type-h2 text-ink">Data health</h1>
        {state.status === 'loading' && (
          <p role="status" data-loading className="type-small text-ink-2">
            {state.step}
          </p>
        )}
        {(state.status === 'error' || health?.status === 'error') && (
          <div className="flex flex-col items-start gap-4">
            <Status tone="critical">
              The health checks for {workspace.name} did not run.{' '}
              {state.status === 'error'
                ? state.message
                : health?.status === 'error'
                  ? health.message
                  : ''}
              . Reload to try again.
            </Status>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </div>
        )}
        {health?.status === 'checking' && (
          <p role="status" data-loading className="type-small text-ink-2">
            Checking the {workspace.rowNoun} for duplicates, gaps and odd values
          </p>
        )}
        {report && data && (
          <Problems workspace={workspace} problems={problems} model={data.model} />
        )}
      </div>
      {report && (
        <section aria-labelledby="profile" className="mt-12 flex flex-col gap-4">
          <Rule kind="section" />
          <h2 id="profile" className="type-h2 text-ink">
            What each column holds
          </h2>
          <ProfileTable profile={report.profile} note={profileNote} />
        </section>
      )}
    </WorkspacePage>
  );
}

function Problems({
  workspace,
  problems,
  model,
}: {
  workspace: Workspace;
  problems: HealthProblem[];
  model: SemanticModel;
}) {
  if (problems.length === 0)
    return (
      <p className="max-w-[66ch] type-prose text-ink" data-testid="health-clean">
        Footnote ran every check on {workspace.file ? 'this file' : workspace.name} and found no
        duplicates, gaps, empty values or odd values to warn you about.
      </p>
    );
  let note = 0;
  return (
    <>
      <p className="max-w-[66ch] type-prose text-ink-2">
        These checks read the data without changing it. Select a number to see the rows behind it
        and the query that counted them.
      </p>
      {GROUPS.map(({ severity, title }) => {
        const group = problems.filter((p) => p.severity === severity);
        if (group.length === 0) return null;
        return (
          <section
            key={severity}
            aria-labelledby={`health-${severity}`}
            className="mt-8 flex flex-col gap-8"
          >
            <div className="flex flex-col gap-4">
              <Rule kind="section" />
              <h2 id={`health-${severity}`} className="type-h2 text-ink">
                {title}
              </h2>
            </div>
            {group.map((p) => {
              note++;
              return <ProblemItem key={note} note={note} problem={p} model={model} />;
            })}
          </section>
        );
      })}
    </>
  );
}

/** The part of the sentence the mark goes on: "719 rows (1.2%)", else the first count. */
const ROWS = /\d[\d,]* rows?(?: \([^)]+\))?/;
const PERIODS = /\d[\d,]* (?:days?|weeks?|months?)/;
const NUMBER = /\d[\d,.]*%?/;

function Statement({ text, note, title }: { text: string; note: number; title: string }) {
  const match = ROWS.exec(text) ?? PERIODS.exec(text) ?? NUMBER.exec(text);
  if (!match) return <>{text}</>;
  const [before, after] = [text.slice(0, match.index), text.slice(match.index + match[0].length)];
  return (
    <>
      {before}
      <Mark note={note} description={`the count behind ${title.toLowerCase()}`}>
        {match[0]}
      </Mark>
      {after}
    </>
  );
}

function affects(problem: HealthProblem, model: SemanticModel): string | null {
  const metrics = problem.metrics.map((id) => model.metrics.find((m) => m.id === id)?.label ?? id);
  const dims = problem.dimensions.map(
    (id) => model.dimensions.find((d) => d.id === id)?.label ?? id,
  );
  const parts: string[] = [];
  if (metrics.length === model.metrics.length && metrics.length > 0) parts.push('every metric');
  else if (metrics.length > 0) parts.push(metrics.join(', '));
  if (dims.length > 0) parts.push(`splits by ${dims.join(', ')}`);
  return parts.length ? `Affects ${parts.join(', and ')}.` : null;
}

function ProblemItem({
  note,
  problem,
  model,
}: {
  note: number;
  problem: HealthProblem;
  model: SemanticModel;
}) {
  const impact = affects(problem, model);
  return (
    <article className="flex flex-col gap-2" data-check={problem.check}>
      <h3 className="type-body font-medium text-ink">{problem.title}</h3>
      <p className="max-w-[66ch] type-prose text-ink">
        <Statement text={problem.statement} note={note} title={problem.title} />
      </p>
      {impact && <p className="max-w-[66ch] type-small text-ink-2">{impact}</p>}
    </article>
  );
}

function ProblemPaper({
  note,
  problem,
  report,
  model,
}: {
  note: number;
  problem: HealthProblem;
  report: HealthReport;
  model: SemanticModel;
}) {
  const impact = affects(problem, model);
  const periods = problem.check === 'H8';
  return (
    <>
      <div className="flex flex-col gap-2 type-small text-ink-2">
        <p>{RULES[problem.check]}</p>
        <p>
          All rows of the {report.table} table. No filters.
          {problem.columns.length > 0 && ` Columns: ${problem.columns.join(', ')}.`}
        </p>
      </div>
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
              <th scope="row">{periods ? 'Periods with no rows' : 'Rows'}</th>
              <td className="num">
                <Highlight note={note}>{formatInteger(problem.count)}</Highlight>
              </td>
            </tr>
            <tr>
              <th scope="row">{periods ? 'Of periods in range' : 'Of all rows'}</th>
              <td className="num">{formatShare(problem.share)}</td>
            </tr>
            <tr>
              <th scope="row">Rows in the table</th>
              <td className="num">{formatInteger(report.rows)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {impact && <p className="type-small text-ink">{impact}</p>}
      <div className="flex flex-col border-y border-ledger-rule">
        <Disclosure summary="Rows behind it" className="py-1">
          <ExampleRows problem={problem} />
        </Disclosure>
        <Disclosure summary="SQL" className="border-t border-ledger-rule py-1">
          <pre className="type-code break-words whitespace-pre-wrap text-ink">{problem.sql}</pre>
        </Disclosure>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <CopyButton text={problem.sql} />
      </div>
    </>
  );
}

const cellText = (c: Cell) => (c === null ? 'empty' : String(c));

function ExampleRows({ problem }: { problem: HealthProblem }) {
  const { columns, rows } = problem.examples;
  return (
    <div className="flex flex-col gap-2">
      <p className="type-small text-ink-2">
        {rows.length === 1 ? 'An example' : `${formatInteger(rows.length)} examples`}, in column
        order.
      </p>
      <div className="fn-table-wrap fn-table-ledger">
        <table className="fn-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className={typeof c === 'number' ? 'num' : undefined}>
                    {cellText(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function summary(c: ColumnProfile): string {
  if (c.numeric && c.numeric.min !== null && c.numeric.max !== null) {
    return `${plain(c.numeric.min)} to ${plain(c.numeric.max)}`;
  }
  if (c.temporal?.min && c.temporal.max) {
    return `${formatDay(c.temporal.min)} to ${formatDay(c.temporal.max)}`;
  }
  const top = c.categorical?.top[0];
  return top ? `${top.value} is most common` : 'No values';
}

function plain(x: number): string {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(x).replace('-', '−');
}

function ProfileTable({ profile, note }: { profile: Profile; note: number }): ReactNode {
  return (
    <>
      <p className="max-w-[66ch] type-prose text-ink-2">
        The type Footnote read for each column, how many rows leave it empty and how many different
        values it has, from{' '}
        <Mark note={note} description="the statements behind the column profile">
          {profile.sql.length === 1
            ? 'one statement'
            : `${formatInteger(profile.sql.length)} statements`}
        </Mark>
        .
      </p>
      <div className="fn-table-wrap">
        <table className="fn-table">
          <thead>
            <tr>
              <th scope="col">Column</th>
              <th scope="col">Type</th>
              <th scope="col" className="num">
                Empty
              </th>
              <th scope="col" className="num">
                Different values
              </th>
              <th scope="col">Range or most common</th>
            </tr>
          </thead>
          <tbody>
            {profile.columns.map((c) => (
              <tr key={c.name}>
                <th scope="row">{c.name}</th>
                <td>
                  {TYPE_WORDS[c.type]}
                  {c.refinement && ` (from ${TYPE_WORDS[c.storageType].toLowerCase()})`}
                </td>
                <td className="num">{formatInteger(c.empty)}</td>
                <td className="num">{formatInteger(c.distinct)}</td>
                <td>{summary(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProfilePaper({ profile }: { profile: Profile }) {
  const sql = profile.sql.join(';\n\n') + ';';
  return (
    <>
      <div className="flex flex-col gap-2 type-small text-ink-2">
        <p>
          Every column of the {profile.table} table, counted in {formatInteger(profile.sql.length)}{' '}
          statements: counts and type checks first, then one per kind of column.
        </p>
        <p>
          All {formatInteger(profile.rows)} rows. Empty means missing, or blank text. Different
          values are compared exactly as stored.
        </p>
      </div>
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
