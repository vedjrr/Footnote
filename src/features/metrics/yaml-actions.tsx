'use client';

// Download the dictionary as YAML, or load one (FR-14). A file that cannot be
// used says which line is wrong; nothing changes until a file is valid.

import { useRef, useState } from 'react';
import type { SemanticModel } from '@/core/model/types';
import { modelToYaml, parseModelYaml, type YamlProblem } from '@/core/model/yaml';
import type { LoadedSample, Workspace } from '@/features/workspace/workspace-store';
import { Button } from '@/ui/button';
import { Icon } from '@/ui/icon';

const MAX_PROBLEMS = 5;

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** Columns the dictionary names that the data does not have. */
function missingColumns(model: SemanticModel, columns: string[]): string[] {
  const named = [
    ...(model.time ? [model.time.column] : []),
    ...model.dimensions.map((d) => d.column),
    ...model.metrics.flatMap((m) => (m.kind === 'simple' && m.column ? [m.column] : [])),
    ...model.hidden,
  ];
  return [...new Set(named.filter((c) => !columns.includes(c)))];
}

export function YamlActions({
  workspace,
  data,
  onLoaded,
}: {
  workspace: Workspace;
  data: LoadedSample;
  onLoaded: (model: SemanticModel, message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [problems, setProblems] = useState<{ file: string; list: YamlProblem[] } | null>(null);

  const download = () => {
    const blob = new Blob([modelToYaml(data.model)], { type: 'application/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workspace.table}-dictionary.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const load = async (file: File) => {
    const parsed = parseModelYaml(await file.text());
    if (!parsed.ok) {
      setProblems({ file: file.name, list: parsed.problems });
      return;
    }
    const model = parsed.model;
    if (model.table !== workspace.table) {
      setProblems({
        file: file.name,
        list: [
          {
            line: 0,
            path: 'table',
            message: `This dictionary is for the table ${model.table}, and this data is ${workspace.table}`,
          },
        ],
      });
      return;
    }
    const missing = missingColumns(
      model,
      data.columns.map((c) => c.name),
    );
    if (missing.length > 0) {
      setProblems({
        file: file.name,
        list: [
          {
            line: 0,
            path: '',
            message: `The data has no column called ${missing.join(' or ')}`,
          },
        ],
      });
      return;
    }
    setProblems(null);
    onLoaded(
      model,
      `Loaded ${file.name}: ${count(model.metrics.length, 'metric')} and ${count(model.dimensions.length, 'column')} to split by.`,
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4">
        <Button onClick={download}>
          <Icon name="download" />
          Download as YAML
        </Button>
        <Button onClick={() => input.current?.click()}>Load a YAML file</Button>
        <input
          ref={input}
          type="file"
          accept=".yaml,.yml,application/yaml,text/yaml"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          data-testid="yaml-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void load(file);
          }}
        />
      </div>
      {problems && (
        <div className="flex flex-col gap-2 type-small text-ink" role="alert">
          <p className="flex items-start gap-2">
            <span className="flex h-5 items-center text-critical">
              <Icon name="caution" />
            </span>
            <span>
              {problems.file} was not loaded. Fix{' '}
              {problems.list.length === 1 ? 'this line' : 'these lines'} and load it again. The
              metrics below are unchanged.
            </span>
          </p>
          <ul className="flex flex-col gap-1 pl-6">
            {problems.list.slice(0, MAX_PROBLEMS).map((p, i) => (
              <li key={i}>
                {p.line > 0 && <span className="font-medium">Line {p.line}: </span>}
                {p.message}
                {p.path && <span className="text-ink-3"> ({p.path})</span>}
              </li>
            ))}
          </ul>
          {problems.list.length > MAX_PROBLEMS && (
            <p className="pl-6 text-ink-3">And {problems.list.length - MAX_PROBLEMS} more.</p>
          )}
        </div>
      )}
    </div>
  );
}
