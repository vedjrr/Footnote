// npm run eval -- --mode <keyless|ai|baseline> [--set dev|holdout] [--live]
// (evals.md §6). Writes eval/results/<mode>-<set>.json and summary.json, and
// exits non-zero when a figure falls below eval/thresholds.json.

import { parseArgs } from 'node:util';
import { DATASETS, SPLITS, type Split, loadGoldens } from './goldens';
import { keylessAnswerer } from './keyless';
import {
  type Answerer,
  MODES,
  type Mode,
  buildRunFile,
  gitState,
  openDatasets,
  runEval,
  writeResults,
} from './run';
import type { Headline } from './score';
import { breaches, loadThresholds } from './thresholds';

const { values } = parseArgs({
  options: {
    mode: { type: 'string' },
    set: { type: 'string', default: 'dev' },
    live: { type: 'boolean', default: false },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const mode = values.mode as Mode;
const set = values.set as Split;
if (!MODES.includes(mode)) fail(`--mode must be one of ${MODES.join(', ')}`);
if (!SPLITS.includes(set)) fail(`--set must be one of ${SPLITS.join(', ')}`);
if (values.live && mode === 'keyless') fail('--live applies to ai and baseline runs only');

const answerers: Partial<Record<Mode, Answerer>> = { keyless: keylessAnswerer };
const answerer: Answerer =
  answerers[mode] ?? fail(`The ${mode} answerer is not built yet (T54, T55).`);

const pct = (v: number | null) => (v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`);
const line = (name: string, h: Headline) =>
  `${name.padEnd(14)} ${String(h.questions).padStart(3)}  correct ${String(h.correct).padStart(3)}  ` +
  `wrong ${h.wrong}  over-confident ${h.overConfident}  over-cautious ${h.overCautious}  error ${h.error}`;

async function main() {
  const goldens = loadGoldens([set]);
  const git = gitState();
  const datasets = await openDatasets(DATASETS);
  try {
    const records = await runEval(answerer, goldens, datasets);
    const engineVersion = await datasets.get('retail')!.engine.engineVersion();
    const run = buildRunFile(
      {
        mode,
        set,
        runAt: new Date().toISOString(),
        commit: git.commit,
        dirty: git.dirty,
        modelId: answerer.modelId,
        engineVersion,
      },
      records,
    );
    const path = writeResults(run);
    const h = run.headline;

    console.log(
      `${mode} on ${set}: ${goldens.length} questions, commit ${git.commit}${git.dirty ? ' (dirty)' : ''}`,
    );
    // Holdout prints totals only, so its failures are not read while building (§3.2).
    if (set === 'dev') {
      for (const [category, ch] of Object.entries(run.byCategory)) console.log(line(category, ch));
      for (const r of records.filter((r) =>
        ['wrong', 'over-confident', 'error'].includes(r.label),
      )) {
        console.log(`  ${r.id} ${r.label}: ${r.error ?? r.reason}`);
      }
    }
    console.log(line('total', h));
    console.log(
      `correct rate ${pct(h.correctRate)}, wrong-answer rate ${pct(h.wrongAnswerRate)}, ` +
        `coverage ${pct(h.coverage)}, raw SQL share ${pct(h.rawSqlShare)}, model calls ${h.modelCalls}`,
    );
    console.log(`wrote ${path} and summary.json`);

    const below = breaches(h, loadThresholds(), mode, set);
    if (below.length > 0) fail(`Below eval/thresholds.json:\n  ${below.join('\n  ')}`);
  } finally {
    for (const d of datasets.values()) await d.engine.close();
  }
}

void main();
