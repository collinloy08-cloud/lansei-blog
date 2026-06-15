const STORAGE_KEY = "lansheng-blog-editor-draft-v5";
const AUTO_SYNC_KEY = "lansheng-blog-auto-sync-en";
let data = clone(window.BLOG_CONTENT);
let selectedPostSlug = data.posts[0]?.slug || "";
let editLang = "zh";
let autoSyncEnglish = localStorage.getItem(AUTO_SYNC_KEY) !== "off";

const panels = document.querySelectorAll("[data-panel]");
const tabs = document.querySelectorAll("[data-tab]");
const toast = document.querySelector("[data-toast]");
const editLangSelect = document.querySelector("[data-edit-lang]");
const autoSyncInput = document.querySelector("[data-auto-sync-en]");
const syncStatus = document.querySelector("[data-sync-status]");

const LOCALIZED_PATHS = new Set([
  "site.name",
  "site.title",
  "site.initials",
  "site.subtitle",
  "site.description",
  "site.homeTitle",
  "site.homeDescription",
  "site.homeSlogan",
  "author.name",
  "author.bio",
  "footer",
]);

const POST_LOCALIZED_FIELDS = new Set(["title", "excerpt", "body"]);
const CATEGORY_LOCALIZED_FIELDS = new Set(["label", "description"]);
const NOW_LOCALIZED_FIELDS = new Set(["label", "value"]);
const syncTimers = new Map();
let translatorPromise = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isLocalized(value) {
  return value && typeof value === "object" && !Array.isArray(value) && ("zh" in value || "en" in value);
}

function localized(value) {
  if (isLocalized(value)) return value[editLang] ?? value.zh ?? value.en ?? "";
  return value ?? "";
}

function toLocalized(value) {
  if (isLocalized(value)) return { zh: value.zh ?? "", en: value.en ?? "" };
  return editLang === "zh" ? { zh: value ?? "", en: "" } : { zh: "", en: value ?? "" };
}

function getPath(path) {
  return path.split(".").reduce((current, key) => current?.[key], data);
}

function setPath(path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((current, key) => current[key], data);
  target[last] = value;
}

function editableValue(path) {
  const value = getPath(path);
  return LOCALIZED_PATHS.has(path) ? localized(value) : value ?? "";
}

function setEditablePath(path, value) {
  if (!LOCALIZED_PATHS.has(path)) {
    setPath(path, value);
    return;
  }

  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((current, key) => current[key], data);
  target[last] = toLocalized(target[last]);
  target[last][editLang] = value;
}

function setLocalizedField(target, key, value) {
  target[key] = toLocalized(target[key]);
  target[key][editLang] = value;
}

function setEnglishPath(path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((current, key) => current[key], data);
  target[last] = toLocalized(target[last]);
  target[last].en = value;
}

function setEnglishField(target, key, value) {
  target[key] = toLocalized(target[key]);
  target[key].en = value;
}

function updateSyncStatus(message, strong = "") {
  if (!syncStatus) return;
  syncStatus.innerHTML = strong ? `<strong>${escapeHtml(strong)}</strong> ${escapeHtml(message)}` : escapeHtml(message);
}

function fallbackEnglishDraft(text) {
  if (!String(text || "").trim()) return "";
  return `[Needs English polish]\n\n${text}`;
}

function splitForTranslation(text, maxLength = 900) {
  const parts = String(text || "").split(/(\n{2,})/);
  const chunks = [];
  let current = "";
  parts.forEach((part) => {
    if ((current + part).length > maxLength && current) {
      chunks.push(current);
      current = part;
    } else {
      current += part;
    }
  });
  if (current) chunks.push(current);
  return chunks;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("translation timeout")), ms);
    }),
  ]);
}

async function getBrowserTranslator() {
  if (translatorPromise) return translatorPromise;
  translatorPromise = (async () => {
    try {
      if (window.Translator?.create) {
        const options = { sourceLanguage: "zh", targetLanguage: "en" };
        const availability = window.Translator.availability ? await window.Translator.availability(options) : "available";
        if (availability !== "unavailable") return window.Translator.create(options);
      }
      if (window.translation?.createTranslator) {
        return window.translation.createTranslator({ sourceLanguage: "zh", targetLanguage: "en" });
      }
    } catch {
      return null;
    }
    return null;
  })();
  return translatorPromise;
}

async function translateWithBrowser(text) {
  const translator = await getBrowserTranslator();
  if (!translator?.translate) return null;
  return withTimeout(translator.translate(text), 3500);
}

