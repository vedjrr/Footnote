SELECT region, CAST(stddev_samp(units) AS DOUBLE) AS sd FROM fx GROUP BY region ORDER BY region;
