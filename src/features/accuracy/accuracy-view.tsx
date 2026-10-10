// The accuracy page (FR-44, evals §9). A server component: the page is
// rendered at build time from the summary it is given, so every figure on it
// comes from eval/results/summary.json (evals §8 rule 5).

import type { ReactNode } from 'react';
import { product } from '@/config/product';
import { SAMPLES } from '@/features/workspace/samples';
import { Rule } from '@/ui/rule';
import {
  CATEGORY_NAMES,
  EXPECTED,
  HAPPENED,
  LABEL_NAMES,
  MODE_MEANINGS,
  MODE_NAMES,
  type Miss,
  type Run,
  type Summary,
  categoriesIn,
  formatDay,
  formatInteger,
  leadSentences,
  missDetail,
  modesNotRun,
  notRunSentence,
  runsOn,
  wrongAnswers,
} from './accuracy';

const SET_NAMES: Record<Run['set'], string> = {
  dev: 'Development questions',
  holdout: 'Held-back questions',
};

const sampleName = (id: string) => SAMPLES.find((s) => s.id === id)?.name ?? id;

const link = 'text-mark underline-offset-3 hover:underline';

export type { Summary };

export function AccuracyView({ summary }: { summary: Summary }) {
  const sets = (['holdout', 'dev'] as const).filter((set) => runsOn(summary, set).length > 0);
  const total = summary.goldens.dev + summary.goldens.holdout;
  return (
    <div className="flex flex-col px-4 pt-12 pb-24 md:px-8 wide:pl-[clamp(24px,8vw,128px)]">
      <div className="flex flex-col gap-4">
        <h1 className="type-h2 text-ink">Accuracy</h1>
        <p className="max-w-[66ch] type-lead text-ink" data-testid="accuracy-lead">
          {leadSentences(summary).join(' ')}
        </p>
      </div>

      {sets.map((set) => (
        <Section key={set} id={`by-type-${set}`} title={`${SET_NAMES[set]} by type`}>
          <TypeTable runs={runsOn(summary, set)} />
          {notRunSentence(modesNotRun(summary, set)) && (
            <p className="max-w-[66ch] type-small text-ink-2">
              {notRunSentence(modesNotRun(summary, set))}
            </p>
          )}
        </Section>
      ))}

      {summary.runs.some((r) => r.notCorrect) && (
        <Section id="misses" title="What it did not get right">
          <p className="max-w-[66ch] type-prose text-ink-2">
            Every development question without a correct reply, with what was expected and what
            happened. Misses on the held-back questions are not listed, so nobody tunes Footnote to
            them.
          </p>
          {summary.runs.map(
            (run) =>
              run.notCorrect && (
                <Misses key={`${run.mode}-${run.set}`} run={run} misses={run.notCorrect} />
              ),
          )}
        </Section>
      )}

      <Section id="findings" title="Briefing findings">
        <p className="max-w-[66ch] type-prose text-ink">
          A second test checks whether the sample briefings find the effects planted in the sample
          data. It has not been run yet.
        </p>
      </Section>

      <Section id="method" title="How it is measured">
        <p className="max-w-[66ch] type-prose text-ink">
          Each test question is asked about one of the sample datasets, and the reply is compared
          with a reference answer written by hand in SQL. An answer counts as right when every
          column of the reference appears in the reply with the same values, give or take rounding.
          Some questions are ambiguous or cannot be answered from the data, and for those the right
          reply is to ask which was meant or to decline. A wrong answer is a number shown that does
          not match, or an answer given where Footnote should have asked or declined; asking or
          declining when it could have answered counts as over-cautious instead. The{' '}
          {formatInteger(summary.goldens.dev)} development questions are used while building, and
          the {formatInteger(summary.goldens.holdout)} held-back questions are run only at the end.
        </p>
        <dl className="flex max-w-[66ch] flex-col gap-3">
          {(Object.keys(MODE_NAMES) as Run['mode'][]).map((mode) => (
            <div key={mode} className="flex flex-col">
              <dt className="type-body font-medium text-ink">{MODE_NAMES[mode]}</dt>
              <dd className="type-body text-ink-2">{MODE_MEANINGS[mode]}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="limits" title="Limits">
        <p className="max-w-[66ch] type-prose text-ink">
          The data is made up, generated with known effects so the right answers are known. Each
          dataset is one table. There are {formatInteger(total)} questions, all in English, written
          by the same person who built the product. Rates are compared with the same small rounding
          allowance as other numbers, so a rate can be slightly off and still count as right.
        </p>
      </Section>

      <Section id="runs" title="The runs behind these figures">
        {summary.runs.length === 0 ? (
          <p className="max-w-[66ch] type-prose text-ink-2">
            No run has been recorded yet. Run the tests and rebuild the site to fill this page.
          </p>
        ) : (
          <RunsTable runs={summary.runs} />
        )}
        <p className="max-w-[66ch] type-small text-ink-2">
          Every figure on this page is read from{' '}
          <a className={link} href={`${product.repository}/blob/main/eval/results/summary.json`}>
            the results file
          </a>{' '}
          when the site is built.
        </p>
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12 flex flex-col gap-4">
      <Rule kind="section" />
      <h2 id={id} className="type-h2 text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TypeTable({ runs }: { runs: Run[] }) {
  const errors = runs.some((r) => r.headline.error > 0);
  const cells = (h: Run['headline']) => [
    h.correct,
    wrongAnswers(h),
    h.overCautious,
    ...(errors ? [h.error] : []),
  ];
  const heads = ['Correct', 'Wrong', 'Over-cautious', ...(errors ? ['Error'] : [])];
  const several = runs.length > 1;
  return (
    <div className="fn-table-wrap">
      <table className="fn-table">
        <thead>
          {several && (
            <tr>
              <td colSpan={2} />
              {runs.map((r) => (
                <th key={r.mode} scope="colgroup" colSpan={heads.length}>
                  {MODE_NAMES[r.mode]}
                </th>
              ))}
            </tr>
          )}
          <tr>
            <th scope="col">Question type</th>
            <th scope="col" className="num">
              Questions
            </th>
            {runs.flatMap((r) =>
              heads.map((h) => (
                <th key={`${r.mode}-${h}`} scope="col" className="num">
                  {h}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {categoriesIn(runs).map((c) => (
            <tr key={c}>
              <th scope="row">{CATEGORY_NAMES[c]}</th>
              <td className="num">{formatInteger(runs[0].byCategory[c]?.questions ?? 0)}</td>
              {runs.flatMap((r) => {
                const h = r.byCategory[c];
                return h
                  ? cells(h).map((n, i) => (
                      <td key={`${r.mode}-${i}`} className="num">
                        {formatInteger(n)}
                      </td>
                    ))
                  : heads.map((_, i) => <td key={`${r.mode}-${i}`} className="num" />);
              })}
            </tr>
          ))}
          <tr>
            <th scope="row">All types</th>
            <td className="num">{formatInteger(runs[0].headline.questions)}</td>
            {runs.flatMap((r) =>
              cells(r.headline).map((n, i) => (
                <td key={`${r.mode}-${i}`} className="num font-medium">
                  {formatInteger(n)}
                </td>
              )),
            )}
          </tr>
        </tbody>
        {!several && <caption>{MODE_NAMES[runs[0].mode]}.</caption>}
      </table>
    </div>
  );
}

function Misses({ run, misses }: { run: Run; misses: Miss[] }) {
  const title = `${MODE_NAMES[run.mode]}: ${formatInteger(misses.length)} of ${formatInteger(run.headline.questions)}`;
  if (misses.length === 0) {
    return (
      <p className="max-w-[66ch] type-body text-ink">
        {MODE_NAMES[run.mode]}, every development question got a correct reply.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <h3 className="type-body font-medium text-ink">{title}</h3>
      <div className="fn-table-wrap">
        <table className="fn-table">
          <thead>
            <tr>
              <th scope="col">Question</th>
              <th scope="col">Data</th>
              <th scope="col">Expected</th>
              <th scope="col">What happened</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {misses.map((m) => (
              <tr key={m.id}>
                <th scope="row" className="min-w-[24ch] font-normal">
                  {m.question}
                </th>
                <td>{sampleName(m.dataset)}</td>
                <td>{EXPECTED[m.expect]}</td>
                <td>
                  {HAPPENED[m.kind]}
                  {missDetail(m) && <span className="block text-ink-2">{missDetail(m)}</span>}
                </td>
                <td>{LABEL_NAMES[m.label]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RunsTable({ runs }: { runs: Run[] }) {
  return (
    <div className="fn-table-wrap">
      <table className="fn-table">
        <thead>
          <tr>
            <th scope="col">Mode</th>
            <th scope="col">Questions</th>
            <th scope="col">Run on</th>
            <th scope="col">Commit</th>
            <th scope="col">Model</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={`${r.mode}-${r.set}`}>
              <th scope="row">{MODE_NAMES[r.mode]}</th>
              <td>{SET_NAMES[r.set]}</td>
              <td>{formatDay(r.runAt)}</td>
              <td>
                <a className={link} href={`${product.repository}/commit/${r.commit}`}>
                  {r.commit}
                </a>
                {r.dirty && <span className="block text-ink-2">with uncommitted changes</span>}
              </td>
              <td>{r.modelId ?? 'None called'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
