SELECT region,
  CAST(SUM(revenue) AS DOUBLE) / NULLIF(CAST(SUM(units) AS DOUBLE), 0) AS revenue_per_unit
FROM fx GROUP BY region ORDER BY region;
