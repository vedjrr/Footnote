'use client';

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';
import { Icon } from './icon';

/*
 * The reference mark and its highlight (ui-ux-rules §1, §6). A Mark wraps a
 * number in the text with its raised note number. Selecting it highlights
 * the number and every Highlight with the same note, which is how the claim
 * and its evidence in the working paper are joined.
 */

interface NotesState {
  selected: number | null;
  select: (note: number | null) => void;
  /** id of the element the marks open: the working paper. */
  paperId: string;
}

const NotesContext = createContext<NotesState | null>(null);

export function Notes({
  paperId,
  selected: controlled,
  onSelect,
  children,
}: {
  paperId: string;
  selected?: number | null;
  onSelect?: (note: number | null) => void;
  children: ReactNode;
}) {
  const [own, setOwn] = useState<number | null>(null);
  const selected = controlled === undefined ? own : controlled;
  const select = useCallback(
    (note: number | null) => {
      if (controlled === undefined) setOwn(note);
      onSelect?.(note);
    },
    [controlled, onSelect],
  );
  const value = useMemo(() => ({ selected, select, paperId }), [selected, select, paperId]);
  return <NotesContext value={value}>{children}</NotesContext>;
}

export function useNotes(): NotesState {
  const ctx = use(NotesContext);
  if (!ctx) throw new Error('Mark and Highlight must be inside <Notes>.');
  return ctx;
}

export function Mark({
  note,
  description,
  caution,
  children,
}: {
  note: number;
  /** Completes "Note 3: …", for example "how 7.4% was computed". */
  description: string;
  /** Set when one of the number's checks raised a caution. */
  caution?: string;
  children: ReactNode;
}) {
  const { selected, select, paperId } = useNotes();
  const isOpen = selected === note;
  const name = `Note ${note}: ${description}${caution ? `. Caution: ${caution}` : ''}`;
  return (
    <button
      type="button"
      className="fn-mark"
      aria-label={name}
      aria-expanded={isOpen}
      aria-controls={paperId}
      data-note={note}
      onClick={() => select(isOpen ? null : note)}
    >
      <span className="fn-number">{children}</span>
      <sup className="fn-ref">{note}</sup>
      {caution && (
        <span className="fn-caution">
          <Icon name="caution" size={16} />
        </span>
      )}
    </button>
  );
}

/** A value in the working paper that lights up with its mark. */
export function Highlight({ note, children }: { note: number; children: ReactNode }) {
  const { selected } = useNotes();
  return (
    <span
      className="fn-highlight"
      data-active={selected === note ? '' : undefined}
      data-note={note}
    >
      {children}
    </span>
  );
}
