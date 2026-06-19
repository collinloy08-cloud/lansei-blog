SELECT
  visited_at,
  ip,
  path,
  article_title,
  language,
  country,
  colo,
  referrer
FROM visits
ORDER BY visited_at DESC
LIMIT 500;
