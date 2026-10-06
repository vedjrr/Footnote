-- params: ["2024-06-01"]
SELECT CAST(COUNT(*) AS BIGINT) AS n FROM fx WHERE order_date >= CAST(? AS DATE);
