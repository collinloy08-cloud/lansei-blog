const content = window.BLOG_CONTENT;
const ANALYTICS_ENDPOINT = content.site.analyticsEndpoint || "/collect";

let lastTrackedRoute = null;

function getAnalyticsSessionId() {
  try {
    const stored = sessionStorage.getItem("blog-analytics-session");
    if (stored) return stored;
    const next = crypto.randomUUID();
    sessionStorage.setItem("blog-analytics-session", next);
    return next;
  } catch {
    return "";
  }
}

function trackCurrentVisit() {
  if (!ANALYTICS_ENDPOINT || navigator.globalPrivacyControl || navigator.doNotTrack === "1") return;

  const routeKey = `${window.location.pathname}${window.location.hash || "#/"}`;
  if (routeKey === lastTrackedRoute) return;
  lastTrackedRoute = routeKey;

  const hash = (window.location.hash || "#/").replace(/^#\/?/, "");
  const [route = "home", ...parts] = hash.split("/");
  const value = decodeURIComponent(parts.join("/"));
  const post = route === "post" ? sortedPosts().find((item) => item.slug === value) : null;
  const payload = {
    path: routeKey,
    route: route || "home",
    articleSlug: post?.slug || "",
    articleTitle: post ? local(post.title) : "",
    language: state.lang,
    referrer: document.referrer,
    sessionId: getAnalyticsSessionId(),
  };

  fetch(ANALYTICS_ENDPOINT, {
    method: "POST",
    mode: "cors",
    keepalive: true,
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Analytics must never interrupt reading.
  });
}

const I18N = {
  zh: {
    navHome: "首页",
    navPosts: "文章",
    navArchives: "归档",
    navCategories: "分类",
    navTags: "标签",
    navAbout: "关于",
    totalPrefix: "共",
    totalSuffix: "篇文章",
    statPosts: "文章",
    statCategories: "分类",
    statTags: "标签",
    articleToc: "文章目录",
    recentUpdates: "最近更新",
    categories: "分类",
    siteOverview: "站点概览",
    links: "链接",
    backTop: "回到顶部",
    featured: "精选文章",
    latest: "最新文章",
    allPosts: "全部文章",
    archives: "归档",
    categoriesTitle: "分类",
    tagsTitle: "标签",
    aboutTitle: "关于岚生",
    privacyTitle: "访问统计与隐私",
    privacyBody: "本站使用自托管访问统计，记录访问时间、IP 地址和浏览内容，并长期保存，仅供站长查看，不用于广告或向第三方出售。浏览器启用 Global Privacy Control 或 Do Not Track 时不会采集。",
    readMore: "阅读全文",
    related: "相关文章",
    noPosts: "没有找到匹配的文章。",
    postCount: "共 {n} 篇文章。可以用上方搜索框查标题、正文和标签。",
    archiveDesc: "非常好，目前共计 {n} 篇文章。继续写，继续变得可靠又有审美。",
    searchPlaceholder: "搜索论文、概念、散文、标签",
    aboutBody:
      "这个站点目前承载两类内容：一类是多模态、深度学习和大模型相关的科研收获；另一类是散文、纪事和一点点有意识的自我包装。",
  },
  en: {
    navHome: "Home",
    navPosts: "Posts",
    navArchives: "Archive",
    navCategories: "Categories",
    navTags: "Tags",
    navAbout: "About",
    totalPrefix: "",
    totalSuffix: "posts",
    statPosts: "Posts",
    statCategories: "Categories",
    statTags: "Tags",
    articleToc: "Contents",
    recentUpdates: "Recent",
    categories: "Categories",
    siteOverview: "Overview",
    links: "Links",
    backTop: "Back to top",
    featured: "Featured",
    latest: "Latest Posts",
    allPosts: "All Posts",
    archives: "Archive",
    categoriesTitle: "Categories",
    tagsTitle: "Tags",
    aboutTitle: "About Lansheng",
    privacyTitle: "Analytics and privacy",
    privacyBody: "This site uses self-hosted analytics to record visit time, IP address, and viewed content. Records are retained and are visible only to the site owner; they are not used for advertising or sold to third parties. Tracking is disabled when Global Privacy Control or Do Not Track is enabled.",
    readMore: "Read more",
    related: "Related",
    noPosts: "No matching posts found.",
    postCount: "{n} posts. Use the search box above to search titles, body text, and tags.",
    archiveDesc: "{n} posts in total. Keep writing; reliability and taste both need accumulation.",
    searchPlaceholder: "Search papers, ideas, essays, tags",
    aboutBody:
      "This site has two threads: research notes on multimodal learning, deep learning, and large models; and essays about campus life, cities, reading, and the performance of becoming slightly more interesting.",
  },
};

const state = {
  query: "",
  lang: ["zh", "en"].includes(new URLSearchParams(window.location.search).get("lang"))
    ? new URLSearchParams(window.location.search).get("lang")
    : localStorage.getItem("blog-lang") || "zh",
};

const view = document.querySelector("[data-view]");
const searchInput = document.querySelector("[data-search]");
const progress = document.querySelector(".progress");
const meter = document.querySelector("[data-reading-meter]");
const backTop = document.querySelector("[data-back-top]");
const themeButton = document.querySelector("[data-theme-toggle]");
const themeIcon = document.querySelector("[data-theme-icon]");
const langButton = document.querySelector("[data-lang-toggle]");
const tocBlock = document.querySelector("[data-toc-block]");
const tocBox = document.querySelector("[data-article-toc]");
const articleDrawer = document.querySelector("[data-article-drawer]");
const drawerToc = document.querySelector("[data-drawer-toc]");
const drawerOverview = document.querySelector("[data-drawer-overview]");
const drawerToggle = document.querySelector("[data-drawer-toggle]");
const drawerClose = document.querySelector("[data-drawer-close]");
const drawerTabs = document.querySelectorAll("[data-drawer-tab]");
const drawerPanels = document.querySelectorAll("[data-drawer-panel]");

function t(key, params = {}) {
  let value = Object.hasOwn(I18N[state.lang], key) ? I18N[state.lang][key] : I18N.zh[key] || key;
  Object.entries(params).forEach(([name, param]) => {
    value = value.replace(`{${name}}`, param);
  });
  return value;
}

function local(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value[state.lang] ?? value.zh ?? value.en ?? "";
  }
  return value ?? "";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value || "";
}

