# Footnote: analytics spec

The rules and formulas behind the profile, the dictionary, the findings and the
checks. This is where correctness lives. Implement what is written; if a rule
turns out to be wrong on real data, change it here in the same commit and add a
note in `decisions.md`.

Everything in this file is deterministic and runs without a model.

## 1. Conventions

- "Period" means one unit of the chosen grain (a month, a week, a day).
- "Complete period" is defined in section 4.
- Comparisons of floating-point results use relative tolerance 1e-6 and
  absolute tolerance 0.005.
- Thresholds in this file are judgement calls, stated as constants in
  `src/core/findings/constants.ts` with a comment pointing back here. They are
  not tuned to make a test pass.
- Robust z-score (Iglewicz and Hoaglin): for a value x against a set S,
  `z = 0.6745 * (x - median(S)) / MAD(S)` where `MAD` is the median of absolute
  deviations from the median. If `MAD` is 0, use
  `z = (x - median(S)) / (1.2533 * meanAbsDev(S))`. If that is also 0, z is
  not assessed.

## 2. Profile and dictionary inference

### 2.1 Column statistics

For every column: storage type, count, empty count, distinct count, and
- numeric: min, max, mean, median, 5th and 95th percentile, share of zeros,
  share negative
- date or timestamp: min, max, number of distinct days, gaps
- text or boolean: ten most common values with counts, min and max length

One SQL statement per column family, not one per column, so a 60-column file
profiles in a handful of queries.

### 2.2 Type refinement

DuckDB's sniffed types are the start. Then:
- text where 98% or more of non-empty values parse as numbers after removing
  currency symbols, thousands separators and a trailing `%`: treat as numeric,
  record the rest as a health problem (check H7)
- text where 98% or more parse as dates in one consistent format: treat as date
- integer or text with only two distinct values among yes/no, true/false, y/n,
  0/1: boolean

### 2.3 Roles

Apply in order. First match wins.

| Role | Rule |
|---|---|
| Time | date or timestamp column with 14 or more distinct days. If several, prefer names with a word starting `date`, `created`, `month`, `day`, `time` (in that order), then the one with most distinct days |
| Identifier | distinct count is 90% or more of rows, and either the name ends in `id`, `_key`, `code`, `number` or `no`, or the column is text; also any integer column that is unique in every row |
| Entity | not an identifier; name ends in `id`, `_key`, `code`, `number` or `no`; 50 or more distinct values (for example `customer_id` on an orders table). Usable for counting distinct and for concentration, not for charts by value |
| Measure | numeric, not an identifier or entity, not named like `year`, `zip`, `postal`, `phone`, `lat`, `lon`, and not ending in an id word (D-031) |
| Category | text, boolean or integer with 50 or fewer distinct values, or at most 1,000 distinct and under 5% of rows |
| Free text | remaining text columns. Hidden from the dictionary |

### 2.4 Private columns

A dimension is marked `private` (never sent to the model, section 7 of
`architecture.md`) when its name contains `name`, `email`, `phone`, `address`,
`dob`, `birth`, `ssn`, `passport`, `iban`, `account`, or 20% or more of its
values match an email or phone pattern, or it is an entity or free-text column.

### 2.5 Default metrics

| Source | Metric |
|---|---|
| Always | Count of rows. Label from the table or identifier name when clear ("Orders" for `order_id`), otherwise "Rows" |
| Measure with a name like amount, revenue, sales, total, cost, profit, quantity, qty, units, seats, mrr, value | `sum` |
| Measure with a name like price, rate, pct, percent, score, rating, csat, age, minutes, hours, days, duration, discount | `avg` |
| Any other measure | `sum` if never negative and the 95th percentile is under 100 times the median, otherwise `avg` |
| Boolean column `x` | Ratio "x rate" = rows where x is true / rows |
| Entity column | `count_distinct`, labelled as a plural ("Customers") |

Derived ratios, added when both parts exist:

