const BLOG_ORIGINS = new Set([
  "https://lansei.top",
  "https://www.lansei.top",
  "http://127.0.0.1:18736",
  "http://localhost:18736",
]);

const MAX_PAYLOAD_BYTES = 4096;
const MAX_FIELD_LENGTH = 1024;
const MAX_CONTENT_BYTES = 2 * 1024 * 1024;
let cachedJwks = null;
let cachedJwksAt = 0;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/collect" && request.method === "OPTIONS") {
      return corsResponse(request, null, 204);
    }

    if (url.pathname === "/collect" && request.method === "POST") {
      return collectVisit(request, env);
    }

    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    if (isAdminRequest(url.pathname)) {
      const identity = await verifyAdmin(request, env);
      if (!identity.ok) {
        return new Response(identity.message, {
          status: identity.status,
          headers: { "content-type": "text/plain;charset=UTF-8", "x-robots-tag": "noindex" },
        });
      }

      if (url.pathname === "/admin") return Response.redirect(`${url.origin}/?tab=analytics`, 302);
      if (url.pathname === "/api/content.js" && request.method === "GET") return githubContentScript(env);
      if (url.pathname === "/api/publish" && request.method === "POST") return publishGitHubContent(request, env);
      if (url.pathname === "/api/summary" && request.method === "GET") return summary(env);
      if (url.pathname === "/api/export.csv" && request.method === "GET") return exportCsv(env);
      if (!url.pathname.startsWith("/api/")) return privateAsset(request, env);
      return json({ ok: false, message: "Not found" }, 404);
    }

    return new Response("Not found", { status: 404 });
  },

};

function isAdminRequest(pathname) {
  return (
    pathname === "/" ||
    pathname === "/index.html" ||
    pathname === "/editor.css" ||
    pathname === "/editor.js" ||
    pathname === "/admin" ||
    pathname.startsWith("/api/")
  );
}

