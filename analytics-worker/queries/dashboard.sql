SELECT
  (
    SELECT json_object(
      'total', COUNT(*),
      'unique_visitors', COUNT(DISTINCT ip),
      'last_24h', COALESCE(SUM(visited_at BETWEEN datetime('now', '-1 day') AND datetime('now')), 0),
      'article_views', COALESCE(SUM(length(article_slug) IS NOT 0), 0)
    )
    FROM visits
  ) AS totals_json,
  (
    SELECT COALESCE(json_group_array(json_object(
      'path', path,
      'article_title', article_title,
      'visits', visits,
      'visitors', visitors
    )), '[]')
    FROM (
      SELECT path, article_title, COUNT(*) AS visits, COUNT(DISTINCT ip) AS visitors
      FROM visits
      GROUP BY path, article_title
      ORDER BY visits DESC
      LIMIT 12
    )
  ) AS pages_json,
  (
    SELECT COALESCE(json_group_array(json_object(
      'visited_at', visited_at,
      'ip', ip,
      'path', path,
      'article_title', article_title,
      'language', language,
      'country', country,
      'colo', colo,
      'referrer', referrer
    )), '[]')
    FROM (
      SELECT visited_at, ip, path, article_title, language, country, colo, referrer
      FROM visits
      ORDER BY visited_at DESC
      LIMIT 500
    )
  ) AS recent_json;
