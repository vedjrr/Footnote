-- params: [7500.5]
SELECT id FROM fx WHERE CAST(revenue AS DOUBLE) > ? ORDER BY id;
