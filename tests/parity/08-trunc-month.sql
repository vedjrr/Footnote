SELECT date_trunc('month', order_date) AS month, CAST(SUM(revenue) AS DOUBLE) AS revenue
FROM fx GROUP BY 1 ORDER BY 1;
