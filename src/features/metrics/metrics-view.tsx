'use client';

// The metrics screen (FR-13, FR-14): the dictionary Footnote reads this data
// with, edited in place. Every edit goes through core/model/edit.ts, which
// checks it against the schema, and lands in the workspace store, so the
// briefing and questions use it straight away and it lasts until the page
// is closed.

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  AGGREGATION_WORDS,
  DIRECTION_WORDS,
  dependents,
  describeMetric,
  formatWords,
  metricFormula,
} from '@/core/model/describe';
import {
  type EditResult,
  addRatio,
  editDimension,
  editMetric,
  hideDimension,
  removeMetric,
  showColumn,
} from '@/core/model/edit';
import type { Aggregation, Dimension, Direction, Metric, SemanticModel } from '@/core/model/types';
import { FileNotOpen, FileNotOpenGlance } from '@/features/workspace/file-not-open';
import { GlancePaper } from '@/features/workspace/glance-paper';
import {
  setModel,
  useWorkspace,
  type LoadedSample,
  type Workspace,
} from '@/features/workspace/workspace-store';
import { WorkspacePage } from '@/features/workspace/workspace-page';
import { Button } from '@/ui/button';
import { Field } from '@/ui/field';
import { Icon } from '@/ui/icon';
import { Status } from '@/ui/notice';
import { Rule } from '@/ui/rule';
import { Select } from '@/ui/select';
import { YamlActions } from './yaml-actions';

const GRAIN_WORDS = {
  day: 'days',
  week: 'weeks',
  month: 'months',
  quarter: 'quarters',
  year: 'years',
};

const AGG_OPTIONS = (['sum', 'avg', 'median', 'min', 'max', 'count_distinct'] as Aggregation[]).map(
  (value) => ({ value, label: AGGREGATION_WORDS[value] }),
);

const DIRECTION_OPTIONS = (['higher_better', 'lower_better', 'neutral'] as Direction[]).map(
  (value) => ({ value, label: DIRECTION_WORDS[value] }),
);

export function MetricsView({ workspaceId }: { workspaceId: string }) {
  const { workspace, state } = useWorkspace(workspaceId);
  const data = state.status === 'ready' ? state.data : null;

  if (!workspace || state.status === 'missing')
    return (
      <WorkspacePage glance={<FileNotOpenGlance />} noteTitle={() => ''} paper={() => null}>
        <FileNotOpen />
      </WorkspacePage>
    );

  return (
    <WorkspacePage
      glance={<GlancePaper workspace={workspace} data={data} marks={false} />}
      noteTitle={() => ''}
      paper={() => null}
    >
      <div className="flex flex-col gap-4">
        <h1 className="type-h2 text-ink">Metrics</h1>
        {state.status === 'loading' && (
          <p role="status" data-loading className="type-small text-ink-2">
            {state.step}
          </p>
        )}
        {state.status === 'error' && (
          <div className="flex flex-col items-start gap-4">
            <Status tone="critical">
              The metrics for {workspace.name} did not load. {state.message}. Reload to try again.
            </Status>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </div>
        )}
        {data && <Dictionary workspace={workspace} data={data} />}
      </div>
    </WorkspacePage>
  );
}

