SELECT region, CAST(SUM(revenue) AS DOUBLE) / SUM(CAST(SUM(revenue) AS DOUBLE)) OVER () AS share
FROM fx GROUP BY region ORDER BY region;