async function privateAsset(request, env) {
  if (!env.ASSETS) return new Response("Admin assets are not configured.", { status: 503 });
  const url = new URL(request.url);
  const isShell = url.pathname === "/" || url.pathname === "/index.html";
  if (isShell) url.pathname = "/admin.txt";
  const response = await env.ASSETS.fetch(new Request(url, request));
  const headers = new Headers(response.headers);
  if (isShell) headers.set("content-type", "text/html;charset=UTF-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("x-robots-tag", "noindex, nofollow");
  headers.set(
    "content-security-policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://translate.googleapis.com; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'"
  );
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function githubSettings(env) {
  const repository = String(env.GITHUB_REPOSITORY || "collinloy08-cloud/lansei-blog").trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("Invalid GitHub repository setting");
  return {
    repository,
    branch: String(env.GITHUB_BRANCH || "main").trim(),
    path: String(env.GITHUB_CONTENT_PATH || "content.js").trim(),
  };
}

function githubHeaders(env) {
  const headers = new Headers({
    accept: "application/vnd.github+json",
    "user-agent": "lansei-blog-admin",
    "x-github-api-version": "2022-11-28",
  });
  if (env.GITHUB_TOKEN) headers.set("authorization", `Bearer ${env.GITHUB_TOKEN}`);
  return headers;
}

async function getGitHubContent(env) {
  const settings = githubSettings(env);
  const endpoint = `https://api.github.com/repos/${settings.repository}/contents/${encodeURIComponent(settings.path)}?ref=${encodeURIComponent(settings.branch)}`;
  const response = await fetch(endpoint, { headers: githubHeaders(env), cf: { cacheTtl: 0 } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.content || !payload.sha) {
    throw new Error(payload.message || "Unable to read content.js from GitHub");
  }
  const bytes = base64Bytes(String(payload.content).replace(/\s/g, ""));
  return { content: new TextDecoder().decode(bytes), sha: payload.sha, settings };
}

async function githubContentScript(env) {
  try {
    const file = await getGitHubContent(env);
    const normalized = normalizeContentScript(file.content);
    return new Response(normalized, {
      headers: {
        "content-type": "text/javascript;charset=UTF-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    return new Response(`window.BLOG_CONTENT_LOAD_ERROR = ${JSON.stringify(error.message)};`, {
      status: 502,
      headers: { "content-type": "text/javascript;charset=UTF-8", "cache-control": "no-store" },
    });
  }
}

async function publishGitHubContent(request, env) {
  if (!env.GITHUB_TOKEN) {
    return json({ ok: false, message: "尚未配置 GitHub 发布凭据。" }, 503);
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_CONTENT_BYTES) return json({ ok: false, message: "内容文件过大。" }, 413);

  try {
    const buffer = await request.arrayBuffer();
    if (buffer.byteLength > MAX_CONTENT_BYTES) return json({ ok: false, message: "内容文件过大。" }, 413);
    const content = normalizeContentScript(new TextDecoder().decode(buffer));
    const current = await getGitHubContent(env);
    const currentContent = normalizeContentScript(current.content);
    if (content === currentContent) {
      return json({ ok: true, published: false, message: "内容没有变化，GitHub 发布连接正常。" });
    }
    const endpoint = `https://api.github.com/repos/${current.settings.repository}/contents/${encodeURIComponent(current.settings.path)}`;
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: new Headers({ ...Object.fromEntries(githubHeaders(env)), "content-type": "application/json" }),
      body: JSON.stringify({
        message: "Update blog content",
        content: bytesToBase64(new TextEncoder().encode(content)),
        sha: current.sha,
        branch: current.settings.branch,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "GitHub rejected the update");
    return json({
      ok: true,
      message: "已发布到 GitHub，网站通常会在一两分钟内更新。",
      commitUrl: payload.commit?.html_url || "",
    });
  } catch (error) {
    return json({ ok: false, message: `发布失败：${error.message}` }, 502);
  }
}

function normalizeContentScript(source) {
  const match = String(source).trim().match(/^window\.BLOG_CONTENT\s*=\s*([\s\S]*);\s*$/);
  if (!match) throw new Error("content.js format is invalid");
  const content = JSON.parse(match[1]);
  if (!content || typeof content !== "object" || !Array.isArray(content.posts) || !Array.isArray(content.categories)) {
    throw new Error("Blog content is incomplete");
  }
  return `window.BLOG_CONTENT = ${JSON.stringify(content, null, 2)};\n`;
}

function base64Bytes(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function collectVisit(request, env) {
  const origin = request.headers.get("origin") || "";
  if (!BLOG_ORIGINS.has(origin)) return new Response("Forbidden", { status: 403 });
  if (request.headers.get("sec-gpc") === "1") return corsResponse(request, null, 204);

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_PAYLOAD_BYTES) return corsResponse(request, "Payload too large", 413);

  let body;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_PAYLOAD_BYTES) {
      return corsResponse(request, "Payload too large", 413);
    }
    body = JSON.parse(raw);
  } catch {
    return corsResponse(request, "Invalid payload", 400);
  }

  const path = clean(body.path, 400);
  if (!path || !path.startsWith("/")) return corsResponse(request, "Invalid path", 400);

  const cf = request.cf || {};
  const ip = clean(request.headers.get("cf-connecting-ip") || "unknown", 64);
  const userAgent = clean(request.headers.get("user-agent"), MAX_FIELD_LENGTH);
  if (looksLikeBot(userAgent)) return corsResponse(request, null, 204);

  await env.DB.prepare(
    `INSERT INTO visits
      (ip, path, route, article_slug, article_title, language, country, colo, asn, referrer, user_agent, session_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      ip,
      path,
      clean(body.route, 80),
      clean(body.articleSlug, 200),
      clean(body.articleTitle, 300),
      body.language === "en" ? "en" : "zh",
      clean(cf.country, 8),
      clean(cf.colo, 16),
      Number.isFinite(Number(cf.asn)) ? Number(cf.asn) : null,
      clean(body.referrer, MAX_FIELD_LENGTH),
      userAgent,
      clean(body.sessionId, 80)
    )
    .run();

  return corsResponse(request, null, 204);
}

async function summary(env) {
  const [totals, recent, pages, daily] = await Promise.all([
    env.DB.prepare(
      `SELECT
        COUNT(*) AS total,
        COUNT(DISTINCT ip) AS unique_visitors,
        SUM(visited_at >= datetime('now', '-1 day')) AS last_24h,
        SUM(article_slug <> '') AS article_views
       FROM visits`
    ).first(),
    env.DB.prepare(
      `SELECT visited_at, ip, path, route, article_title, language, country, colo, referrer, user_agent
       FROM visits ORDER BY visited_at DESC LIMIT 200`
    ).all(),
    env.DB.prepare(
      `SELECT path, article_title, COUNT(*) AS visits, COUNT(DISTINCT ip) AS visitors
       FROM visits GROUP BY path, article_title ORDER BY visits DESC LIMIT 12`
    ).all(),
    env.DB.prepare(
      `SELECT date(visited_at) AS day, COUNT(*) AS visits, COUNT(DISTINCT ip) AS visitors
       FROM visits WHERE visited_at >= datetime('now', '-13 days')
       GROUP BY date(visited_at) ORDER BY day ASC`
    ).all(),
  ]);

  return json({
    totals: totals || { total: 0, unique_visitors: 0, last_24h: 0, article_views: 0 },
    recent: recent.results || [],
    pages: pages.results || [],
    daily: daily.results || [],
  });
}

async function exportCsv(env) {
  const result = await env.DB.prepare(
    `SELECT visited_at, ip, path, route, article_slug, article_title, language, country, colo, asn, referrer, user_agent
     FROM visits ORDER BY visited_at DESC LIMIT 10000`
  ).all();
  const columns = [
    "visited_at", "ip", "path", "route", "article_slug", "article_title",
    "language", "country", "colo", "asn", "referrer", "user_agent",
  ];
  const rows = [columns.join(",")];
  for (const record of result.results || []) {
    rows.push(columns.map((column) => csvCell(record[column])).join(","));
  }
  return new Response(`\uFEFF${rows.join("\r\n")}`, {
    headers: {
      "content-type": "text/csv;charset=UTF-8",
      "content-disposition": `attachment; filename="lansei-visits-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

async function verifyAdmin(request, env) {
  const token = request.headers.get("cf-access-jwt-assertion") || "";
  const teamDomain = cleanTeamDomain(env.ACCESS_TEAM_DOMAIN);
  const audience = env.ACCESS_AUD || "";
  const adminEmail = (env.ADMIN_EMAIL || "").trim().toLowerCase();

  if (!teamDomain || !audience || !adminEmail || !token) {
    return { ok: false, status: 403, message: "This analytics dashboard requires Cloudflare Access." };
  }

  try {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
    if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error("Malformed token");
    const header = JSON.parse(new TextDecoder().decode(base64UrlBytes(encodedHeader)));
    const payload = JSON.parse(new TextDecoder().decode(base64UrlBytes(encodedPayload)));
    if (header.alg !== "RS256" || !header.kid) throw new Error("Unexpected token algorithm");

    const jwks = await getAccessJwks(teamDomain);
    const jwk = jwks.keys.find((key) => key.kid === header.kid);
    if (!jwk) throw new Error("Signing key not found");
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const verified = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      base64UrlBytes(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );

    const now = Math.floor(Date.now() / 1000);
    const tokenAudience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const expectedIssuer = `https://${teamDomain}`;
    const email = String(payload.email || "").toLowerCase();
    if (!verified || payload.exp <= now || (payload.nbf && payload.nbf > now)) throw new Error("Expired token");
    if (!tokenAudience.includes(audience) || payload.iss !== expectedIssuer) throw new Error("Invalid audience");
    if (email !== adminEmail) return { ok: false, status: 403, message: "This account is not allowed." };
    return { ok: true, email };
  } catch {
    return { ok: false, status: 403, message: "Cloudflare Access authentication failed." };
  }
}

async function getAccessJwks(teamDomain) {
  if (cachedJwks && Date.now() - cachedJwksAt < 60 * 60 * 1000) return cachedJwks;
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error("Unable to load Access keys");
  cachedJwks = await response.json();
  cachedJwksAt = Date.now();
  return cachedJwks;
}

function adminPage(email) {
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>岚生博客 · 访客统计</title>
  <style>
    :root{color-scheme:light;--ink:#191b1f;--muted:#6d727a;--line:#e5e7e9;--paper:#f7f7f5;--accent:#28745e}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
    main{width:min(1180px,calc(100% - 32px));margin:36px auto 80px}header{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:28px}
    h1{font:600 28px/1.2 Georgia,"Noto Serif SC",serif;margin:0 0 6px}p{margin:0;color:var(--muted)}a{color:var(--accent)}
    .actions{display:flex;gap:10px}.button{border:1px solid var(--line);background:#fff;color:var(--ink);padding:8px 12px;text-decoration:none;cursor:pointer}
    .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);margin-bottom:28px}
    .metric{background:#fff;padding:20px}.metric strong{display:block;font:600 27px/1.2 Georgia,serif}.metric span{color:var(--muted)}
    section{margin-top:30px}h2{font-size:17px;margin:0 0 12px}.panel{background:#fff;border:1px solid var(--line);overflow:auto}
    table{width:100%;border-collapse:collapse;white-space:nowrap}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}
    th{font-size:12px;color:var(--muted);font-weight:600;background:#fbfbfa;position:sticky;top:0}td.path{white-space:normal;min-width:240px;max-width:420px}
    .empty{padding:28px;text-align:center}.privacy{margin-top:28px;padding-top:16px;border-top:1px solid var(--line)}
    @media(max-width:720px){main{width:min(100% - 20px,1180px);margin-top:20px}header{align-items:start;flex-direction:column}.metrics{grid-template-columns:repeat(2,1fr)}}
  </style>
</head>
<body>
<main>
  <header><div><h1>访客统计</h1><p>仅 ${escapeHtml(email)} 可见 · 永久保留</p></div><div class="actions"><button class="button" id="refresh">刷新</button><a class="button" href="/api/export.csv">导出 CSV</a></div></header>
  <div class="metrics" id="metrics"><div class="metric"><strong>–</strong><span>加载中</span></div></div>
  <section><h2>访问最多的内容</h2><div class="panel"><table><thead><tr><th>页面 / 文章</th><th>访问次数</th><th>独立 IP</th></tr></thead><tbody id="pages"></tbody></table></div></section>
  <section><h2>最近访问</h2><div class="panel"><table><thead><tr><th>时间</th><th>IP</th><th>内容</th><th>地区</th><th>语言</th><th>来源</th></tr></thead><tbody id="recent"></tbody></table></div></section>
  <p class="privacy">原始 IP 属于个人信息并会长期保存。不要公开导出的 CSV 或本地备份文件。</p>
</main>
<script>
  const makeCell=(value,className="")=>{const cell=document.createElement("td");cell.textContent=value??"";cell.className=className;return cell};
  const number=(value)=>new Intl.NumberFormat("zh-CN").format(Number(value)||0);
  async function load(){
    const response=await fetch("/api/summary",{headers:{accept:"application/json"}});
    if(!response.ok)throw new Error("无法读取统计数据");
    const data=await response.json();
    const metrics=[['总访问',data.totals.total],['独立 IP',data.totals.unique_visitors],['24 小时',data.totals.last_24h],['文章阅读',data.totals.article_views]];
    const metricsRoot=document.querySelector("#metrics");metricsRoot.replaceChildren();
    for(const [label,value] of metrics){const box=document.createElement("div");box.className="metric";const strong=document.createElement("strong");strong.textContent=number(value);const span=document.createElement("span");span.textContent=label;box.append(strong,span);metricsRoot.append(box)}
    const pages=document.querySelector("#pages");pages.replaceChildren();
    for(const row of data.pages){const tr=document.createElement("tr");tr.append(makeCell(row.article_title||row.path,"path"),makeCell(number(row.visits)),makeCell(number(row.visitors)));pages.append(tr)}
    const recent=document.querySelector("#recent");recent.replaceChildren();
    for(const row of data.recent){const tr=document.createElement("tr");tr.append(makeCell(row.visited_at),makeCell(row.ip),makeCell(row.article_title||row.path,"path"),makeCell([row.country,row.colo].filter(Boolean).join(" · ")),makeCell(row.language),makeCell(row.referrer||"直接访问","path"));recent.append(tr)}
    if(!data.recent.length){const tr=document.createElement("tr");const td=makeCell("暂无访问记录");td.colSpan=6;td.className="empty";tr.append(td);recent.append(tr)}
  }
  document.querySelector("#refresh").addEventListener("click",()=>load().catch(alert));load().catch(alert);
</script>
</body></html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html;charset=UTF-8",
      "cache-control": "no-store",
      "x-frame-options": "DENY",
      "content-security-policy": "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

function corsResponse(request, body, status) {
  const origin = request.headers.get("origin") || "";
  const headers = new Headers({
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    "cache-control": "no-store",
  });
  if (BLOG_ORIGINS.has(origin)) headers.set("access-control-allow-origin", origin);
  return new Response(body, { status, headers });
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json;charset=UTF-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}

function clean(value, maxLength = MAX_FIELD_LENGTH) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength);
}

function cleanTeamDomain(value) {
  return String(value || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function looksLikeBot(userAgent) {
  return /bot|crawler|spider|headless|preview|facebookexternalhit|slurp/i.test(userAgent);
}

function base64UrlBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function csvCell(value) {
  const normalized = String(value ?? "").replace(/^[=+\-@]/, "'$&");
  return `"${normalized.replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}
