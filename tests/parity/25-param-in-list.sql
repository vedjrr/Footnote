-- params: ["pro", "team"]
SELECT region, CAST(COUNT(*) AS BIGINT) AS n FROM fx WHERE plan IN (?, ?) GROUP BY region ORDER BY region;