| Needs | Adds |
|---|---|
| revenue-like and cost-like | Gross profit = revenue - cost (a difference metric), and Margin = gross profit / revenue |
| profit-like and revenue-like | Profit margin = profit / revenue |
| revenue-like and count of rows | Average value per row. Named after the identifier only when it is unique per row ("Average order value"); on a table of order lines the hand-written dictionary defines it as revenue over distinct orders |
| revenue-like and quantity-like | Average price = revenue / quantity |

`avg` metrics are treated as ratios (sum over count of non-empty values) by
the compiler and by section 6.2, so an average can be decomposed like any
other ratio.

### 2.6 Direction and importance

- `lower_better` for names like cost, return, refund, churn, breach, complaint,
  error, defect, delay, duration, response, resolution, discount. Otherwise
  `higher_better` for money-like and count metrics, `neutral` for the rest.
- Importance: 1.0 for the main money-like sum (first match of revenue, sales,
  amount, mrr, gmv, value; else the first sum metric); 0.8 for profit, margin,
  cost; 0.7 for the row count; 0.6 for `lower_better` rates; 0.4 otherwise.

### 2.7 Rolling up over time

`overTime` defaults to `sum`. Set it to `last` for sum metrics when the table
is a snapshot: there is an entity column and the pair (entity, period at the
time column's native grain) is unique in 99% or more of rows across 3 or more
periods. Subscriptions by month and balances by day are the usual cases.
Row counts on a snapshot table also use `last`.

### 2.8 Sample datasets

Each sample dataset ships a hand-written `dictionary.yaml`. Inference must also
run on it, and a test compares the two: roles must agree for 90% or more of
columns (FR-12). The app uses the hand-written one for samples.

## 3. Data health checks

| ID | Check | Reported when | Severity |
|---|---|---|---|
| H1 | Exact duplicate rows | any | serious at 0.5% of rows or more, else minor |
| H2 | Repeated identifier | an identifier that looks unique (99%+) has repeats | serious |
| H3 | Empty values | a column is 1% or more empty (0.1% on a dictionary column) | serious at 20% or more on a dictionary column; information when the column only feeds averages, medians, minimums or maximums (D-032) |
| H4 | Label variants | values in a category differ only by case or surrounding spaces | minor, serious if they hold 2% of rows or more |
| H5 | Extreme values | a measure has values beyond `median + 10 * 1.4826 * MAD` in either direction, up to 20 shown; measured on the log scale when 99% of values are above 0 (D-032) | minor |
| H6 | Negative values | a measure that is 99%+ non-negative has negatives | minor |
| H7 | Unparsed values | values that failed type refinement (section 2.2) | minor |
| H8 | Gaps in time | missing days (or weeks, months) inside the range of the time column | minor |
| H9 | Dates out of order | an end timestamp before its start, or dates after the latest plausible date | serious |
| H10 | Incomplete latest period | section 4 | information |
| H11 | Constant column | one distinct value | information |
| H12 | Zero beside a positive value | a summed, never-negative measure is 0 while another is above 0, in 5% or fewer of the rows where the other is positive (D-032) | serious at 0.5% of rows or more, else minor |

Each problem carries: a one-sentence statement, the count and share, up to five
example rows, and which metrics it affects. Checks never change the data.

## 4. Periods

- **Data now** is the latest value in the time column. All relative phrases
  resolve against it, never against the clock.
- **Default grain**: month when the data spans 90 days or more, week for 21 to
  89 days, day below that.
- **Complete period**: a period is complete when the data contains a row on or
  after its last day, or, for the final period, when the number of distinct
  days present is at least 90% of the median for earlier periods of that grain.
- **Current period** is the latest complete period. **Previous period** is the
  one before it. If the final period is incomplete it is excluded from
  comparisons and the briefing says so (H10).
- **Same period last year** is available when the data reaches back a full
  year before the start of the current period.
- Weeks start on Monday (ISO).

## 5. Findings

### 5.1 Key changes

For each metric, with complete-period values `v[1..n]`:

- `change = v[n] - v[n-1]`, `pct = change / |v[n-1]|` (not reported when the
  previous value is 0). Ratio metrics report the change in points, not percent.
- **Is it unusual?** Let `s` be the season length for the grain (12 for month,
  4 for quarter, 7 for day; none for week or year).
  - If `n >= s + 7`: compare `v[n] - v[n-s]` against the history of
    `v[i] - v[i-s]` for earlier `i`. This stops a normal December from being
    called unusual.
  - Else if `n >= 8`: compare `change` against the history of
    `v[i] - v[i-1]` for `i < n`.
  - Else: not assessed, and the sentence says there is too little history.
- Using the robust z-score from section 1: `|z| >= 3.5` is "unusually large",
  `2 <= |z| < 3.5` is "larger than usual", below 2 is "within the normal
  range".
- Changes under 0.5% of the previous value (0.1 points for ratios) are reported
  as "little changed" and are not broken down.

### 5.2 Unusual points

On a finer grain than the briefing (day when the data spans 400 days or fewer,
otherwise week), for the three most important metrics:

- Expected value: for days, the median of the same weekday over the previous 8
  weeks; for weeks, the median of the previous 8 weeks.
- Residual = actual - expected. Scale = `1.4826 * MAD` of residuals over the
  previous 26 periods.
- Flag when `|residual| / scale >= 3.5` and `|residual| >= 20%` of expected.
- Assess only the latest 12 months of data (all of it if shorter). Needs 9
  weeks of history before the first assessed point.
- Skip this finder when the data has no finer grain than the briefing's (a
  monthly snapshot table, for example).
