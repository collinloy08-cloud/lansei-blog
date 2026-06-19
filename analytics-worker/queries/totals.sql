SELECT
  COUNT(*) AS total,
  COUNT(DISTINCT ip) AS unique_visitors,
  SUM(visited_at BETWEEN datetime('now', '-1 day') AND datetime('now')) AS last_24h,
  SUM(length(article_slug) IS NOT 0) AS article_views
FROM visits;
