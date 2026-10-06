SELECT CAST(quantile_cont(units, 0.5) AS DOUBLE) AS median_units,
  CAST(quantile_cont(revenue, 0.9) AS DOUBLE) AS p90_revenue FROM fx;