- Merge adjacent flagged periods into one event. Keep the top three by z.

A weekly pattern (busy Mondays) must not be flagged. That is what the
same-weekday baseline is for.

### 5.3 Runs

A metric that moved in the same direction for 3 or more consecutive complete
periods, with a cumulative change of 10% or more (2 points or more for ratios).
Report the length of the run and the cumulative change.

### 5.4 Concentration

For each entity dimension with 50 or more entities and each additive metric of
importance 0.7 or more, over the latest 12 complete months (or all data if
shorter): the share of the metric held by the top 20% of entities. Report when
it is 50% or more, together with how many entities that is.

## 6. Where a change came from

Never use the word "because" or name a cause. These methods locate a change.

### 6.1 Additive metrics (sum, count)

Given current and previous totals `C` and `P`, `D = C - P`, and a category
dimension with values `v` (values beyond the ten largest by previous value are
grouped as "Other"; empty values are their own group):

- `d_v = c_v - p_v` is the segment's change. These add up to `D`.
- `e_v = p_v * D / P` is what the segment would have changed by if it had moved
  in line with the total.
- `s_v = d_v - e_v` is how far it moved out of line.
- A segment is eligible when its previous value is at least 1% of `P` and it
  has 30 or more rows in either period.
- Score of the dimension = the largest `|s_v| / |D|` among eligible segments.
- Pick the dimension with the highest score. Ties go to the one with fewer
  values. Its top segment is the first level of the answer, provided the score
  is at least 0.25. If no dimension reaches 0.25, the finding says the change
  was broad-based.
- **Drill down.** Restrict to the chosen segment and repeat with the remaining
  dimensions, with `D` now the segment's own change. Accept the next level when
  its score is at least 0.5. Stop after three levels.
- Report the path ("Electronics, Online, West"), the segment's change, and its
  share of the total change `d / D`. When the share exceeds 100%, say that the
  segment fell by more than the total and the rest rose (or the reverse).
- Also report the largest segment moving the opposite way when its `|d_v|` is
  at least 25% of `|D|`.

Property test: for any generated data, the `d_v` of every dimension sum to `D`.

### 6.2 Ratio metrics (mix and rate)

For a ratio `R = N / D` and a category dimension, each segment has a rate
`r = n / d` and a weight `w = d / D`. Between previous (0) and current (1):

- `mix_v = (w1_v - w0_v) * (r0_v - R0)`
- `rate_v = w1_v * (r1_v - r0_v)`
- For a segment with no previous denominator, use `r0_v = r1_v` (its whole
  effect counts as mix). For one with no current denominator, `rate_v = 0`.
