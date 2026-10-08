'use client';

import { FileNotOpen } from './file-not-open';
import { GlancePaper } from './glance-paper';
import { useWorkspace } from './workspace-store';
import { WorkspacePage } from './workspace-page';

/** A view a later task builds: its name and one sentence on what it will hold. */
export function PlannedView({
  workspaceId,
  title,
  children,
}: {
  workspaceId: string;
  title: string;
  children: string;
}) {
  const { workspace, state } = useWorkspace(workspaceId);
  const missing = !workspace || state.status === 'missing';
  return (
    <WorkspacePage
      glance={
        workspace && (
          <GlancePaper
            workspace={workspace}
            data={state.status === 'ready' ? state.data : null}
            marks={false}
          />
        )
      }
      noteTitle={() => ''}
      paper={() => null}
    >
      {missing ? (
        <FileNotOpen />
      ) : (
        <div className="flex flex-col gap-4">
          <h1 className="type-h2 text-ink">{title}</h1>
          <p className="type-prose text-ink-2">{children}</p>
        </div>
      )}
    </WorkspacePage>
  );
}