async function translateWithPublicEndpoint(text) {
  const chunks = splitForTranslation(text);
  const translated = [];
  for (const chunk of chunks) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4500);
    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q=" +
      encodeURIComponent(chunk);
    let response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      window.clearTimeout(timeout);
    }
    if (!response.ok) throw new Error("online translation failed");
    const payload = await response.json();
    translated.push(payload[0].map((item) => item[0]).join(""));
  }
  return translated.join("");
}

async function translateZhToEn(text) {
  const value = String(text || "");
  if (!value.trim()) return "";

  try {
    const browserResult = await translateWithBrowser(value);
    if (browserResult) return browserResult;
  } catch {
    // Continue to the public endpoint fallback.
  }

  try {
    return await translateWithPublicEndpoint(value);
  } catch {
    return fallbackEnglishDraft(value);
  }
}

function queueEnglishSync(key, sourceText, apply, delay = 900) {
  if (!autoSyncEnglish || editLang !== "zh") return;
  window.clearTimeout(syncTimers.get(key));
  updateSyncStatus("正在等待你停止输入，然后更新英文版。", "自动同步已开启");
  syncTimers.set(
    key,
    window.setTimeout(async () => {
      const translated = await translateZhToEn(sourceText);
      apply(translated);
      persistDraft();
      updateSyncStatus(
        translated.startsWith("[Needs English polish]")
          ? "浏览器暂时无法自动翻译，已在英文版生成待润色草稿。"
          : "对应英文内容已更新，保存 content.js 后前台英文版会同步变化。",
        "英文同步完成"
      );
      if (editLang === "en") renderAll();
    }, delay)
  );
}

async function syncLocalizedPath(path) {
  const value = toLocalized(getPath(path)).zh;
  setEnglishPath(path, await translateZhToEn(value));
}

async function syncLocalizedObjectField(target, key) {
  const value = toLocalized(target[key]).zh;
  setEnglishField(target, key, await translateZhToEn(value));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function slugify(text) {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || `post-${Date.now()}`
  );
}

function serialize() {
  return `window.BLOG_CONTENT = ${JSON.stringify(data, null, 2)};\n`;
}

function persistDraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  updateExportBox();
}