- `sum(mix_v) + sum(rate_v) = R1 - R0` exactly.

Reading:
- "Mostly rate" when `|sum(rate)| >= 2 * |sum(mix)|`: segments themselves
  changed. Name the segment with the largest `|rate_v|`.
- "Mostly mix" when the reverse holds: the blend of segments shifted. Name the
  segment with the largest `|mix_v|` and say which way its share moved.
- Otherwise "both", naming the top segment of each.
- Choose the dimension whose top segment effect (rate or mix) is largest in
  absolute value.

Property test: the two sums equal `R1 - R0` within 1e-9 for any generated data.

### 6.3 Other aggregations

Median, min, max and distinct counts do not add up across segments. For these,
show the metric split by the dimension with the widest spread between periods
and say plainly that a breakdown that adds up is not possible for this kind of
metric.

## 7. Ranking and composing the briefing

Score per finding, 0 to 1. The weights are a stated judgement.

| Finding | Score |
|---|---|
| Key change | `0.45 * min(|z|/3.5, 1) + 0.25 * min(|pct|/0.25, 1) + 0.20 * importance + 0.10 * min(|share of top segment|, 1)`. For ratios use `min(|points|/5, 1)` in place of the percent term |
| Unusual point | `0.45 * min(|z|/7, 1) + 0.25 * min(|residual/expected|/0.5, 1) + 0.20 * importance` |
| Run | `0.30 + 0.20 * importance + 0.20 * min(length/6, 1)` |
| Concentration | `0.25 + 0.15 * importance` |

Composition:

1. Headline: the highest-scoring key change, with its section 6 analysis and a
   chart.
2. "What else changed": the next findings by score, at most five, at most two
   per metric, at most one concentration finding.
3. "Before you rely on this": serious health problems that touch a metric
   shown above, plus H10 when it applies. At most four, most serious first.
4. Never more than seven findings in total. Fewer is fine. If nothing scores
   above 0.3, the headline says the period was unremarkable and shows the main
   metrics.

## 8. Result checks

Every query result is checked before display. Each check returns pass, caution
or fail with a sentence. A fail replaces the answer sentence with the problem.

| ID | Check | Outcome |
|---|---|---|
| C1 | Parts add up: an additive metric split by one dimension, with no limit, sums to the unsplit total | fail if not within tolerance. With a limit: caution stating "top N of M, covering x%" |
| C2 | Enough rows: base rows behind the result | caution under 30 |
| C3 | Filter values exist: each filter value matched at least one row | fail, with the three closest existing values |
| C4 | Complete period: the range includes an incomplete latest period | caution |
| C5 | Empty result: no rows or all values empty | fail, stated plainly |
| C6 | Small denominator: a ratio's denominator is 0 or under 30 | fail at 0, caution under 30 |
| C7 | Duplicates in scope: H1 duplicates are 0.5% or more of the rows in scope | caution |
| C8 | Rolled-up snapshot metric: an `overTime: last` metric over several periods | note: "taken at the end of the period, not added up" |

## 9. Narrative

### 9.1 Templates

Every finding type has sentence templates with typed slots. Examples:

- Key change: `{metric} {rose|fell} {pct} in {period}, from {previous} to
  {current}. That is {unusually large|larger than usual|within the normal
  range} for this metric.`
- Driver: `{share} of the {rise|fall} came from {segment path}, which went from
  {previous} to {current}.`
- Mix and rate: `{metric} moved {points} points. Most of that is {rate: segments
  themselves changing|mix: a shift in the blend of segments}; the largest
  effect is {segment}.`
- Caveat: `{count} rows ({share}) are exact duplicates, most of them in
  {period}. Figures above include them.`

Rules for wording: plain verbs; past tense for what happened; no causal words
("because", "due to", "caused", "led to", "thanks to", "as a result"); no
adjectives the data does not support ("significant" is reserved for the three
labels in 5.1); sentence case; no exclamation marks.

Each slot filled with a number records which result cell it came from. That
link is what the reference mark opens.

