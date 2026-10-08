// Reading and writing a dictionary as YAML. A problem is reported with the
// line it is on, whether the YAML itself is broken or a value is wrong for
// the schema, so the metrics screen can point at it (FR-14).

import { LineCounter, isNode, parseDocument, stringify } from 'yaml';
import { type SemanticModel, semanticModelSchema } from './types';

export interface YamlProblem {
  /** 1-based; 0 when the problem has no place in the text. */
  line: number;
  /** Dotted path to the value, such as `metrics.2.agg`; empty for syntax. */
  path: string;
  message: string;
}

export type YamlResult =
  { ok: true; model: SemanticModel } | { ok: false; problems: YamlProblem[] };

export function parseModelYaml(text: string): YamlResult {
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter, prettyErrors: true });
  if (doc.errors.length > 0) {
    return {
      ok: false,
      problems: doc.errors.map((e) => ({
        line: e.linePos?.[0].line ?? 0,
        path: '',
        // The line is reported separately, so drop the library's own position.
        message: e.message.split('\n')[0].replace(/ at line \d+, column \d+:?$/, ''),
      })),
    };
  }

  const parsed = semanticModelSchema.safeParse(doc.toJS());
  if (parsed.success) return { ok: true, model: parsed.data };

  const lineOf = (path: PropertyKey[]): number => {
    // Walk up until a node with a place in the text is found: a missing key
    // has none, so it is reported on the line of the map that lacks it.
    for (let n = path.length; n >= 0; n--) {
      const node: unknown = doc.getIn(path.slice(0, n), true);
      if (isNode(node) && node.range) return lineCounter.linePos(node.range[0]).line;
    }
    return 0;
  };
  const problems = parsed.error.issues.map((issue) => ({
    line: lineOf(issue.path),
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
  problems.sort((a, b) => a.line - b.line);
  return { ok: false, problems };
}

export function modelToYaml(model: SemanticModel): string {
  return stringify(model, { lineWidth: 0 });
}
