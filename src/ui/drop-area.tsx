'use client';

import { useId, useRef, useState } from 'react';
import { buttonClass } from './button';
import { cx } from './cx';

/**
 * Where a file is dropped or chosen: a dashed edge, one sentence, a chooser
 * styled as a secondary button, and a hint. Dimmed while `busy`.
 */
export function DropArea({
  prompt,
  chooseLabel,
  hint,
  accept,
  busy = false,
  dragging,
  onFile,
}: {
  prompt: string;
  chooseLabel: string;
  hint: string;
  accept?: string;
  busy?: boolean;
  /** Fixes the drag-over look, for the styleguide. */
  dragging?: boolean;
  onFile: (file: File) => void;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();

  function take(file: File | undefined) {
    if (file && !busy) onFile(file);
    // Choosing the same file again should read it again.
    if (input.current) input.current.value = '';
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!busy) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        take(event.dataTransfer.files[0]);
      }}
      aria-busy={busy}
      className={cx(
        'flex flex-col items-start gap-4 rounded-sm border border-dashed px-6 py-8',
        (dragging ?? over) ? 'border-mark bg-wash' : 'border-ink-3',
        busy && 'opacity-60',
      )}
    >
      <p className="type-body text-ink">{prompt}</p>
      <label
        className={buttonClass(
          'secondary',
          cx(
            'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-mark',
            busy ? 'pointer-events-none' : 'cursor-pointer',
          ),
        )}
      >
        {chooseLabel}
        <input
          ref={input}
          type="file"
          accept={accept}
          disabled={busy}
          aria-describedby={hintId}
          className="sr-only"
          onChange={(event) => take(event.target.files?.[0])}
        />
      </label>
      <p id={hintId} className="type-small text-ink-3">
        {hint}
      </p>
    </div>
  );
}
