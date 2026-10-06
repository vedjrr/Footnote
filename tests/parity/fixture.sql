-- The parity fixture: 60 rows built from range(), so both engines create the
-- same table without reading a file. Covers integers, big integers past
-- 2^53, decimals, doubles, dates, timestamps, booleans, text and nulls.
CREATE OR REPLACE TABLE fx AS
SELECT
  CAST(i AS INTEGER) AS id,
  ['north', 'south', 'east', 'west'][1 + i % 4] AS region,
  CASE WHEN i % 7 = 0 THEN NULL ELSE ['basic', 'pro', 'team'][1 + i % 3] END AS plan,
  CAST(i * 37 % 101 AS INTEGER) AS units,
  CAST((i * 1234.5678) % 10000 AS DECIMAL(12, 2)) AS revenue,
  CASE WHEN i % 5 = 0 THEN NULL ELSE CAST((i * 13 % 17) / 4 AS DOUBLE) END AS discount,
  CAST(9007199254700000 + i * 1000 AS BIGINT) AS big_id,
  DATE '2024-01-01' + CAST(i * 5 AS INTEGER) AS order_date,
  TIMESTAMP '2024-01-01 08:00:00' + INTERVAL (i * 731) MINUTE AS created_at,
  i % 3 = 0 AS returned
FROM range(1, 61) AS t(i);
