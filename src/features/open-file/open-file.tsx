'use client';

import Link from 'next/link';
import { useId, useRef, useState, type DragEvent } from 'react';
import { viewHref } from '@/features/shell/routes';
import { ACCEPT, IngestError } from '@/core/ingest/file';
import { openFile, type Workspace } from '@/features/workspace/workspace-store';
import { Button, buttonClass } from '@/ui/button';
import { cx } from '@/ui/cx';
import { Status } from '@/ui/notice';

// "Use your own file" (FR-02): a drop area and a chooser. The file is read by
// the engine in this page; nothing about it is sent anywhere.

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading'; fileName: string; step: string }
  | { kind: 'failed'; message: string }
  | { kind: 'open'; workspace: Workspace };

export function OpenFile() {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const busy = phase.kind === 'reading';

  async function read(file: File | undefined) {
    if (!file || busy) return;
    setPhase({ kind: 'reading', fileName: file.name, step: `Opening ${file.name}` });
    try {
      const workspace = await openFile(file, (step) =>
        setPhase({ kind: 'reading', fileName: file.name, step }),
      );
      setPhase({ kind: 'open', workspace });
    } catch (error) {
      setPhase({
        kind: 'failed',
        message:
          error instanceof IngestError
            ? error.message
            : `${file.name} could not be read. ${error instanceof Error ? error.message : ''} Try again, or save the file in another format first.`,
      });
    } finally {
      // Choosing the same file again should read it again.
      if (input.current) input.current.value = '';
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    void read(event.dataTransfer.files[0]);
  }

  if (phase.kind === 'open')
    return <Opened workspace={phase.workspace} onAnother={() => setPhase({ kind: 'idle' })} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h1 className="type-h2 text-ink">Use your own file</h1>
        <p className="type-prose text-ink-2">
          Choose a CSV, TSV, Parquet or JSON file whose first line names the columns. It is read in
          this browser, and its rows are not sent anywhere.
        </p>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        aria-busy={busy}
        className={cx(
          'flex flex-col items-start gap-4 rounded-sm border border-dashed px-6 py-8',
          over ? 'border-mark bg-wash' : 'border-ink-3',
          busy && 'opacity-60',
        )}
      >
        <p className="type-body text-ink">Drop a file here, or choose one.</p>
        <label
          className={buttonClass(
            'secondary',
            cx(
              'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-mark',
              busy ? 'pointer-events-none' : 'cursor-pointer',
            ),
          )}
        >
          Choose a file
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            disabled={busy}
            aria-describedby={hintId}
            className="sr-only"
            onChange={(event) => void read(event.target.files?.[0])}
          />
        </label>
        <p id={hintId} className="type-small text-ink-3">
          Files up to 300 MB. Above 100 MB, reading the file and writing the briefing take longer.
        </p>
      </div>

      {phase.kind === 'reading' && (
        <p role="status" data-loading className="type-small text-ink-2">
          {phase.step}
        </p>
      )}
      {phase.kind === 'failed' && (
        <div role="alert" data-testid="open-failure">
          <Status tone="critical">{phase.message}</Status>
        </div>
      )}
    </div>
  );
}

function Opened({ workspace, onAnother }: { workspace: Workspace; onAnother: () => void }) {
  return (
    <div className="flex flex-col items-start gap-6" data-testid="file-open">
      <div className="flex flex-col gap-4">
        <h1 className="type-h2 break-all text-ink">{workspace.name} is open</h1>
        <p className="type-prose text-ink-2">
          It was read in this browser and nothing was sent. It stays open until you close or reload
          the page, and you can switch back to it from the workspace menu at the top.
        </p>
        {workspace.file?.warning && <Status tone="caution">{workspace.file.warning}</Status>}
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <Link
          href={viewHref(workspace.id, 'briefing')}
          className={buttonClass('primary', 'no-underline')}
        >
          Read the briefing
        </Link>
        <Button variant="quiet" onClick={onAnother}>
          Open another file
        </Button>
      </div>
    </div>
  );
}
