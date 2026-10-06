# Footnote: requirements

This file says what to build and why. How it is built is in `architecture.md`,
the maths is in `analytics-spec.md`, how it is tested is in `evals.md`, how it
looks is in `ui-ux-rules.md`, and the order of work is in `steps.md`.

## 1. What Footnote is

Footnote is an analyst that writes the briefing before you ask for it, and
shows its working for every number.

You open it (or drop in a data file) and it reads the data, works out what the
columns mean, and writes a short briefing: what changed, where the change came
from, what looks unusual, and what to be careful about. Every number in that
briefing carries a small reference mark. Selecting the mark opens the working
paper for that number: what it measures, the period and filters, the query that
ran, the rows behind it, and the checks it passed. You can then ask your own
questions and pin the useful answers into a report.

It runs in the browser. The data file never leaves the device. It needs no
account and no API key. A free Gemini key adds one thing: free-text questions
in ordinary language.

## 2. Why this replaces InsightPilot

Footnote is the second version of InsightPilot (repo `vedjrr/insightpilot`).
These are the problems found in a review of the v1 code, and what Footnote does
about each. Keep this table honest: it becomes the "before and after" story in
the case study.

| What v1 did | Why it was a problem | What Footnote does |
|---|---|---|
| One SQL query per question, through a fixed pipeline, described as an autonomous agent | "Why did revenue dip in March?" was answered from a single query, so the answer was a guess with a chart | Change questions run a defined decomposition across every dimension (`analytics-spec.md` §6) |
| No tests and no accuracy measurement | Nobody could say how often it was right | A scored set of 80 questions, a naive baseline to compare against, and a public accuracy page |
| The model wrote raw SQL from column names | Metric meaning was re-guessed on every question; invented columns were possible | A metrics dictionary. The model picks from defined metrics and dimensions and the app compiles the SQL |
| The model wrote the numbers in the answer | Figures in the prose could differ from the query result | Numbers come only from query results. Any model text is checked against them or thrown away |
| A keyword list decided what counted as a data question, using retail words | It only worked on the demo dataset | Questions are resolved against each dataset's own dictionary |
| Each question was independent | "Now by region" did not work | Follow-ups edit the previous query |
| Blank chat, user must type first | Nothing to see until you do some work | The briefing is there on load |
| FastAPI on Render, Postgres on Neon | 30 to 60 second cold starts, uploaded files stored on a server, two deploys | No backend. DuckDB runs in the browser |
| Animated WebGL ribbon background | Decoration unrelated to the product | Removed. See `ui-ux-rules.md` |

## 3. Who it is for

**Priya, an operations analyst (primary).** She gets an export on Monday
morning and has an hour to tell her manager what changed last month. She knows
Excel well and some SQL. She does not trust numbers she cannot trace, because
she is the one who gets asked "where did that come from?".

**Arjun, her manager (reads the output).** He reads the exported report on his
phone between meetings. He wants three findings and the caveats, in plain
sentences.

**The reviewer (hiring manager or interviewer).** They give the site about
three minutes. They want to see that it works without setup, that the builder
understands the analysis, and that claims are backed by evidence.

Jobs to be done:

- When I receive a new export, I want to know what changed and where, so I can
  brief my manager without building a workbook first.
- When someone questions a number, I want to show exactly how it was computed,
  so the conversation is about the business and not about my spreadsheet.
- When I have a specific question, I want to ask it and see how it was
  interpreted, so I can correct a misreading before it becomes a wrong answer.

## 4. Product principles

1. **Useful before any input.** The first screen is a finished briefing.
2. **Every number is traceable.** If a number has no working paper, it does not
   appear.
3. **Say where, not why.** The data can show where a change is concentrated. It
   cannot show the cause. The product never claims a cause.
4. **Wrong is worse than "I can't answer that".** Declining and asking are
   valid outcomes and are scored as such.
5. **Free and private by default.** No key, no account, no upload.
6. **Measured claims only.** Anything said about accuracy comes from the eval
   results file.

## 5. Functional requirements

Priority uses MoSCoW: Must, Should, Could. Version 1.0 is every Must and every
Should. Each requirement has an ID that tasks in `steps.md` refer to.

### A. Start

**FR-01 Demo briefing on first load (Must).**
As a first-time visitor I see a complete briefing for a sample dataset without
doing anything.
- Given a first visit to `/`, when the page loads, then the retail sample
  briefing is in the initial HTML, with headline finding, chart and marks.
- A one-sentence notice says this is synthetic sample data and that you can use
  your own file. It can be dismissed and stays dismissed.
- Three sample datasets are available: retail orders, SaaS subscriptions,
  support tickets.

**FR-02 Use your own file (Must).**
As Priya I can drop or choose a CSV, TSV, Parquet or JSON file and get a
briefing for it.
- The file is read in the browser. No network request carries its contents.
- Progress shows the real step in words ("Reading 48,210 rows").
- A file that cannot be read produces a message naming the problem and the fix.
- Files over the soft limit show a warning; over the hard limit are refused
  with the reason (limits in NFR-07).

