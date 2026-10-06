SELECT CAST(order_date AS VARCHAR) AS iso, strftime(order_date, '%b %Y') AS label FROM fx ORDER BY id LIMIT 10;
