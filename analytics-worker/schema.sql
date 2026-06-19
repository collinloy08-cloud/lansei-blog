CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visited_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip TEXT NOT NULL,
  path TEXT NOT NULL,
  route TEXT NOT NULL,
  article_slug TEXT NOT NULL DEFAULT '',
  article_title TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'zh',
  country TEXT NOT NULL DEFAULT '',
  colo TEXT NOT NULL DEFAULT '',
  asn INTEGER,
  referrer TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_visits_time ON visits (visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_path ON visits (path);
CREATE INDEX IF NOT EXISTS idx_visits_ip ON visits (ip);
CREATE INDEX IF NOT EXISTS idx_visits_article ON visits (article_slug);
