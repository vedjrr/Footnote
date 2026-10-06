WITH m AS (
  SELECT date_trunc('month', order_date) AS month, CAST(SUM(revenue) AS DOUBLE) AS revenue
  FROM fx GROUP BY 1
)
SELECT month, revenue, LAG(revenue) OVER (ORDER BY month) AS previous FROM m ORDER BY month;