function sortedPosts(posts = content.posts) {
  return [...posts]
    .filter((post) => post.status !== "draft")
    .sort((a, b) => b.date.localeCompare(a.date));
}

function uniqueTags(posts = content.posts) {
  return [...new Set(posts.flatMap((post) => post.tags || []))].sort((a, b) => a.localeCompare(b));
}

function parseDate(date) {
  const [year, month, day] = date.split(".");
  return { year, month, day, compact: `${month}-${day}` };
}

function groupedByYear(posts) {
  return sortedPosts(posts).reduce((groups, post) => {
    const { year } = parseDate(post.date);
    if (!groups[year]) groups[year] = [];
    groups[year].push(post);
    return groups;
  }, {});
}

function categoryById(id) {
  return content.categories.find((category) => category.id === id);
}

function categoryLabel(id) {
  return local(categoryById(id)?.label) || id;
}

function searchableText(post) {
  return [
    local(post.title),
    local(post.excerpt),
    local(post.body),
    categoryLabel(post.category),
    ...(post.tags || []),
  ].join(" ");
}

function searchMatches(post) {
  const query = state.query.trim().toLowerCase();
  if (!query) return true;
  return searchableText(post).toLowerCase().includes(query);
}

function estimateReadTime(text = "") {
  const normalized = text.replace(/\s+/g, "");
  return `${Math.max(1, Math.ceil(normalized.length / (state.lang === "zh" ? 500 : 220)))} min`;
}

function postCard(post, compact = false) {
  const body = local(post.body);
  const tags = (post.tags || [])
    .map((tag) => `<a href="#/tag/${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`)
    .join("");

  return `
    <article class="${compact ? "post-row reveal" : "feed-post reveal"}">
      <div class="post-meta">
        <span>${escapeHtml(post.date)}</span>
        <a href="#/category/${encodeURIComponent(post.category)}">${escapeHtml(categoryLabel(post.category))}</a>
        <span>${estimateReadTime(body)}</span>
      </div>
      <h3><a href="#/post/${encodeURIComponent(post.slug)}">${escapeHtml(local(post.title))}</a></h3>
      <p>${escapeHtml(local(post.excerpt))}</p>
      <div class="post-card-bottom">
        <div class="post-tags">${tags}</div>
        <a class="read-more" href="#/post/${encodeURIComponent(post.slug)}">${t("readMore")}</a>
      </div>
    </article>
  `;
}

