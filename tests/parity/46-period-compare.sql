WITH p AS (
  SELECT CASE WHEN order_date < DATE '2024-03-01' THEN 'previous' ELSE 'current' END AS period,
    CAST(SUM(revenue) AS DOUBLE) AS revenue
  FROM fx WHERE order_date < DATE '2024-05-01' GROUP BY 1
)
SELECT
  (SELECT revenue FROM p WHERE period = 'current') AS current_value,
  (SELECT revenue FROM p WHERE period = 'previous') AS previous_value,
  ((SELECT revenue FROM p WHERE period = 'current') - (SELECT revenue FROM p WHERE period = 'previous'))
    / NULLIF((SELECT revenue FROM p WHERE period = 'previous'), 0) AS pct_change;
