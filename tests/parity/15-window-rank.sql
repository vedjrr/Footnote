SELECT region, id, CAST(RANK() OVER (PARTITION BY region ORDER BY revenue DESC, id) AS BIGINT) AS rnk
FROM fx ORDER BY region, rnk;
