SELECT region, CAST(SUM(revenue) AS DOUBLE) AS revenue, CAST(COUNT(*) AS BIGINT) AS n
FROM fx GROUP BY region ORDER BY region;
