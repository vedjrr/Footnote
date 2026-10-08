'use client';

import Link from 'next/link';
import { useState } from 'react';
import { viewHref } from '@/features/shell/routes';
import { ACCEPT, IngestError } from '@/core/ingest/file';
import { openFile, type Workspace } from '@/features/workspace/workspace-store';
import { Button, buttonClass } from '@/ui/button';
import { DropArea } from '@/ui/drop-area';
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
  const busy = phase.kind === 'reading';

  async function read(file: File) {
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
            : `${file.name} could not be read. Try again, or save it as CSV or Parquet and try that.`,
      });
    }
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

      <DropArea
        prompt="Drop a file here, or choose one."
        chooseLabel="Choose a file"
        hint="Files up to 300 MB. Above 100 MB, reading the file and writing the briefing take longer."
        accept={ACCEPT}
        busy={busy}
        onFile={(file) => void read(file)}
      />

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