function slugFromHeading(text, index) {
  return `h-${index}-${text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

function markdownToHtml(markdown = "") {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  const headings = [];
  let paragraph = [];
  let list = [];
  let quote = [];

  function flushParagraph() {
    if (paragraph.length) {
      html.push(`<p>${escapeHtml(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  }

  function flushList() {
    if (list.length) {
      html.push(`<ul>${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
      list = [];
    }
  }

  function flushQuote() {
    if (quote.length) {
      html.push(`<blockquote>${quote.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</blockquote>`);
      quote = [];
    }
  }

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      flushQuote();
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const id = slugFromHeading(text, headings.length);
      headings.push({ id, text, level });
      html.push(`<h${level} id="${id}">${escapeHtml(text)}</h${level}>`);
      return;
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      flushQuote();
      list.push(trimmed.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""));
      return;
    }

    if (trimmed.startsWith(">")) {
      flushParagraph();
      flushList();
      quote.push(trimmed.replace(/^>\s?/, ""));
      return;
    }

    paragraph.push(trimmed);
  });

  flushParagraph();
  flushList();
  flushQuote();
  return { html: html.join(""), headings };
}

function renderHome() {
  document.querySelector("[data-home-hero]").hidden = false;
  tocBlock.hidden = true;
  const published = sortedPosts();
  const featured = published.filter((post) => post.featured).slice(0, 3);
  const latest = published.slice(0, content.site.latestCount || 5);

  view.innerHTML = `
    <section class="section-block">
      <div class="section-head reveal">
        <p class="section-kicker">Featured</p>
        <h2>${t("featured")}</h2>
      </div>
      <div class="feature-grid">
        ${featured.map((post) => postCard(post, true)).join("")}
      </div>
    </section>
    <section class="section-block">
      <div class="section-head reveal">
        <p class="section-kicker">Latest</p>
        <h2>${t("latest")}</h2>
      </div>
      <div class="post-feed">
        ${latest.map((post) => postCard(post)).join("")}
      </div>
    </section>
  `;
  observeReveals();
}

function renderPostsPage(title = t("allPosts"), posts = sortedPosts()) {
  document.querySelector("[data-home-hero]").hidden = true;
  tocBlock.hidden = true;
  const filtered = posts.filter(searchMatches);
  view.innerHTML = `
    <section class="section-block">
      <div class="section-head reveal">
        <p class="section-kicker">Posts</p>
        <h1>${escapeHtml(title)}</h1>
        <p>${t("postCount", { n: filtered.length })}</p>
      </div>
      <div class="post-feed">
        ${filtered.length ? filtered.map((post) => postCard(post)).join("") : `<p class="empty">${t("noPosts")}</p>`}
      </div>
    </section>
  `;
  observeReveals();
}

function renderArchive() {
  document.querySelector("[data-home-hero]").hidden = true;
  tocBlock.hidden = true;
  const posts = sortedPosts().filter(searchMatches);
  const groups = groupedByYear(posts);
  const years = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  view.innerHTML = `
    <section class="section-block">
      <div class="section-head reveal">
        <p class="section-kicker">Archive</p>
        <h1>${t("archives")}</h1>
        <p>${t("archiveDesc", { n: posts.length })}</p>
      </div>
      <div class="archive-list">
        ${years
          .map(
            (year) => `
              <section class="archive-year reveal" id="year-${year}">
                <h2>${year}</h2>
                <div class="year-posts">
                  ${groups[year]
                    .map((post) => {
                      const { compact } = parseDate(post.date);
                      return `
                        <article class="archive-post">
                          <span class="archive-date">${compact}</span>
                          <div>
                            <a href="#/post/${encodeURIComponent(post.slug)}">${escapeHtml(local(post.title))}</a>
                            <p>${escapeHtml(local(post.excerpt))}</p>
                          </div>
                        </article>
                      `;
                    })
                    .join("")}
                </div>
              </section>
            `
          )
          .join("")}
      </div>
    </section>
  `;
  observeReveals();
}

function renderCategories() {
  document.querySelector("[data-home-hero]").hidden = true;
  tocBlock.hidden = true;
  view.innerHTML = `
    <section class="section-block">
      <div class="section-head reveal">
        <p class="section-kicker">Categories</p>
        <h1>${t("categoriesTitle")}</h1>
      </div>
      <div class="taxonomy-list">
        ${content.categories
          .map((category) => {
            const count = sortedPosts().filter((post) => post.category === category.id).length;
            return `
              <a class="taxonomy-card reveal" href="#/category/${encodeURIComponent(category.id)}">
                <strong>${escapeHtml(local(category.label))}</strong>
                <span>${count}</span>
                <p>${escapeHtml(local(category.description))}</p>
              </a>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
  observeReveals();
}

function renderTags() {
  document.querySelector("[data-home-hero]").hidden = true;
  tocBlock.hidden = true;
  view.innerHTML = `
    <section class="section-block">
      <div class="section-head reveal">
        <p class="section-kicker">Tags</p>
        <h1>${t("tagsTitle")}</h1>
      </div>
      <div class="tag-cloud">
        ${uniqueTags()
          .map((tag) => {
            const count = sortedPosts().filter((post) => post.tags.includes(tag)).length;
            return `<a class="reveal" href="#/tag/${encodeURIComponent(tag)}">${escapeHtml(tag)} <span>${count}</span></a>`;
          })
          .join("")}
      </div>
    </section>
  `;
  observeReveals();
}

function renderAbout() {
  document.querySelector("[data-home-hero]").hidden = true;
  tocBlock.hidden = true;
  view.innerHTML = `
    <section class="section-block about-page reveal">
      <div class="section-head">
        <p class="section-kicker">About</p>
        <h1>${t("aboutTitle")}</h1>
      </div>
      <p>${escapeHtml(local(content.author.bio))}</p>
      <p>${escapeHtml(t("aboutBody"))}</p>
      <h2>${escapeHtml(t("privacyTitle"))}</h2>
      <p>${escapeHtml(t("privacyBody"))}</p>
    </section>
  `;
  observeReveals();
}

function hideArticleDrawer() {
  tocBlock.hidden = true;
  tocBox.innerHTML = "";
  if (!articleDrawer) return;
  articleDrawer.hidden = true;
  drawerToggle.hidden = true;
  drawerToc.innerHTML = "";
  document.body.classList.remove("has-article-drawer", "article-drawer-closed");
}

function setDrawerOpen(open) {
  document.body.classList.toggle("article-drawer-closed", !open);
}

function selectDrawerTab(name) {
  drawerTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.drawerTab === name));
  drawerPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.drawerPanel === name));
}

function renderDrawerOverview() {
  if (!drawerOverview) return;
  drawerOverview.innerHTML = `
    <div class="drawer-author">
      <strong>${escapeHtml(local(content.author.name))}</strong>
      <p>${escapeHtml(local(content.author.bio))}</p>
    </div>
    <div class="drawer-stats">
      <span><strong>${sortedPosts().length}</strong>${t("statPosts")}</span>
      <span><strong>${content.categories.length}</strong>${t("statCategories")}</span>
      <span><strong>${uniqueTags(sortedPosts()).length}</strong>${t("statTags")}</span>
    </div>
    <ul>
      ${content.now.items.map((item) => `<li><strong>${escapeHtml(local(item.label))}</strong>${escapeHtml(local(item.value))}</li>`).join("")}
    </ul>
  `;
}

function numberedHeadings(headings) {
  let section = 0;
  let sub = 0;
  return headings
    .filter((heading) => heading.level > 1)
    .map((heading) => {
      if (heading.level === 2) {
        section += 1;
        sub = 0;
        return { ...heading, number: `${section}.` };
      }
      if (!section) section = 1;
      sub += 1;
      return { ...heading, number: `${section}.${sub}.` };
    });
}

function renderToc(headings) {
  const items = numberedHeadings(headings);
  if (!items.length) {
    hideArticleDrawer();
    return;
  }

  tocBlock.hidden = true;
  tocBox.innerHTML = "";
  articleDrawer.hidden = false;
  drawerToggle.hidden = false;
  document.body.classList.add("has-article-drawer");
  setDrawerOpen(window.matchMedia("(min-width: 1080px)").matches);
  selectDrawerTab("toc");
  renderDrawerOverview();

  drawerToc.innerHTML = items
    .map(
      (heading) =>
        `<a class="toc-level-${heading.level}" href="#${heading.id}" data-toc-target="${heading.id}">
          <span class="toc-number">${escapeHtml(heading.number)}</span>
          <span>${escapeHtml(heading.text)}</span>
        </a>`
    )
    .join("");

  drawerToc.querySelectorAll("[data-toc-target]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (!window.matchMedia("(min-width: 1080px)").matches) setDrawerOpen(false);
      document.getElementById(link.dataset.tocTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function activateTocOnScroll() {
  const headings = [...document.querySelectorAll(".article-body h2, .article-body h3")];
  const links = [...drawerToc.querySelectorAll("a")];
  if (!headings.length || !links.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`));
      });
    },
    { rootMargin: "-20% 0px -70% 0px" }
  );
  headings.forEach((heading) => observer.observe(heading));
}

function renderPost(slug) {
  document.querySelector("[data-home-hero]").hidden = true;
  const post = sortedPosts().find((item) => item.slug === slug);
  if (!post) {
    view.innerHTML = `<p class="empty">${t("noPosts")}</p>`;
    return;
  }

  const body = local(post.body);
  const parsed = markdownToHtml(body);
  const related = sortedPosts()
    .filter((item) => item.slug !== post.slug && (item.category === post.category || item.tags.some((tag) => post.tags.includes(tag))))
    .slice(0, 3);

  view.innerHTML = `
    <article class="article-view reveal">
      <header class="article-header">
        <p class="section-kicker">${escapeHtml(categoryLabel(post.category))}</p>
        <h1>${escapeHtml(local(post.title))}</h1>
        <div class="post-meta">
          <span>${escapeHtml(post.date)}</span>
          <span>${estimateReadTime(body)}</span>
          ${(post.tags || []).map((tag) => `<a href="#/tag/${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`).join("")}
        </div>
      </header>
      <div class="article-body">
        ${parsed.html}
      </div>
      <footer class="article-footer">
        <a href="#/posts">${t("navPosts")}</a>
      </footer>
    </article>
    ${
      related.length
        ? `<section class="section-block"><div class="section-head reveal"><p class="section-kicker">Related</p><h2>${t("related")}</h2></div><div class="feature-grid">${related
            .map((item) => postCard(item, true))
            .join("")}</div></section>`
        : ""
    }
  `;
  renderToc(parsed.headings);
  activateTocOnScroll();
  observeReveals();
}

function renderRoute() {
  const rawHash = window.location.hash || "#/";
  const hash = rawHash.replace(/^#\/?/, "");
  const [route, ...rest] = hash.split("/");
  const value = decodeURIComponent(rest.join("/"));

  hideArticleDrawer();

  if (!route) renderHome();
  else if (route === "posts") renderPostsPage();
  else if (route === "archives") renderArchive();
  else if (route === "categories") renderCategories();
  else if (route === "tags") renderTags();
  else if (route === "about") renderAbout();
  else if (route === "category") renderPostsPage(categoryLabel(value), sortedPosts().filter((post) => post.category === value));
  else if (route === "tag") renderPostsPage(`#${value}`, sortedPosts().filter((post) => post.tags.includes(value)));
  else if (route === "post") renderPost(value);
  else renderHome();

  updateProgress();
  trackCurrentVisit();
}

function renderSidebar() {
  const published = sortedPosts();
  const tags = uniqueTags(published);
  const recentLinks = document.querySelector("[data-recent-links]");
  const categoryLinks = document.querySelector("[data-category-links]");
  const nowList = document.querySelector("[data-now-list]");
  const socials = document.querySelector("[data-socials]");

  recentLinks.innerHTML = published
    .slice(0, 5)
    .map((post) => `<a href="#/post/${encodeURIComponent(post.slug)}">${escapeHtml(local(post.title))}</a>`)
    .join("");

  categoryLinks.innerHTML = content.categories
    .map((category) => {
      const count = published.filter((post) => post.category === category.id).length;
      return `<a href="#/category/${encodeURIComponent(category.id)}"><span>${escapeHtml(local(category.label))}</span><em>${count}</em></a>`;
    })
    .join("");

  nowList.innerHTML = content.now.items
    .map((item) => `<li><strong>${escapeHtml(local(item.label))}</strong>${escapeHtml(local(item.value))}</li>`)
    .join("");

  socials.innerHTML = content.socials
    .map((item) => {
      const external = item.url.startsWith("mailto:") || item.url.startsWith("#") ? "" : ' target="_blank" rel="noreferrer"';
      return `<a href="${escapeHtml(item.url)}"${external}>${escapeHtml(item.label)}</a>`;
    })
    .join("");

  setText("[data-stat-posts]", String(published.length));
  setText("[data-stat-categories]", String(content.categories.length));
  setText("[data-stat-tags]", String(tags.length));
}

function setSiteContent() {
  document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
  document.title = local(content.site.title);
  document.querySelector('meta[name="description"]').setAttribute("content", local(content.site.description));
  setText("[data-site-title]", local(content.site.name));
  setText("[data-site-subtitle]", local(content.site.subtitle));
  setText("[data-site-initials]", local(content.site.initials));
  setText("[data-author-name]", local(content.author.name));
  setText("[data-author-bio]", local(content.author.bio));
  setText("[data-home-title]", local(content.site.homeTitle));
  setText("[data-home-description]", local(content.site.homeDescription));
  setText("[data-home-slogan]", local(content.site.homeSlogan));
  setText("[data-post-count]", String(sortedPosts().length));
  setText("[data-footer]", local(content.footer));
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  searchInput.placeholder = t("searchPlaceholder");
  langButton.textContent = state.lang === "zh" ? "EN" : "中";
}

function observeReveals() {
  const items = document.querySelectorAll(".reveal");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("visible");
      });
    },
    { threshold: 0.08 }
  );
  items.forEach((item) => observer.observe(item));
}

function updateProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const percent = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
  const fixed = Math.min(100, Math.max(0, percent));
  progress.style.width = `${fixed}%`;
  meter.textContent = `${Math.round(fixed)}%`;
  backTop.classList.toggle("show", window.scrollY > 420);
}

function getStoredTheme() {
  try {
    return localStorage.getItem("blog-theme");
  } catch {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem("blog-theme", theme);
  } catch {
    // Local file previews can run with restricted storage.
  }
}

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  themeIcon.textContent = theme === "dark" ? "☀" : "◐";
}

function rerenderAll() {
  setSiteContent();
  renderSidebar();
  renderRoute();
}

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  const route = (window.location.hash || "#/").replace(/^#\/?/, "").split("/")[0];
  if (route === "archives") renderArchive();
  else if (route === "posts" || route === "category" || route === "tag") renderRoute();
  else window.location.hash = "#/posts";
});

themeButton.addEventListener("click", () => {
  const next = document.body.classList.contains("dark") ? "light" : "dark";
  applyTheme(next);
  storeTheme(next);
});

langButton.addEventListener("click", () => {
  state.lang = state.lang === "zh" ? "en" : "zh";
  localStorage.setItem("blog-lang", state.lang);
  rerenderAll();
});

backTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
drawerToggle.addEventListener("click", () => setDrawerOpen(true));
drawerClose.addEventListener("click", () => setDrawerOpen(false));
drawerTabs.forEach((tab) => tab.addEventListener("click", () => selectDrawerTab(tab.dataset.drawerTab)));

window.addEventListener("hashchange", renderRoute);
window.addEventListener("scroll", updateProgress, { passive: true });
window.addEventListener("resize", () => {
  if (document.body.classList.contains("has-article-drawer")) {
    setDrawerOpen(window.matchMedia("(min-width: 1080px)").matches);
  }
});

applyTheme(getStoredTheme() || content.site.defaultTheme || "light");
rerenderAll();
