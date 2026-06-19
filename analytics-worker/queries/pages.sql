SELECT
  path,
  article_title,
  COUNT(*) AS visits,
  COUNT(DISTINCT ip) AS visitors
FROM visits
GROUP BY path, article_title
ORDER BY visits DESC
LIMIT 12;
