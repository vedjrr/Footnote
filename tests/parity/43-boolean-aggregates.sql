SELECT bool_or(returned) AS any_returned, bool_and(returned) AS all_returned,
  CAST(COUNT(*) FILTER (WHERE returned) AS BIGINT) AS n_returned FROM fx;
