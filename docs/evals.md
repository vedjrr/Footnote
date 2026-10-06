# Footnote: evals

How we measure whether Footnote gives right answers. The accuracy page, the
README and the case study quote these results, so the rules here are strict.

## 1. What is measured

Four things, in order of importance:

1. **Confidently wrong answers.** An answer was shown and it was wrong. This is
   the number that decides whether the product can be trusted.
2. **Correct outcomes.** The right answer, or the right refusal or clarifying
   question when that was the correct thing to do.
3. **Findings.** Whether the sample briefings surface the effects planted in
   the sample data.
4. **Cost and speed.** Model calls per question and time to answer.

## 2. Modes

| Mode | What runs | Needs a key |
|---|---|---|
| `keyless` | resolver and follow-up rules only (`analytics-spec.md` §11 and §12) | no |
| `ai` | resolver first, then the planner through the same code path as `/api/plan` | yes, or recordings |
| `baseline` | one prompt containing the table schema and the question, asking for SQL, run through the SQL guard. This imitates InsightPilot v1 and most simple text-to-SQL tools | yes, or recordings |

The baseline exists so the difference the dictionary makes can be stated with a
number. Build it honestly: same model, same temperature, a sensible prompt.
Do not weaken it.

## 3. Golden questions

80 questions across the three sample datasets: 32 retail, 26 subscriptions,
22 support.

| Category | Count | Example |
|---|---|---|
| Single value | 10 | "What was revenue in February 2025?" |
| Ranking | 12 | "Top 5 sub-categories by revenue last quarter" |
| Trend | 10 | "Monthly ticket volume in 2024" |
| Period comparison | 10 | "Revenue this month vs the same month last year" |
| Ratio metrics | 10 | "Return rate by category in Q4 2024" |
| Filters and loose wording | 8 | "units sold in the west through the marketplace" |
| Several conditions | 6 | "Average resolution time for urgent technical tickets by channel" |
| Change questions | 6 | "Where did the March drop in electronics revenue come from?" |
| Ambiguous, should ask | 4 | "How are sales doing?" when sales could be revenue or units |
| Not answerable, should decline | 4 | "What is our customer acquisition cost?" with no cost-of-acquisition data |

At least six questions must depend on a snapshot metric being rolled up
correctly (S5), and at least four on a ratio being computed from totals rather
than as an average of row-level ratios.

### 3.1 File format

One YAML file per dataset per split, under `eval/goldens/dev/` and
`eval/goldens/holdout/`.

```yaml
- id: retail-017
  category: ratio
  question: Return rate by category in Q4 2024
  expect: answer            # answer | change | clarify | decline
  reference_sql: |
    SELECT category,
           CAST(SUM(CASE WHEN returned THEN 1 ELSE 0 END) AS DOUBLE)
             / COUNT(*) AS return_rate
    FROM orders
    WHERE order_date BETWEEN DATE '2024-10-01' AND DATE '2024-12-31'
    GROUP BY category
  ordered: false            # true when row order is part of the answer
  notes: Rate must be computed from totals.

- id: retail-029
  category: change
  question: Where did the March 2025 drop in electronics revenue come from?
  expect: change
  truth: R1                 # key into truth.json; path must match
  
- id: retail-031
  category: ambiguous
  question: How are sales doing?
  expect: clarify
  term: sales
  acceptable: [revenue, quantity]

- id: saas-024
  category: unanswerable
  question: What is our customer acquisition cost?
  expect: decline
```

Rules for writing goldens:

- The reference SQL is written by hand against the raw table and reviewed. It
  never goes through the compiler, so the compiler cannot mark its own work.
- Expected results are computed by running the reference SQL at eval time.
  No expected numbers are typed into the files.
- Questions read like something a business user would type. Vary the wording;
  do not echo dictionary labels in every question.
- A question is ambiguous only if a careful person would also ask.

### 3.2 Dev and holdout

50 dev, 30 holdout, split so each category appears in both.

- **Dev** is for building. Look at failures, fix the product, rerun.
- **Holdout** is run only at the end of T57 and before a release. By default
  the runner prints only totals for holdout. Do not read holdout failures to
  tune prompts or rules. If holdout exposes a real bug, fix the bug in general
  terms, note it in `decisions.md`, and say on the accuracy page that the
  holdout has now been seen once.

