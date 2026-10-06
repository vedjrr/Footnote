SELECT upper(region) AS r, concat(region, '-', CAST(id AS VARCHAR)) AS label, length(region) AS len
FROM fx ORDER BY id LIMIT 8;
