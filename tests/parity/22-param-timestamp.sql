-- params: ["2024-01-10 00:00:00", "2024-01-20 00:00:00"]
SELECT id, created_at FROM fx
WHERE created_at >= CAST(? AS TIMESTAMP) AND created_at < CAST(? AS TIMESTAMP) ORDER BY id;
