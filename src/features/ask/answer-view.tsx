'use client';

// One answer (ui-ux-rules §6): the question, the interpretation row, the
// sentence with its reference marks, and the chart. A failed check replaces
// the sentence with the problem (FR-42).

import type { Ref } from 'react';
import type { AnswerOutcome } from '@/core/ask/answer';
import type { SemanticModel } from '@/core/model/types';
import { Button } from '@/ui/button';
import { Mark, useNotes } from '@/ui/mark';
import { Status } from '@/ui/notice';
import { StaticTag } from '@/ui/tag';
import { AnswerChart } from './answer-chart';

export function AnswerView({
  outcome,
  model,
  firstNote,
  headingRef,
}: {
  outcome: AnswerOutcome;
  model: SemanticModel;
  /** The note number of this answer's first mark; notes run through the page. */
  firstNote: number;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const { select } = useNotes();
  const heading = (
    <h2 ref={headingRef} tabIndex={-1} className="type-h2 text-ink focus:outline-none">
      {outcome.ok ? outcome.answer.question : outcome.question}
    </h2>
  );
  if (!outcome.ok) {
    return (
      <article className="flex flex-col gap-4" data-answer>
        {heading}
        <Status tone="critical">This question could not be answered. {outcome.message}.</Status>
      </article>
    );
  }

  const answer = outcome.answer;
  const { segments, facts } = answer.sentence;
  const cautions = answer.checks.filter((c) => c.outcome === 'caution').map((c) => c.sentence);
  const caution = cautions.length ? cautions.join(' ') : undefined;
  const summary = segments.map((s) => (typeof s === 'string' ? s : facts[s.fact].text)).join('');
  // The split value the sentence leads with, so the chart greys the rest.
  const lead = facts[0];
  const leadDim = answer.spec.by.length === 1 && lead ? answer.spec.by[0] : null;
  const emphasis =
    leadDim && lead
      ? String(
          answer.result.rows[lead.cell.row][
            answer.compiled.columns.findIndex((c) => c.name === leadDim)
          ] ?? '',
        ) || undefined
      : undefined;
  const paperButton = (
    <Button variant="quiet" className="self-start" onClick={() => select(firstNote)}>
      Show the working paper
    </Button>
  );

  return (
    <article className="flex flex-col gap-4" data-answer>
      {heading}
      <ul aria-label="How the question was read" className="flex flex-wrap gap-2">
        {answer.interpretation.map((p) => (
          <li key={`${p.label}:${p.value}`}>
            <StaticTag label={p.label} value={p.value} />
          </li>
        ))}
      </ul>
      {answer.problem ? (
        <>
          <Status tone="critical" className="type-body">
            This answer is not shown, because a check on the result failed.{' '}
            {answer.problem.sentence}
          </Status>
          {paperButton}
        </>
      ) : (
        <>
          <p className="type-prose max-w-[66ch] text-ink" data-testid="answer-sentence">
            {segments.map((s, i) =>
              typeof s === 'string' ? (
                s
              ) : (
                <Mark
                  key={i}
                  note={firstNote + s.fact}
                  description={`how ${facts[s.fact].text} was worked out`}
                  caution={s.fact === 0 ? caution : undefined}
                >
                  {facts[s.fact].text}
                </Mark>
              ),
            )}
          </p>
          {caution && <Status tone="caution">{caution}</Status>}
          {facts.length === 0 && paperButton}
          <div className="mt-2">
            <AnswerChart
              answer={answer}
              model={model}
              summary={summary || answer.question}
              emphasis={emphasis}
            />
          </div>
        </>
      )}
    </article>
  );
}

/** How many notes an answer takes: one per number, or one for its working paper. */
export function notesOf(outcome: AnswerOutcome): number {
  if (!outcome.ok) return 0;
  return Math.max(outcome.answer.sentence.facts.length, 1);
}
