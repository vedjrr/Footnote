SELECT EXTRACT(year FROM order_date) AS y, EXTRACT(month FROM order_date) AS m,
  CAST(COUNT(*) AS BIGINT) AS n FROM fx GROUP BY 1, 2 ORDER BY 1, 2;
