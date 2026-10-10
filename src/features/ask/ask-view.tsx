'use client';

// The Ask view (FR-40 to FR-42). For now it offers the workspace's starter
// questions; selecting one runs it and adds its answer to the page. The
// questions and answers stack as a document, and the notes are numbered in
// reading order through all of them.

import { useEffect, useRef, useState } from 'react';
import { runAnswer, type AnswerOutcome } from '@/core/ask/answer';
import type { Starter } from '@/core/model/types';
import { FileNotOpen, FileNotOpenGlance } from '@/features/workspace/file-not-open';
import { GlancePaper } from '@/features/workspace/glance-paper';
import {
  type LoadedSample,
  type Workspace,
  useWorkspace,
  workspaceEngine,
} from '@/features/workspace/workspace-store';
import { WorkspacePage } from '@/features/workspace/workspace-page';
import { Button } from '@/ui/button';
import { Status } from '@/ui/notice';
import { Rule } from '@/ui/rule';
import { AnswerPaper } from './answer-paper';
import { AnswerView, notesOf } from './answer-view';

type Entry =
  | { id: number; question: string; status: 'running'; step: string }
  | { id: number; question: string; status: 'done'; outcome: AnswerOutcome };

/** Which answer and which of its numbers a note belongs to. */
interface NoteOwner {
  entry: Extract<Entry, { status: 'done' }>;
  first: number;
  fact: number | null;
}

/** The first note number of each entry. */
function firstNotes(entries: Entry[]): number[] {
  const firsts: number[] = [];
  let next = 1;
  for (const entry of entries) {
    firsts.push(next);
    if (entry.status === 'done') next += notesOf(entry.outcome);
  }
  return firsts;
}

function noteOwners(entries: Entry[]): Map<number, NoteOwner> {
  const owners = new Map<number, NoteOwner>();
  let next = 1;
  for (const entry of entries) {
    if (entry.status !== 'done') continue;
    const n = notesOf(entry.outcome);
    const facts = entry.outcome.ok ? entry.outcome.answer.sentence.facts.length : 0;
    for (let i = 0; i < n; i++) {
      owners.set(next + i, { entry, first: next, fact: i < facts ? i : null });
    }
    next += n;
  }
  return owners;
}

export function AskView({
  workspaceId,
  questions,
}: {
  workspaceId: string;
  /** Questions to offer instead of the dictionary's starters (the test page uses this). */
  questions?: Starter[];
}) {
  const { workspace, state } = useWorkspace(workspaceId);
  const data = state.status === 'ready' ? state.data : null;
  const [entries, setEntries] = useState<Entry[]>([]);
  const owners = noteOwners(entries);

  if (!workspace || state.status === 'missing')
    return (
      <WorkspacePage glance={<FileNotOpenGlance />} noteTitle={() => ''} paper={() => null}>
        <FileNotOpen />
      </WorkspacePage>
    );

  const noteTitle = (note: number) => {
    const owner = owners.get(note);
    if (!owner || !owner.entry.outcome.ok) return '';
    const answer = owner.entry.outcome.answer;
    return owner.fact === null ? answer.question : answer.sentence.facts[owner.fact].title;
  };
  const paper = (note: number) => {
    const owner = owners.get(note);
    if (!owner || !owner.entry.outcome.ok || !data) return null;
    const answer = owner.entry.outcome.answer;
    return (
      <AnswerPaper
        answer={answer}
        model={data.model}
        note={note}
        cell={owner.fact === null ? null : answer.sentence.facts[owner.fact].cell}
      />
    );
  };

  return (
    <WorkspacePage
      glance={<GlancePaper workspace={workspace} data={data} marks={entries.length > 0} />}
      noteTitle={noteTitle}
      paper={paper}
    >
      <div className="flex flex-col gap-4">
        <h1 className="type-h2 text-ink">Ask</h1>
        {state.status === 'loading' && (
          <p role="status" data-loading className="type-small text-ink-2">
            {state.step}
          </p>
        )}
        {state.status === 'error' && (
          <div className="flex flex-col items-start gap-4">
            <Status tone="critical">
              The data did not load. {state.message}. Reload to try again, or choose another
              workspace from the menu at the top.
            </Status>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </div>
        )}
        {data && (
          <Thread
            workspace={workspace}
            data={data}
            starters={questions ?? data.model.starters}
            entries={entries}
            setEntries={setEntries}
          />
        )}
      </div>
    </WorkspacePage>
  );
}

let nextId = 1;

function Thread({
  workspace,
  data,
  starters,
  entries,
  setEntries,
}: {
  workspace: Workspace;
  data: LoadedSample;
  starters: Starter[];
  entries: Entry[];
  setEntries: (update: (entries: Entry[]) => Entry[]) => void;
}) {
  const focusId = useRef<number | null>(null);
  const headings = useRef(new Map<number, HTMLHeadingElement>());

  // Focus moves to an answer's question when the answer arrives.
  useEffect(() => {
    const id = focusId.current;
    const done = entries.find((e) => e.id === id && e.status === 'done');
    if (id !== null && done) {
      headings.current.get(id)?.focus();
      focusId.current = null;
    }
  }, [entries]);

  const ask = (starter: Starter) => {
    const id = nextId++;
    const question = starter.label;
    focusId.current = id;
    setEntries((es) => [...es, { id, question, status: 'running', step: 'Reading the question' }]);
    const update = (entry: Entry) => setEntries((es) => es.map((e) => (e.id === id ? entry : e)));
    void runAnswer({
      engine: workspaceEngine(),
      model: data.model,
      time: data.time,
      question,
      spec: starter.spec,
      onStep: (step) => update({ id, question, status: 'running', step }),
    })
      .catch((error: unknown) => ({
        ok: false as const,
        question,
        message: error instanceof Error ? error.message : String(error),
      }))
      .then((outcome) => update({ id, question, status: 'done', outcome }));
  };

  const firsts = firstNotes(entries);
  return (
    <>
      <section aria-labelledby="starters" className="flex flex-col gap-3">
        <p id="starters" className="type-prose max-w-[66ch] text-ink-2">
          {starters.length
            ? `Questions to start with about ${workspace.file ? 'this file' : workspace.name}. Each answer shows the query behind every number.`
            : 'There are no starter questions for this file yet. Open one of the samples from the menu at the top to try some.'}
        </p>
        {starters.length > 0 && (
          <ul className="flex flex-col items-start gap-1">
            {starters.map((s) => (
              <li key={s.label}>
                <Button variant="quiet" className="type-body text-left" onClick={() => ask(s)}>
                  {s.label}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {entries.map((entry, i) => {
        const first = firsts[i];
        return (
          <section key={entry.id} className="mt-8 flex flex-col gap-6" data-entry>
            <Rule kind="section" />
            {entry.status === 'running' ? (
              <>
                <h2 className="type-h2 text-ink">{entry.question}</h2>
                <p role="status" className="type-small text-ink-2">
                  {entry.step}
                </p>
              </>
            ) : (
              <AnswerView
                outcome={entry.outcome}
                model={data.model}
                firstNote={first}
                headingRef={(el) => {
                  if (el) headings.current.set(entry.id, el);
                  else headings.current.delete(entry.id);
                }}
              />
            )}
          </section>
        );
      })}
    </>
  );
}
