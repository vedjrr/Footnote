SELECT region, units FROM (
  SELECT region, CAST(SUM(units) AS BIGINT) AS units, 0 AS is_total FROM fx GROUP BY region
  UNION ALL
  SELECT 'Total', CAST(SUM(units) AS BIGINT), 1 FROM fx
)
ORDER BY is_total, region;
