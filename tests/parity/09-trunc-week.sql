SELECT date_trunc('week', order_date) AS week, CAST(SUM(units) AS BIGINT) AS units
FROM fx GROUP BY 1 ORDER BY 1;
