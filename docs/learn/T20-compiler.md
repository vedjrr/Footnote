# T20 The SQL compiler

## What it does

The compiler turns a question written as data (a QuerySpec: metrics, splits,
period, filters, comparison) into one SQL statement, using only definitions
from the dictionary. Every answer in Footnote, with or without AI assist, goes
through it, so the SQL shown is the SQL that ran.

## Why it is built this way

Letting a model write SQL directly gives answers that look right and are not.
The two classic mistakes are summing a snapshot metric across months and
averaging ratios. The compiler makes both impossible. A ratio is always the
numerator's total divided by the denominator's total, at whatever grouping the
question asks for. A metric marked `overTime: last` (MRR, seats) takes only the
last day in each bucket. Values go in as parameters and identifiers are quoted,
and a property test checks that no generated spec can name a column outside
the dictionary.

Relative periods ("last month") resolve against the data's latest day, never
the clock. A month counts as complete only if the data reaches its last day,
or has 90% of the usual number of days.

## Worked example

"MRR in 2024" on Slotwise: summing every month of 2024 gives 52,040,250. The
compiler gives 4,801,625, December's figure, because MRR is a snapshot. "Churn
rate by plan, last month against the month before" compiles to one grouped
pass with each aggregate filtered by side. Starter goes from 3.4% to 6.7%, the
planted S1 effect.

## Interview questions

- *Why not compute the comparison with a self-join?* One pass with `FILTER`
  scans the table once, and the two sides cannot drift apart in their filters.
- *How do you know the display SQL is honest?* A test runs the display version
  (values written in) and the parameterised version for every spec in the
  suite and requires identical rows.
- *What if a period isn't in the data?* The compiler refuses with a sentence
  ("The data does not reach back a full year before this period") rather than
  returning zeros.

## Known limits

- A comparison cannot also be a series over time.
- `overTime: avg` divides by days with data in each group, not by every
  period in range.
- Filters compare values as text, so a refined text boolean such as "Yes"
  does not match `true`.