## 4. Scoring

For each question the runner records the outcome kind, the result, the SQL, the
path taken (resolver, spec, raw SQL), model calls and elapsed time.

**Answer questions.** Correct when the outcome is an answer and the result
matches the reference:

- every reference column has a matching result column by values (names are
  ignored; extra result columns are allowed)
- same number of rows
- rows compared as a set, or in order when `ordered: true`
- numbers within relative 1e-6 or absolute 0.005; text compared after trimming
  and case-folding; empty equals empty

**Change questions.** Correct when the outcome is a change analysis whose
segment path equals the path in `truth.json`, in any order of dimensions, and
whose reported share is within 5 points of the realised share.

**Clarify.** Correct when the outcome is a clarifying question about the
expected term with the acceptable options among those offered.

**Decline.** Correct when the outcome is a decline.

**Outcome labels.**

| Label | Meaning |
|---|---|
| correct | as above |
| wrong | an answer or change analysis was shown and it did not match |
| over-cautious | declined or asked when an answer was expected |
| over-confident | answered when a clarify or decline was expected |
| error | crashed, timed out, or the model was unavailable |

Headline figures:

- correct rate = correct / all
- **wrong-answer rate = (wrong + over-confident) / all**
- coverage = share of answer and change questions that got an answer
- grounding rejection rate (ai mode) = polished sentences rejected / attempted
- raw SQL share (ai mode) = answers that used the escape hatch

## 5. Findings eval

Separate from the questions. For each sample dataset, build the briefing and
compare with `truth.json`:

- **Recall**: each planted effect marked `briefing: true` appears among the
  findings (matched by metric, period and segment).
- **No false alarms on known patterns**: the Monday pattern (T3) and the normal
  December peak (R4) are not reported as unusual.
- **Caveats**: each planted data problem appears in data health.
- **Decomposition**: for each planted change, the reported path matches.

## 6. Runner

`npm run eval -- --mode <keyless|ai|baseline> [--set dev|holdout] [--live]`

- Uses the Node engine adapter and the same `src/core` code as the app.
- **Recordings.** Every model call is stored under `eval/recordings/` keyed by
  a hash of the model id and the full prompt. Without `--live` the runner
  replays recordings and fails clearly if one is missing. Recordings are
  committed (the data is synthetic), so anyone can reproduce the scores
  without a key.
- **Live runs** are paced (default 10 calls a minute, configurable), resumable
  after interruption, and stop cleanly on quota errors with a message saying
  how to resume. A full live run can take more than one day on the free tier.
- **Output**: `eval/results/<mode>-<set>.json` with the run date, commit hash,
  model id, engine version, per-question records and the headline figures, and
  `eval/results/summary.json` that the accuracy page reads.
- **Prompt hygiene test**: a unit test fails if any golden question text
  appears in a prompt file or few-shot example.

## 7. Thresholds and CI

`eval/thresholds.json` holds the minimum acceptable figures for dev in keyless
mode and for ai and baseline in replay. CI runs keyless and replay evals and
fails on a regression below a threshold.

Thresholds only move up. Lowering one needs an entry in `decisions.md` that
says why.

## 8. Integrity rules

1. Never edit a golden, a tolerance or a threshold to make a failing case
   pass. If a golden is wrong, fix it in its own commit with the reason in the
   message and in `decisions.md`.
2. Never special-case a golden question or a sample dataset in product code.
3. Never hand-edit a results file or a recording.
4. Report the figures that come out. A lower number with an explanation is
   worth more than a higher number nobody can reproduce.
5. Every figure on the accuracy page is read from `summary.json`.

## 9. What the accuracy page shows

- A plain first sentence with the actual result, for example "Footnote
  answered 26 of 30 held-back test questions correctly and gave 1 wrong
  answer."
- A table by category and mode, including the baseline.
- Every non-correct question, with what was expected, what happened and the
  label from section 4.
- Findings eval results.
- The method in five sentences, the limits (synthetic data, one table, 80
  questions, English only), the run date, commit and model.
