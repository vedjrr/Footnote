SELECT id, CAST(SUM(revenue) OVER (ORDER BY order_date, id) AS DOUBLE) AS running
FROM fx ORDER BY id;
