SELECT date_trunc('quarter', created_at) AS quarter, CAST(COUNT(*) AS BIGINT) AS n
FROM fx GROUP BY 1 ORDER BY 1;