### 9.2 Number formatting

- One formatter in `src/core/narrative/format.ts`, used everywhere.
- Large values in prose and headline figures use compact form with three
  significant digits (1.28M, 48.2K). Working papers and tables show full
  values with thousands separators.
- Percent changes: one decimal. Ratio changes: points, one decimal, written
  "pts".
- Negative numbers use a real minus sign (U+2212). Currency follows the
  metric's `format.unit`; no currency symbol is assumed.
- Durations pick a sensible unit (minutes under 2 hours, hours under 3 days).
- Dates: "March 2025", "the week of 9 June 2025", "18 July 2024".

### 9.3 Grounding check

Applies to any sentence not produced by a template (model polish).

1. Extract numeric tokens from the candidate: digits with optional sign,
   separators, decimals, a trailing `%`, `pts`, or K/M/B suffix; and number
   words one to twelve.
2. Build the allowed set from the sentence's facts: each raw value, its
   formatted form, and any years or day numbers in the period labels.
3. A token is grounded when it equals an allowed value after applying that
   value's own rounding.
4. Reject the candidate if any token is not grounded, if any fact marked
   required is missing, or if it contains a causal word from 9.1.
5. On rejection, use the template sentence. Count rejections; evals report the
   rate.

## 10. Sample datasets

All three are synthetic, generated from a fixed seed by scripts in
`data/generators/`, and labelled as synthetic in the UI. The generator writes
Parquet (under 3 MB each), and a `truth.json` holding the planted effects with
the values actually realised in the generated data, computed by query, never
typed by hand. Each effect in `truth.json` carries `briefing: true` when the
default briefing is expected to surface it; the rest are there for questions.
Company names are fictional.

The briefing reports on the latest complete period, so the main planted effect
in each dataset sits in its final month. That is what makes the first screen
worth reading.

Tune generator parameters, not thresholds in this file, if a planted effect
does not come out clearly.

### 10.1 Retail: "Harbour & Pine"

Table `orders`. One row per order line. 2023-01-01 to 2025-03-31 (27 months).
About 60,000 rows. Seed 20261005.

Columns: `order_id`, `order_date`, `region` (North, South, East, West),
`channel` (Online, Store, Marketplace), `category` (Electronics, Furniture,
Kitchen, Outdoor, Decor), `sub_category` (3 or 4 per category),
`customer_id` (about 6,000), `customer_segment` (Consumer, Small business,
Corporate), `quantity`, `unit_price`, `discount_pct`, `revenue`, `cost`,
`returned` (boolean).

| ID | Planted effect |
|---|---|
| R1 | March 2025: Electronics revenue falls about 30% on February, almost all in Online in the West, where it falls about 75%. Total revenue falls 6% to 9% |
| R2 | From October 2024: Furniture discounts rise in every segment, so Furniture margin falls about 4 points. A rate effect |
| R3 | December 2024: return rate for the Headphones sub-category is about three times its usual level |
| R4 | November and December are about 35% above the monthly average in both years; underlying growth about 8% a year |
| R5 | The top 20% of customers hold about 60% of revenue |
| R6 | Q4 2024: overall return rate rises about 0.6 points because Electronics, which has a higher return rate, takes a larger share. Category rates are flat. A mix effect |
| R7 | Data problems: 1.2% exact duplicate rows, most of them in the week of 10 June 2024; 0.8% of `region` values in lower case; 0.5% of `customer_segment` empty; 12 rows with negative `quantity` |

### 10.2 Subscriptions: "Slotwise"

Table `subscriptions`. One row per account per month (a snapshot table).
January 2023 to December 2024. About 3,500 accounts, about 55,000 rows. Seed
20261006.