function loadDraftIfAny() {
  const draft = localStorage.getItem(STORAGE_KEY);
  if (!draft) return;
  try {
    data = JSON.parse(draft);
    selectedPostSlug = data.posts[0]?.slug || "";
    showToast("已载入浏览器草稿");
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function markdownPreview(markdown = "") {
  return markdown
    .split(/\n{2,}/)
    .map((block) => {
      const line = block.trim();
      if (!line) return "";
      if (line.startsWith("## ")) return `<h4>${escapeHtml(line.slice(3))}</h4>`;
      if (line.startsWith("# ")) return `<h3>${escapeHtml(line.slice(2))}</h3>`;
      if (/^[-*]\s+/m.test(line)) {
        return `<ul>${line
          .split("\n")
          .map((item) => `<li>${escapeHtml(item.replace(/^[-*]\s+/, ""))}</li>`)
          .join("")}</ul>`;
      }
      return `<p>${escapeHtml(line).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bindFields() {
  document.querySelectorAll("[data-field]").forEach((field) => {
    const path = field.dataset.field;
    field.value = editableValue(path);
    const update = () => {
      const value = field.type === "number" ? Number(field.value || 0) : field.value;
      setEditablePath(path, value);
      if (LOCALIZED_PATHS.has(path)) {
        queueEnglishSync(`path:${path}`, field.value, (translated) => setEnglishPath(path, translated), field.tagName === "TEXTAREA" ? 1400 : 700);
      }
      persistDraft();
    };
    field.oninput = update;
    field.onchange = update;
  });
}

function renderNow() {
  const box = document.querySelector("[data-now-editor]");
  box.innerHTML = data.now.items
    .map(
      (item, index) => `
        <div class="item-row" data-now-index="${index}">
          <input value="${escapeHtml(localized(item.label))}" placeholder="标签" data-now-field="label" />
          <input value="${escapeHtml(localized(item.value))}" placeholder="内容" data-now-field="value" />
          <button class="button danger small" type="button" data-remove-now>删除</button>
        </div>
      `
    )
    .join("");
}

function renderSocials() {
  const box = document.querySelector("[data-social-editor]");
  box.innerHTML = data.socials
    .map(
      (item, index) => `
        <div class="item-row" data-social-index="${index}">
          <input value="${escapeHtml(item.label)}" placeholder="名称" data-social-field="label" />
          <input value="${escapeHtml(item.url)}" placeholder="链接" data-social-field="url" />
          <button class="button danger small" type="button" data-remove-social>删除</button>
        </div>
      `
    )
    .join("");
}

function renderCategories() {
  const box = document.querySelector("[data-category-editor]");
  box.innerHTML = data.categories
    .map(
      (item, index) => `
        <div class="item-row wide" data-category-index="${index}">
          <input value="${escapeHtml(item.id)}" placeholder="id" data-category-field="id" />
          <input value="${escapeHtml(localized(item.label))}" placeholder="显示名" data-category-field="label" />
          <input value="${escapeHtml(localized(item.description))}" placeholder="描述" data-category-field="description" />
          <button class="button danger small" type="button" data-remove-category>删除</button>
        </div>
      `
    )
    .join("");
  renderCategorySelect();
}

function renderCategorySelect() {
  const select = document.querySelector("[data-post-field='category']");
  if (!select) return;
  select.innerHTML = data.categories
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(localized(item.label))}</option>`)
    .join("");
}

function sortedPosts() {
  return [...data.posts].sort((a, b) => b.date.localeCompare(a.date));
}

function selectedPost() {
  return data.posts.find((post) => post.slug === selectedPostSlug) || data.posts[0];
}

function renderPostList() {
  const box = document.querySelector("[data-post-list]");
  box.innerHTML = sortedPosts()
    .map(
      (post) => `
        <button class="post-list-item ${post.slug === selectedPostSlug ? "active" : ""}" type="button" data-select-post="${escapeHtml(post.slug)}">
          <strong>${escapeHtml(localized(post.title) || "未命名文章")}</strong>
          <span>${escapeHtml(post.date || "未填日期")} / ${escapeHtml(post.category || "未分类")}</span>
        </button>
      `
    )
    .join("");
}

function renderPostForm() {
  const post = selectedPost();
  if (!post) return;
  selectedPostSlug = post.slug;
  renderCategorySelect();
  document.querySelectorAll("[data-post-field]").forEach((field) => {
    const key = field.dataset.postField;
    if (key === "tags") field.value = (post.tags || []).join(", ");
    else if (key === "featured") field.checked = Boolean(post.featured);
    else field.value = POST_LOCALIZED_FIELDS.has(key) ? localized(post[key]) : post[key] ?? "";
  });
  renderPreview();
  renderPostList();
}

function renderPreview() {
  const post = selectedPost();
  document.querySelector("[data-preview]").innerHTML = `
    <h2>${escapeHtml(localized(post.title) || "未命名文章")}</h2>
    <p>${escapeHtml(post.date || "")} / ${escapeHtml(post.category || "")}</p>
    <p>${escapeHtml(localized(post.excerpt))}</p>
    ${markdownPreview(localized(post.body))}
  `;
}

function updateExportBox() {
  const box = document.querySelector("[data-export]");
  if (box) box.value = serialize();
}

function renderAll() {
  bindFields();
  renderNow();
  renderSocials();
  renderCategories();
  renderPostList();
  renderPostForm();
  updateExportBox();
}

function switchTab(name) {
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === name));
}

function downloadContent() {
  const blob = new Blob([serialize()], { type: "text/javascript;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "content.js";
  link.click();
  URL.revokeObjectURL(url);
  showToast("已下载 content.js");
}

async function saveDirect() {
  if (!window.showSaveFilePicker) {
    downloadContent();
    showToast("浏览器不支持直接保存，已改为下载文件");
    return;
  }

  const handle = await window.showSaveFilePicker({
    suggestedName: "content.js",
    types: [{ description: "JavaScript", accept: { "text/javascript": [".js"] } }],
  });
  const writable = await handle.createWritable();
  await writable.write(serialize());
  await writable.close();
  showToast("已保存 content.js，刷新博客即可看到更新");
}

function parseImported(text) {
  if (text.trim().startsWith("{")) return JSON.parse(text);
  const match = text.match(/window\.BLOG_CONTENT\s*=\s*([\s\S]*);\s*$/);
  if (!match) throw new Error("没有找到 window.BLOG_CONTENT");
  return Function(`"use strict"; return (${match[1]});`)();
}

async function syncCurrentScope() {
  const activePanel = document.querySelector(".panel.active")?.dataset.panel || "site";
  updateSyncStatus("正在把中文内容同步到英文版，请稍等。", "同步中");

  if (activePanel === "site") {
    for (const path of [
      "site.name",
      "site.title",
      "site.initials",
      "site.subtitle",
      "site.description",
      "site.homeTitle",
      "site.homeDescription",
      "site.homeSlogan",
      "footer",
    ]) {
      await syncLocalizedPath(path);
    }
  }

  if (activePanel === "author") {
    for (const path of ["author.name", "author.bio"]) await syncLocalizedPath(path);
    for (const item of data.now.items) {
      for (const key of NOW_LOCALIZED_FIELDS) await syncLocalizedObjectField(item, key);
    }
  }

  if (activePanel === "categories") {
    for (const category of data.categories) {
      for (const key of CATEGORY_LOCALIZED_FIELDS) await syncLocalizedObjectField(category, key);
    }
  }

  if (activePanel === "posts") {
    const post = selectedPost();
    for (const key of POST_LOCALIZED_FIELDS) await syncLocalizedObjectField(post, key);
  }

  if (activePanel === "export") {
    for (const path of LOCALIZED_PATHS) await syncLocalizedPath(path);
    for (const item of data.now.items) {
      for (const key of NOW_LOCALIZED_FIELDS) await syncLocalizedObjectField(item, key);
    }
    for (const category of data.categories) {
      for (const key of CATEGORY_LOCALIZED_FIELDS) await syncLocalizedObjectField(category, key);
    }
    for (const post of data.posts) {
      for (const key of POST_LOCALIZED_FIELDS) await syncLocalizedObjectField(post, key);
    }
  }

  persistDraft();
  renderAll();
  updateSyncStatus("当前范围的英文内容已根据中文更新。保存 content.js 后前台英文版会同步变化。", "同步完成");
  showToast("英文版已同步");
}

tabs.forEach((tab) => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));

if (editLangSelect) {
  editLangSelect.value = editLang;
  editLangSelect.addEventListener("change", () => {
    editLang = editLangSelect.value;
    renderAll();
    showToast(editLang === "zh" ? "正在编辑中文内容" : "Editing English content");
  });
}

if (autoSyncInput) {
  autoSyncInput.checked = autoSyncEnglish;
  autoSyncInput.addEventListener("change", () => {
    autoSyncEnglish = autoSyncInput.checked;
    localStorage.setItem(AUTO_SYNC_KEY, autoSyncEnglish ? "on" : "off");
    updateSyncStatus(
      autoSyncEnglish ? "你编辑中文字段后，对应英文内容会自动更新。" : "自动同步已关闭，你可以用按钮手动同步当前内容。",
      autoSyncEnglish ? "自动同步已开启" : "自动同步已关闭"
    );
  });
}

document.addEventListener("input", (event) => {
  const nowRow = event.target.closest("[data-now-index]");
  if (nowRow && event.target.dataset.nowField) {
    const item = data.now.items[Number(nowRow.dataset.nowIndex)];
    const key = event.target.dataset.nowField;
    if (NOW_LOCALIZED_FIELDS.has(key)) setLocalizedField(item, key, event.target.value);
    else item[key] = event.target.value;
    if (NOW_LOCALIZED_FIELDS.has(key)) {
      queueEnglishSync(`now:${nowRow.dataset.nowIndex}:${key}`, event.target.value, (translated) =>
        setEnglishField(item, key, translated)
      );
    }
    persistDraft();
  }

  const socialRow = event.target.closest("[data-social-index]");
  if (socialRow && event.target.dataset.socialField) {
    data.socials[Number(socialRow.dataset.socialIndex)][event.target.dataset.socialField] = event.target.value;
    persistDraft();
  }

  const categoryRow = event.target.closest("[data-category-index]");
  if (categoryRow && event.target.dataset.categoryField) {
    const category = data.categories[Number(categoryRow.dataset.categoryIndex)];
    const key = event.target.dataset.categoryField;
    if (CATEGORY_LOCALIZED_FIELDS.has(key)) setLocalizedField(category, key, event.target.value);
    else category[key] = event.target.value;
    if (CATEGORY_LOCALIZED_FIELDS.has(key)) {
      queueEnglishSync(`category:${categoryRow.dataset.categoryIndex}:${key}`, event.target.value, (translated) =>
        setEnglishField(category, key, translated)
      );
    }
    persistDraft();
    renderCategorySelect();
  }

  if (event.target.dataset.postField) {
    const post = selectedPost();
    const key = event.target.dataset.postField;
    if (key === "tags") post.tags = event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean);
    else if (key === "featured") post.featured = event.target.checked;
    else if (POST_LOCALIZED_FIELDS.has(key)) setLocalizedField(post, key, event.target.value);
    else post[key] = event.target.value;
    if (POST_LOCALIZED_FIELDS.has(key)) {
      queueEnglishSync(`post:${post.slug}:${key}`, event.target.value, (translated) => setEnglishField(post, key, translated), key === "body" ? 1700 : 900);
    }
    if (key === "title" && !post.slug) post.slug = slugify(event.target.value);
    if (key === "slug") selectedPostSlug = post.slug;
    persistDraft();
    renderPreview();
    renderPostList();
  }
});

document.addEventListener("click", (event) => {
  const selectPost = event.target.closest("[data-select-post]");
  if (selectPost) {
    selectedPostSlug = selectPost.dataset.selectPost;
    renderPostForm();
  }

  if (event.target.matches("[data-add-now]")) {
    data.now.items.push({
      label: { zh: "新的状态", en: "New status" },
      value: { zh: "待填写", en: "To be filled" },
    });
    persistDraft();
    renderNow();
  }

  if (event.target.matches("[data-remove-now]")) {
    data.now.items.splice(Number(event.target.closest("[data-now-index]").dataset.nowIndex), 1);
    persistDraft();
    renderNow();
  }

  if (event.target.matches("[data-add-social]")) {
    data.socials.push({ label: "新链接", url: "#" });
    persistDraft();
    renderSocials();
  }

  if (event.target.matches("[data-remove-social]")) {
    data.socials.splice(Number(event.target.closest("[data-social-index]").dataset.socialIndex), 1);
    persistDraft();
    renderSocials();
  }

  if (event.target.matches("[data-add-category]")) {
    data.categories.push({
      id: `category-${Date.now()}`,
      label: { zh: "新分类", en: "New Category" },
      description: { zh: "", en: "" },
    });
    persistDraft();
    renderCategories();
  }

  if (event.target.matches("[data-remove-category]")) {
    data.categories.splice(Number(event.target.closest("[data-category-index]").dataset.categoryIndex), 1);
    persistDraft();
    renderCategories();
  }

  if (event.target.matches("[data-new-post]")) {
    const post = {
      slug: `new-post-${Date.now()}`,
      title: { zh: "未命名文章", en: "Untitled Post" },
      category: data.categories[0]?.id || "essay",
      date: new Date().toISOString().slice(0, 10).replaceAll("-", "."),
      excerpt: { zh: "这里写文章摘要。", en: "Write the post summary here." },
      tags: ["新文章", "new"],
      featured: false,
      status: "draft",
      body: { zh: "## 小标题\n\n从这里开始写正文。", en: "## Heading\n\nStart writing here." },
    };
    data.posts.unshift(post);
    selectedPostSlug = post.slug;
    persistDraft();
    renderPostList();
    renderPostForm();
  }

  if (event.target.matches("[data-duplicate-post]")) {
    const post = clone(selectedPost());
    post.slug = `${post.slug}-copy-${Date.now()}`;
    if (isLocalized(post.title)) {
      post.title.zh = `${post.title.zh || "未命名文章"} 副本`;
      post.title.en = `${post.title.en || "Untitled Post"} Copy`;
    } else {
      post.title = `${post.title} 副本`;
    }
    data.posts.unshift(post);
    selectedPostSlug = post.slug;
    persistDraft();
    renderPostList();
    renderPostForm();
  }

  if (event.target.matches("[data-delete-post]")) {
    if (!confirm("确定删除这篇文章吗？")) return;
    const index = data.posts.findIndex((post) => post.slug === selectedPostSlug);
    if (index >= 0) data.posts.splice(index, 1);
    selectedPostSlug = data.posts[0]?.slug || "";
    persistDraft();
    renderPostList();
    renderPostForm();
  }

  if (event.target.matches("[data-download]")) downloadContent();
  if (event.target.matches("[data-save-direct]")) saveDirect().catch((error) => showToast(error.message));
  if (event.target.matches("[data-sync-current]")) syncCurrentScope().catch((error) => showToast(`同步失败：${error.message}`));
  if (event.target.matches("[data-copy]")) {
    navigator.clipboard.writeText(serialize()).then(() => showToast("已复制 content.js 内容"));
  }
  if (event.target.matches("[data-reset-draft]")) {
    localStorage.removeItem(STORAGE_KEY);
    data = clone(window.BLOG_CONTENT);
    selectedPostSlug = data.posts[0]?.slug || "";
    renderAll();
    showToast("已清除草稿并恢复到当前 content.js");
  }
});

document.querySelector("[data-import]").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    data = parseImported(text);
    selectedPostSlug = data.posts[0]?.slug || "";
    persistDraft();
    renderAll();
    showToast("导入成功");
  } catch (error) {
    showToast(`导入失败：${error.message}`);
  }
});

loadDraftIfAny();
renderAll();
updateSyncStatus(
  autoSyncEnglish ? "你编辑中文字段后，对应英文内容会自动更新。" : "自动同步已关闭，你可以用按钮手动同步当前内容。",
  autoSyncEnglish ? "自动同步已开启" : "自动同步已关闭"
);
