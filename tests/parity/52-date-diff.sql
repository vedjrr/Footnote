SELECT date_diff('day', MIN(order_date), MAX(order_date)) AS span_days,
  MAX(order_date) - MIN(order_date) AS span_minus FROM fx;
