-- params: [true]
SELECT CAST(COUNT(*) AS BIGINT) AS n FROM fx WHERE returned = ?;