**FR-03 Switch workspace (Must).** I can switch between sample datasets and my
own files from the top bar. Each workspace keeps its own questions and report.

**FR-04 My workspaces persist (Should).** My own files, dictionary edits,
questions and report are still there when I come back on the same browser. I
can delete a workspace, which removes its data from the device.

### B. Understand the data

**FR-10 Column profile (Must).** For every column: type, share of empty
values, number of distinct values, range or most common values.

**FR-11 Data health (Must).** A list of data problems, most serious first,
each with a count, example rows and the effect on the briefing. Checks are
listed in `analytics-spec.md` §3. Problems are reported, never silently fixed.

**FR-12 Metrics dictionary, inferred (Must).** Footnote proposes metrics (what
to measure), dimensions (what to split by) and the time column, with plain
names, without any input.
- On the three sample datasets the inferred roles match the hand-written
  dictionary for at least 90% of columns.

**FR-13 Edit the dictionary (Must).** I can rename a metric, change how it is
aggregated, set whether higher is better, add synonyms, hide a column, and add
a ratio metric from two existing ones. Edits apply to the briefing and to
questions straight away.

**FR-14 Export and import the dictionary (Should).** As YAML.

### C. Briefing

**FR-20 Headline and key changes (Must).** The briefing leads with the single
most notable finding and lists up to five further changes. Each says whether
the change is unusually large or within the normal range for that metric
(`analytics-spec.md` §5.1).

**FR-21 Where the change came from (Must).** For the headline change, the
briefing names the segment where it is concentrated, up to three dimensions
deep, with the share of the change it accounts for (§6.1).

**FR-22 Mix versus rate (Should).** For ratio metrics (margin, return rate,
breach rate), the briefing says whether the change came from segment rates
moving or from the mix of segments shifting (§6.2).

**FR-23 Unusual points, runs and concentration (Should).** Days or weeks far
outside the usual pattern, metrics that moved the same way several periods
running, and how concentrated a metric is among customers or products (§5.2 to
§5.4).

**FR-24 Caveats (Must).** A "Before you rely on this" section lists the data
health problems that affect the figures shown, and says when the latest period
is incomplete.

**FR-25 Suggested questions (Should).** Up to three follow-up questions per
finding, generated from the dictionary, that run when selected.

### D. Ask

**FR-30 Composer (Must).** I can build a question from parts with
autocomplete: metric, split, period, filter, comparison. Keyboard only is
enough. No AI is involved.

**FR-31 Simple phrases without AI (Must).** Typing "revenue by region last 3
months" works with AI assist off. When only part of a phrase is understood,
the composer opens with the understood parts filled in.

**FR-32 Free-text questions with AI assist (Should).** With AI assist on, I
can ask in ordinary language. Depends on an optional Gemini key (FR-45).

