# T30 Golden questions

## What it does

Eighty test questions over the three sample datasets, each paired with what a
correct reply looks like: an answer (checked against hand-written SQL), a
change explained by the right segment, a clarifying question, or a polite
refusal. The eval runner (T31) asks Footnote each one and scores the reply.

## Why it is built this way

The reference SQL is written by hand against the raw table and never goes
through Footnote's compiler. If the compiler wrote its own answer key, it
could only ever agree with itself. No expected numbers are typed into the
files. They come from running the reference SQL at eval time, so regenerating
the data cannot leave a stale answer behind.

The questions aim at the mistakes simple text-to-SQL tools make. Nine depend
on rolling a snapshot metric up as its last month, and five on building a
ratio from totals. There are also questions where the right reply is to ask
or to decline, because a tool that always answers will be confidently wrong.
Fifty are for building (dev). Thirty are held back (holdout) and run only near
release, so the final score is not tuned to the questions.

## Worked example

"What was our MRR in 2024?" (saas-001). MRR is a monthly snapshot, so the
year's figure is December's: $4,801,625. Summing the twelve months gives
$52,040,250, which is 10.8 times too high. A tool that sums gets it wrong, and
the scorer marks it wrong.

"What's the average order value for 2024?" (retail-021). Revenue over
distinct orders is £343.76. Averaging revenue per order line gives £224.65,
because an order has several lines.

## Questions an interviewer might ask

- *How do you know the reference SQL is right?* Every query runs in a test
  that also checks for ties at a LIMIT cut and for filters on values that do
  not exist. A fresh reviewer with only the questions and the schemas checked
  25 at random: no mismatches, three debatable. One question was reworded.
- *Isn't 80 questions small?* Yes. It covers ten kinds of question across
  three datasets. It shows where the tool is weak, but it is not a benchmark.
- *What stops you tuning to the test?* The holdout split, a rule that no
  product code may special-case a golden, and a rule that a golden changes
  only in its own commit with the reason written down.

## Known limits

- Synthetic data, one table per dataset, English only.
- References use the rows as stored (duplicates included). No question
  depends on the lower-case region labels, so that judgement is not tested.
- Where wording allows two readings, a `notes` line records the one chosen.