Columns: `month`, `account_id`, `plan` (Starter, Team, Business, Enterprise),
`region` (EMEA, Americas, APAC), `industry` (six values), `signup_channel`
(Organic, Paid search, Partner, Outbound), `seats`, `mrr`, `is_new`,
`is_churned` (true in the account's final month).

| ID | Planted effect |
|---|---|
| S1 | December 2024: churn rate on the Starter plan about doubles on November. Other plans unchanged. A rate effect |
| S2 | Through 2024, most of the MRR growth comes from Enterprise accounts adding seats |
| S3 | Paid search brings about 35% of new accounts but they churn about twice as fast |
| S4 | APAC MRR is flat across 2024 while the other regions grow |
| S5 | MRR is a snapshot metric: the 2024 figure is December's, not the sum of twelve months |
| S6 | Data problems: 0.6% of rows have `seats` 0 with `mrr` above 0; `industry` empty in 2% |

### 10.3 Support: "Kettle Helpdesk"

Table `tickets`. One row per ticket. 2024-01-01 to 2024-12-31. About 40,000
rows. Seed 20261007.

Columns: `ticket_id`, `created_at`, `resolved_at` (empty when open), `team`
(Billing, Technical, Onboarding, Accounts), `priority` (Low, Normal, High,
Urgent), `category` (eight values including "Login issues"), `channel` (Email,
Chat, Phone), `first_response_minutes`, `resolution_hours`, `sla_breached`,
`csat` (1 to 5, empty for about 60% of tickets), `reopened`.

| ID | Planted effect |
|---|---|
| T1 | From 2 December 2024: SLA breach rate in the Technical team rises from about 8% to about 22%. Other teams flat. A rate effect |
| T2 | November 2024: CSAT for "Login issues" falls by about 0.6 |
| T3 | Mondays carry about 40% more tickets than other weekdays. This must not be reported as unusual |
| T4 | 18 July 2024: ticket volume is about 3.5 times normal for one day |
| T5 | Data problems: 1.5% of tickets resolved before they were created; 0.4% repeated `ticket_id`. Empty `csat` is expected and must be described as "rated tickets only", not as a problem |

Expected in the default briefing (`briefing: true`): retail R1, R5, R7;
subscriptions S1, S6; support T1, T4, T5. T3 and R4 are the patterns that must
not be flagged.

## 11. Reading a phrase without a model

`resolve(text, model, values) -> Plan | PartialMatch`

1. Lower-case, strip punctuation, split into words.
2. Greedily match the longest runs of up to four words against, in order:
   time phrases, metric labels and synonyms, dimension labels and synonyms,
   values of category dimensions, and keywords (`by`, `per`, `for`, `in`,
   `only`, `excluding`, `vs`, `versus`, `compared to`, `top N`, `bottom N`,
   `share`, `trend`, `over time`, `monthly`, `weekly`, `daily`).
3. Match quality: exact after case-folding and plural stripping, then synonym,
   then one edit for words of 5 or more letters and two edits for 9 or more.
4. Time phrases: "last N days/weeks/months/quarters/years", "this/last
   month/quarter/year", month names with an optional year, a year, "Q1 2025",
   "year to date", "since March".
5. Change questions: "where did", "what drove", "why did" followed by a metric
   and a direction word (change, drop, fall, rise, increase, decrease) and an
   optional period produce a `change` plan against the previous period.
6. Accept the parse only when at least one metric matched, every word outside
   a short stop list (show, me, the, what, is, was, of, total, give, how, much,
   many, please, a, an, and) was consumed, and no word matched two things
   equally well. Two equal matches produce a `clarify` plan.
7. Anything else returns the partial matches so the composer can open with them
   filled in.

The accept rule is strict on purpose. An unknown word means the phrase is not
fully understood, so the resolver does not guess.

## 12. Follow-ups

When there is a previous spec and the new text has no metric:

| Text | Edit to the previous spec |
|---|---|
| "by X", "split by X" | replace `by` |
| "also by X" | append to `by` (max two) |
| "only V", "just V", "for V" | add an `in` filter |
| "without V", "excluding V" | add a `not_in` filter |
| a time phrase alone | replace the range |
| "vs last year", "compared to previous" | set `compare` |
| "top N", "bottom N" | set `sort` and `limit` |
| "as a share" | set `calc` |
| "over time", "monthly" | set the time grain |

If the new text contains a metric it is a new question.
