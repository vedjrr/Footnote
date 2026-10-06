'use client';

import { GlancePaper } from './glance-paper';
import { useSample } from './sample-store';
import { findSample } from './samples';
import { WorkspacePage } from './workspace-page';

/** A view a later task builds: its name and one sentence on what it will hold. */
export function PlannedView({
  sampleId,
  title,
  children,
}: {
  sampleId: string;
  title: string;
  children: string;
}) {
  const sample = findSample(sampleId)!;
  const state = useSample(sample);
  return (
    <WorkspacePage
      glance={
        <GlancePaper
          sample={sample}
          data={state.status === 'ready' ? state.data : null}
          marks={false}
        />
      }
      noteTitle={() => ''}
      paper={() => null}
    >
      <div className="flex flex-col gap-4">
        <h1 className="type-h2 text-ink">{title}</h1>
        <p className="type-prose text-ink-2">{children}</p>
      </div>
    </WorkspacePage>
  );
}
