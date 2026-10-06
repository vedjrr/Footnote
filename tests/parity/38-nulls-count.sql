SELECT CAST(COUNT(*) AS BIGINT) AS all_rows, CAST(COUNT(plan) AS BIGINT) AS with_plan,
  CAST(COUNT(discount) AS BIGINT) AS with_discount FROM fx;
