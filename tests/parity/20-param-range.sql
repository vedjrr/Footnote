-- params: [10, 50]
SELECT id, units FROM fx WHERE units BETWEEN ? AND ? ORDER BY id;
