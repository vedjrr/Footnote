SELECT CAST(units AS VARCHAR) AS units_text, CAST('12.5' AS DOUBLE) AS d,
  CAST(revenue AS INTEGER) AS whole, CAST(id AS DECIMAL(6, 1)) AS id_dec
FROM fx ORDER BY id LIMIT 10;