**FR-33 Interpretation shown and editable (Must).** Every answer shows how the
question was read, as a row of labelled parts ("Metric: Revenue", "Split by:
Region", "Period: Jan to Mar 2025"). Selecting a part lets me change it and the
answer updates.

**FR-34 Follow-ups keep context (Must).** "Now by channel", "only online",
"compare with last year" modify the previous question.

**FR-35 Clarify once, then remember (Should).** If a term could mean two
metrics ("sales" as revenue or as units), Footnote asks which, and stores the
answer as a synonym for this workspace.

**FR-36 Decline when it cannot answer (Must).** A question about something not
in the data gets a plain statement of what is missing and the closest things
that are available. No guess.

**FR-37 Change questions (Must).** "Where did the March drop in revenue come
from?" runs the same analysis as FR-21 for the named metric and period.

### E. Trust

**FR-40 Reference marks (Must).** Every computed number shown in a briefing or
answer has a reference mark. Selecting it highlights the number and opens its
working paper. Keyboard and screen reader accessible.

**FR-41 Working paper (Must).** For a number: the definition in words, the
period and filters, the result it came from, the checks, a sample of the rows
behind it, and the exact SQL that ran, with a copy button.

**FR-42 Result checks (Must).** Automatic checks on every result, shown in the
working paper: parts add up to the whole, no silent duplication, filter values
exist, period is complete, enough rows to mean something. Listed in
`analytics-spec.md` §8.

**FR-43 Grounded text (Must, when AI assist is on).** Any model-written
sentence is shown only if every number in it matches the query result.
Otherwise the template sentence is shown.

**FR-44 Accuracy page (Must).** A public page with the latest test results by
question type and mode, the baseline comparison, every failed question with
what went wrong, the method and the limits. Generated from the eval results
file.

**FR-45 AI assist is a clear choice (Must).** A control shows whether AI
assist is on. Before first use on my own file it states exactly what is sent
(question text, column and metric names, a few values of low-variety columns,
aggregated results) and to whom (Google Gemini free tier, which may use it to
improve its products). It is off by default for my own files and on for the
synthetic samples. With no key available, the control says so and everything
else still works.

### F. Report

**FR-50 Pin to a report (Should).** I can add any finding or answer to the
workspace report, reorder items with buttons, and give the report a title.

**FR-51 Export (Should).** The report exports as one self-contained HTML file
and as Markdown. In both, reference marks become numbered endnotes that carry
the definition, scope and SQL. The HTML prints cleanly to PDF.

## 6. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 Cost | Zero. No paid service and no service that needs a card on file. Hosting on Vercel Hobby, code and CI on GitHub, optional Gemini key from a Google project with no billing account attached |
| NFR-02 Privacy | Rows of a user's file never leave the browser. With AI assist off, no request carries anything derived from the file |
| NFR-03 Works without a key | Every requirement except FR-32 and the optional prose polish in FR-43 works with no API key |
| NFR-04 Speed | Sample briefing: content visible within 2.0 s on a mid-range laptop on broadband, Lighthouse performance 90 or more on desktop. Query engine ready within 5 s. A typical question on 100,000 rows answers within 1 s with AI assist off |
| NFR-05 Accessibility | WCAG 2.2 AA. Everything works by keyboard. Lighthouse accessibility 95 or more |
| NFR-06 Browsers | Current Chrome, Edge, Safari and Firefox on desktop; current Safari and Chrome on phones for reading and asking |
| NFR-07 Size limits | Warn above 100 MB or 2 million rows. Refuse above 300 MB. Confirm or revise these numbers by measurement in task T10 and record the result |
| NFR-08 Failure behaviour | Every failure has a designed state that says what happened and what to do. If AI assist fails or runs out of quota, the app carries on without it and says so once |
| NFR-09 Security | No secret in client code. API routes accept only the typed payloads in `architecture.md` §7, with size caps. Text from data files is always treated as untrusted text. Raw model SQL runs only through the guard in `architecture.md` §6.4 |
| NFR-10 Code quality | `src/core` has no UI, browser-only or Node-only imports and at least 85% line coverage. TypeScript strict. No `any` without a comment saying why |
| NFR-11 Honest claims | No accuracy, speed or usage figure appears on the site, README or case study unless a file in the repo produces it |

## 7. Out of scope for 1.0

Do not build these. If a task seems to need one, stop and ask.

- Accounts, sign-in, sharing links, collaboration
- Any server-side database or file storage
- Joining several tables (one table per workspace in 1.0)
- Excel files (CSV export covers it; revisit after 1.0)
- Live connections to databases or SaaS tools
- Dashboards you lay out yourself
- Forecasting and what-if modelling
- Scheduled briefings, alerts, email
- A language model running in the browser
- Paid tiers, billing

## 8. How we will know it worked

Targets, to be measured. Report the real number whatever it is.

| Measure | Target |
|---|---|
| Correct answers on the holdout questions, AI assist on | 85% or more |
| Confidently wrong answers, AI assist on | 5% or fewer |
| Confidently wrong answers, AI assist off | 2% or fewer |
| Questions answered with AI assist off | 40% or more of the set |
| Improvement over the naive baseline | Measured and published, whatever it is |
| Planted findings that appear in the sample briefings | 90% or more |
| Change analysis names the planted segment | 5 of 6 or more |
| First-time visitor finds the query behind a number | Within 2 selections from the briefing |
| Lighthouse (desktop) performance / accessibility | 90 / 95 or more |

## 9. Assumptions and risks

| Risk | Effect | Response |
|---|---|---|
| Gemini free-tier limits are not published and can change | AI assist or live eval runs may stall | AI assist is optional. Eval runs are paced, resumable and recorded for replay (`evals.md` §6) |
| The public demo's key could be drained by a script | AI assist stops for the day | The key is on a project with no billing, so the cost stays zero. The route accepts only typed payloads. The app falls back cleanly |
| DuckDB-WASM download is several megabytes | Slow first interaction | Sample briefings are computed at build time and served as HTML. The engine loads in the background |
| Column roles are inferred wrongly on unfamiliar data | A misleading briefing | Roles are shown and editable. Health checks and caveats are prominent. The briefing never hides what it assumed |
| The browser and Node builds of DuckDB differ | Evals pass while the browser misbehaves | Parity test over a shared SQL set in both (`architecture.md` §4) |
| Scope growth | 1.0 never ships | Section 7 is binding. New ideas go to `decisions.md` under "Later" |

## 10. Glossary

| Term | Meaning |
|---|---|
| Workspace | One dataset plus its dictionary, questions and report |
| Metric | Something measured, with a fixed definition, for example Revenue = sum of `revenue` |
| Dimension | A column to split or filter by, for example Region |
| Dictionary | The set of metrics, dimensions and the time column for a workspace. In code: semantic model |
| Finding | One statement in a briefing, with its numbers and evidence |
| Reference mark | The small numbered mark beside a number |
| Working paper | The evidence panel for one number |
| Plan | The structured reading of a question: a query, a change analysis, a clarifying question or a decline |
| Query spec | The structured form of a query that the compiler turns into SQL |
| AI assist | The optional use of Gemini to read free-text questions and smooth prose |
| Golden | A test question with a known correct outcome |