function Dictionary({ workspace, data }: { workspace: Workspace; data: LoadedSample }) {
  const model = data.model;
  const [message, setMessage] = useState('');

  /** Applies an edit; returns the sentence to show if it was refused. */
  const apply = (result: EditResult, done: string): string | null => {
    if (!result.ok) return result.message;
    setModel(workspace.id, result.model);
    setMessage(done);
    return null;
  };

  return (
    <>
      <p className="max-w-[66ch] type-prose text-ink-2">
        These definitions are how Footnote reads {workspace.file ? 'this file' : workspace.name}.
        The briefing and every answer use them, so a change here applies to the next one.
      </p>
      <YamlActions
        workspace={workspace}
        data={data}
        onLoaded={(next, text) => {
          setModel(workspace.id, next);
          setMessage(text);
        }}
      />
      <p role="status" aria-live="polite" className="min-h-5 type-small text-ink-2">
        {message}
      </p>

      <Section id="metrics-list" title="Metrics">
        <ul className="flex flex-col">
          {model.metrics.map((m) => (
            <MetricRow key={m.id} model={model} metric={m} apply={apply} />
          ))}
        </ul>
      </Section>

      <Section id="add-metric" title="Add a metric">
        <AddRatio model={model} apply={apply} />
      </Section>

      <Section id="dimensions" title="Columns to split by">
        {model.dimensions.length === 0 ? (
          <p className="type-body text-ink-2">
            No column in this data groups the rows, so answers show totals only. Bring back a hidden
            column below if one should.
          </p>
        ) : (
          <ul className="flex flex-col">
            {model.dimensions.map((d) => (
              <DimensionRow key={d.id} model={model} dimension={d} apply={apply} />
            ))}
          </ul>
        )}
      </Section>

      <Section id="hidden" title="Hidden columns">
        <HiddenColumns model={model} original={data.original} apply={apply} />
      </Section>

      <Section id="time" title="Time">
        <p className="max-w-[66ch] type-body text-ink">
          {model.time ? (
            <>
              {model.time.label} (column {model.time.column}) dates each row. Charts over time show{' '}
              {GRAIN_WORDS[model.time.defaultGrain]} unless you ask for another period.
            </>
          ) : (
            'No column holds dates, so Footnote cannot compare periods. Answers show totals.'
          )}
        </p>
      </Section>
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8 flex flex-col gap-4">
      <Rule kind="section" />
      <h2 id={id} className="type-h2 text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

type Apply = (result: EditResult, done: string) => string | null;

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-1 type-small">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-ink-3">{term}</dt>
          <dd className="text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const synonymsText = (s: string[]) => (s.length ? s.join(', ') : 'No other names yet');

/** Escape cancels an edit form. */
function escape(e: KeyboardEvent, cancel: () => void) {
  if (e.key === 'Escape') {
    e.stopPropagation();
    cancel();
  }
}

function MetricRow({
  model,
  metric,
  apply,
}: {
  model: SemanticModel;
  metric: Metric;
  apply: Apply;
}) {
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const close = () => {
    setEditing(false);
    requestAnimationFrame(() => editButton.current?.focus());
  };

  return (
    <li
      className="flex flex-col gap-3 border-b border-rule py-6 first:pt-2"
      data-metric={metric.id}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="type-body font-medium text-ink">{metric.label}</h3>
        {!editing && (
          <Button ref={editButton} variant="quiet" onClick={() => setEditing(true)}>
            Edit<span className="sr-only"> {metric.label}</span>
          </Button>
        )}
      </div>
      {editing ? (
        <MetricForm model={model} metric={metric} apply={apply} close={close} />
      ) : (
        <>
          <p className="max-w-[66ch] type-small text-ink-2">{describeMetric(model, metric)}</p>
          <Facts
            rows={[
              ['Formula', metricFormula(model, metric)],
              ['Shown as', formatWords(metric.format)],
              ['Direction', DIRECTION_WORDS[metric.direction]],
              ['Also called', synonymsText(metric.synonyms)],
            ]}
          />
        </>
      )}
    </li>
  );
}

function MetricForm({
  model,
  metric,
  apply,
  close,
}: {
  model: SemanticModel;
  metric: Metric;
  apply: Apply;
  close: () => void;
}) {
  const [label, setLabel] = useState(metric.label);
  const [agg, setAgg] = useState<Aggregation | null>(
    metric.kind === 'simple' && metric.column !== null ? metric.agg : null,
  );
  const [direction, setDirection] = useState(metric.direction);
  const [synonyms, setSynonyms] = useState(metric.synonyms);
  const [error, setError] = useState<string | null>(null);
  const users = dependents(model, metric.id);

  const save = () => {
    const refused = apply(
      editMetric(model, metric.id, {
        label,
        direction,
        synonyms,
        ...(agg !== null && { agg }),
      }),
      `Saved ${label.trim()}.`,
    );
    if (refused) setError(refused);
    else close();
  };

  return (
    <form
      className="flex flex-col gap-4"
      onKeyDown={(e) => escape(e, close)}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Field
        label="Name"
        value={label}
        autoFocus
        onChange={(e) => setLabel(e.target.value)}
        className="max-w-sm"
      />
      <div className="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
        {agg !== null && (
          <Select
            label="How it adds up"
            value={agg}
            options={AGG_OPTIONS}
            onChange={(e) => setAgg(e.target.value as Aggregation)}
          />
        )}
        <Select
          label="Direction"
          value={direction}
          options={DIRECTION_OPTIONS}
          onChange={(e) => setDirection(e.target.value as Direction)}
        />
      </div>
      <SynonymsEditor synonyms={synonyms} onChange={setSynonyms} />
      {error && <Status tone="critical">{error}</Status>}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit">Save</Button>
        <Button variant="quiet" onClick={close}>
          Cancel
        </Button>
        <span className="flex-1" />
        <Button
          variant="quiet"
          disabled={users.length > 0}
          title={
            users.length > 0 ? `Used by ${users.map((u) => u.label).join(' and ')}` : undefined
          }
          onClick={() => {
            const refused = apply(removeMetric(model, metric.id), `Removed ${metric.label}.`);
            if (refused) setError(refused);
          }}
        >
          Remove metric
        </Button>
      </div>
      {users.length > 0 && (
        <p className="type-small text-ink-3">
          {users.map((u) => u.label).join(' and ')} {users.length === 1 ? 'uses' : 'use'} this
          metric, so it cannot be removed.
        </p>
      )}
    </form>
  );
}

function SynonymsEditor({
  synonyms,
  onChange,
}: {
  synonyms: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const word = draft.trim();
    if (!word) return;
    if (!synonyms.some((s) => s.toLowerCase() === word.toLowerCase())) {
      onChange([...synonyms, word]);
    }
    setDraft('');
  };
  return (
    <fieldset className="flex max-w-xl flex-col gap-2">
      <legend className="mb-2 type-small font-medium text-ink">Other names people use</legend>
      {synonyms.length > 0 ? (
        <ul className="flex flex-col">
          {synonyms.map((s) => (
            <li
              key={s}
              className="flex items-center justify-between gap-4 border-b border-rule py-1 type-small text-ink"
            >
              <span>{s}</span>
              <Button variant="quiet" onClick={() => onChange(synonyms.filter((x) => x !== s))}>
                Remove<span className="sr-only"> {s}</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="type-small text-ink-3">None yet.</p>
      )}
      <div className="flex items-end gap-2">
        <Field
          label="Add a name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          className="flex-1"
        />
        <Button onClick={add} disabled={!draft.trim()}>
          <Icon name="plus" />
          Add
        </Button>
      </div>
    </fieldset>
  );
}

function AddRatio({ model, apply }: { model: SemanticModel; apply: Apply }) {
  const options = model.metrics.map((m) => ({ value: m.id, label: m.label }));
  const [label, setLabel] = useState('');
  const [numerator, setNumerator] = useState(options[0]?.value ?? '');
  const [denominator, setDenominator] = useState(options[1]?.value ?? options[0]?.value ?? '');
  const [error, setError] = useState<string | null>(null);
  // Removed metrics can leave a stale choice; fall back to the first one.
  const num = options.some((o) => o.value === numerator) ? numerator : (options[0]?.value ?? '');
  const den = options.some((o) => o.value === denominator)
    ? denominator
    : (options[0]?.value ?? '');

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const refused = apply(
          addRatio(model, { label, numerator: num, denominator: den }),
          `Added ${label.trim()}.`,
        );
        setError(refused);
        if (!refused) setLabel('');
      }}
    >
      <p className="max-w-[66ch] type-body text-ink-2">
        A new metric divides one metric by another, worked out from the totals of each, such as cost
        by revenue.
      </p>
      <Field
        label="Name"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="max-w-sm"
      />
      <div className="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Divide"
          value={num}
          options={options}
          onChange={(e) => setNumerator(e.target.value)}
        />
        <Select
          label="By"
          value={den}
          options={options}
          onChange={(e) => setDenominator(e.target.value)}
        />
      </div>
      {error && <Status tone="critical">{error}</Status>}
      <div>
        <Button type="submit">
          <Icon name="plus" />
          Add metric
        </Button>
      </div>
    </form>
  );
}

const ROLE_WORDS: Record<Dimension['role'], string> = {
  category: 'Groups rows, for charts and splits',
  entity: 'One value per item, such as a customer; counted, not charted',
};

function DimensionRow({
  model,
  dimension,
  apply,
}: {
  model: SemanticModel;
  dimension: Dimension;
  apply: Apply;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(dimension.label);
  const [synonyms, setSynonyms] = useState(dimension.synonyms);
  const [error, setError] = useState<string | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const close = () => {
    setEditing(false);
    setError(null);
    requestAnimationFrame(() => editButton.current?.focus());
  };
  const open = () => {
    setLabel(dimension.label);
    setSynonyms(dimension.synonyms);
    setEditing(true);
  };

  return (
    <li
      className="flex flex-col gap-3 border-b border-rule py-6 first:pt-2"
      data-dimension={dimension.id}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="type-body font-medium text-ink">{dimension.label}</h3>
        {!editing && (
          <div className="flex gap-4">
            <Button ref={editButton} variant="quiet" onClick={open}>
              Edit<span className="sr-only"> {dimension.label}</span>
            </Button>
            <Button
              variant="quiet"
              onClick={() =>
                setError(apply(hideDimension(model, dimension.id), `Hid ${dimension.label}.`))
              }
            >
              Hide<span className="sr-only"> {dimension.label}</span>
            </Button>
          </div>
        )}
      </div>
      {editing ? (
        <form
          className="flex flex-col gap-4"
          onKeyDown={(e) => escape(e, close)}
          onSubmit={(e) => {
            e.preventDefault();
            const refused = apply(
              editDimension(model, dimension.id, { label, synonyms }),
              `Saved ${label.trim()}.`,
            );
            if (refused) setError(refused);
            else close();
          }}
        >
          <Field
            label="Name"
            value={label}
            autoFocus
            onChange={(e) => setLabel(e.target.value)}
            className="max-w-sm"
          />
          <SynonymsEditor synonyms={synonyms} onChange={setSynonyms} />
          {error && <Status tone="critical">{error}</Status>}
          <div className="flex gap-4">
            <Button type="submit">Save</Button>
            <Button variant="quiet" onClick={close}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <Facts
            rows={[
              ['Column', dimension.column],
              ['Use', ROLE_WORDS[dimension.role]],
              [
                'AI assist',
                dimension.private
                  ? 'Never sees its values'
                  : 'May see its values when AI assist is on',
              ],
              ['Also called', synonymsText(dimension.synonyms)],
            ]}
          />
          {error && <Status tone="critical">{error}</Status>}
        </>
      )}
    </li>
  );
}

function HiddenColumns({
  model,
  original,
  apply,
}: {
  model: SemanticModel;
  original: SemanticModel;
  apply: Apply;
}) {
  const [error, setError] = useState<string | null>(null);
  if (model.hidden.length === 0)
    return (
      <p className="type-body text-ink-2">No columns are hidden. Hide one above to leave it out.</p>
    );
  return (
    <>
      <p className="max-w-[66ch] type-body text-ink-2">
        Footnote leaves these columns out of answers and the briefing.
      </p>
      <ul className="flex flex-col">
        {model.hidden.map((column) => {
          const restorable = original.dimensions.some((d) => d.column === column);
          return (
            <li
              key={column}
              className="flex items-center justify-between gap-4 border-b border-rule py-3 type-small"
            >
              <span className="text-ink">{column}</span>
              {restorable ? (
                <Button
                  variant="quiet"
                  onClick={() =>
                    setError(apply(showColumn(model, original, column), `Brought back ${column}.`))
                  }
                >
                  Show<span className="sr-only"> {column}</span>
                </Button>
              ) : (
                <span className="text-ink-3">An identifier or free text</span>
              )}
            </li>
          );
        })}
      </ul>
      {error && <Status tone="critical">{error}</Status>}
    </>
  );
}
