'use client';

import { useId, useState, type ReactNode } from 'react';
import { Notes, useNotes } from '@/ui/mark';
import { Panel, Sheet } from '@/ui/panel';
import { useTabletUp, useWide } from './use-wide';

/**
 * A workspace view: the reading column, and the working paper beside it from
 * 1200 px, or over the page when a mark is selected below that (§5).
 * `paper(note)` renders a note; `glance` is shown when nothing is selected.
 */
export function WorkspacePage({
  children,
  glance,
  paper,
  noteTitle,
}: {
  children: ReactNode;
  glance: ReactNode;
  paper: (note: number) => ReactNode;
  noteTitle: (note: number) => string;
}) {
  const paperId = useId();
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <Notes paperId={paperId} selected={selected} onSelect={setSelected}>
      <div className="wide:grid wide:grid-cols-[minmax(0,1fr)_400px] wide:gap-16 wide:min-h-[calc(100dvh-56px)]">
        <div className="min-w-0 px-4 pt-12 pb-24 md:px-8 wide:max-w-[calc(680px+clamp(24px,8vw,128px))] wide:pr-0 wide:pl-[clamp(24px,8vw,128px)]">
          {children}
        </div>
        <WorkingPaper id={paperId} glance={glance} paper={paper} noteTitle={noteTitle} />
      </div>
    </Notes>
  );
}

function WorkingPaper({
  id,
  glance,
  paper,
  noteTitle,
}: {
  id: string;
  glance: ReactNode;
  paper: (note: number) => ReactNode;
  noteTitle: (note: number) => string;
}) {
  const wide = useWide();
  const tablet = useTabletUp();
  const { selected, select } = useNotes();

  if (wide) {
    return (
      <aside
        id={id}
        aria-label="Working paper"
        className="sticky top-14 h-[calc(100dvh-56px)] overflow-y-auto border-l border-ledger-rule bg-ledger p-6"
      >
        {selected ? (
          <div key={selected} className="fn-fade flex flex-col gap-6">
            <h2 className="flex gap-3 type-body font-medium text-ink">
              <span className="text-mark">{selected}</span>
              <span>{noteTitle(selected)}</span>
            </h2>
            {paper(selected)}
          </div>
        ) : (
          glance
        )}
      </aside>
    );
  }

  const Overlay = tablet ? Panel : Sheet;
  return (
    <div id={id}>
      <Overlay
        open={selected !== null}
        onOpenChange={(open) => !open && select(null)}
        title={selected ? `Note ${selected}: ${noteTitle(selected)}` : ''}
      >
        {selected && paper(selected)}
      </Overlay>
    </div>
  );
}
