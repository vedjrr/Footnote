# T12 The dictionary

## What it does

The dictionary says what a table means: which column dates each row, which
numbers are metrics and how they add up, and which text columns can split a
chart. Footnote writes one by itself from the column profile, and each sample
ships a hand-written one that the app uses instead.

## Why it is built this way

A model that guesses SQL from column names gets the meaning wrong in quiet
ways. It sums monthly recurring revenue across twelve months, averages
row-level ratios, or charts by customer id. The dictionary fixes those
meanings once, in data, so every query is compiled from the same definitions.

Inference is ordered rules (time, identifier, entity, measure, category, free
text) where the first match wins. That makes every role explainable in one
sentence. The simpler option, one rule per column type, calls `order_id` a
category and `customer_id` a number to sum.

Margin needs `(revenue - cost) / revenue`, so there is a `difference` metric
kind. Gross profit stays additive, and margin stays a ratio of two additive
metrics that can be split into mix and rate effects later.

## Worked example

Slotwise has 56,352 rows and 3,498 accounts over 24 months. For each account
and month there is exactly one row, so the snapshot probe finds `account_id`
unique per period in 100% of rows across 24 periods (the rule needs 99% over
3). MRR and seats get `overTime: last`, so "MRR in 2024" means December's
figure, not the sum of twelve months. Retail fails the same probe: a customer
often has several order lines on one day.

On all three samples the inferred roles match the hand-written ones for every
column (14, 10 and 12 columns).

## Interview questions

- *Why not ask the model to write the dictionary?* It has to work with no API
  key, and a wrong guess would change every number. Rules are testable; the
  user can fix the rest on the metrics screen.
- *Isn't 100% agreement suspicious?* Partly. I wrote the hand-written files
  after seeing the inferred roles, though the roles in these samples are not
  hard calls. The test still fails if a rule change breaks them, and the
  fixture tests pin the hard cases (id-like names, emails, free text).
- *How do you detect private columns?* By name (`email`, `name`, `phone`...),
  by role (entities and free text), and when 20% of the most common values
  look like emails or phone numbers.

## Known limits

- Email and phone detection sees only the ten most common values.
- Metric labels are plain ("Returned rate"); the hand-written ones read
  better.
- Currency is unknown on inferred dictionaries, so no unit is set.
