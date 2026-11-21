(() => {
  "use strict";
  window.__ps4tl = true; // lets the page know this script started (see loading watchdog in each page)

  // Resolve every path from the site root (the folder app.js lives in), so pages in /pages work,
  // as does a GitHub Pages project URL (user.github.io/repo/).
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || new URL("app.js", location.href).href;
  const ROOT = new URL("./", SCRIPT_SRC);
  const u = (path = "") => new URL(path, ROOT).href;

  const $ = (selector, root = document) => root.querySelector(selector);
  const FAVORITES_KEY = "ps4tl:favorites";
  const RATINGS_KEY = "ps4tl:ratings";
  const DOWNLOADS_KEY = "ps4tl:downloads";
  const PREVIEW_FALLBACK = u("assets/images/preview-fallback.svg");
  const COVER_FALLBACK = u("assets/images/cover-fallback.svg");
  const FETCH_TIMEOUT_MS = 15000;

  let config = {};
  let toastTimer;

  // ---- helpers --------------------------------------------------------------
  function readStore(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
  const favorites = () => readStore(FAVORITES_KEY, []);
  const ratingData = () => readStore(RATINGS_KEY, {});

  function notify(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }
  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  const asArray = v => Array.isArray(v) ? v : (typeof v === "string" && v.trim() ? v.split(",").map(x => x.trim()).filter(Boolean) : []);

  function assetUrl(base, file) {
    if (!file) return "";
    if (/^(https?:|data:|blob:)/i.test(file)) return file;
    return u(`${base.replace(/\/$/, "")}/${String(file).replace(/^\//, "")}`);
  }
  async function fetchJson(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(u(path), {cache: "no-cache", signal: controller.signal});
      if (!res.ok) throw new Error(`${path} returned HTTP ${res.status}`);
      try { return await res.json(); }
      catch { throw new Error(`${path} is not valid JSON (check for a missing or extra comma)`); }
    } catch (error) {
      if (error.name === "AbortError") throw new Error(`${path} took too long to load`);
      throw error;
    } finally { clearTimeout(timer); }
  }

  const themeKey = theme => `${theme.collectionId}/${theme.id}`;
  const themeHref = theme => u(`pages/theme.html?collection=${encodeURIComponent(theme.collectionId)}&id=${encodeURIComponent(theme.id)}`);
  const collectionHref = collection => u(`pages/collection.html?id=${encodeURIComponent(collection.id)}`);
  const previewUrl = theme => assetUrl(theme.basePath, theme.preview) || PREVIEW_FALLBACK;
  const coverUrl = collection => assetUrl(collection.basePath, collection.cover) || COVER_FALLBACK;

  function ratingFor(key) {
    const r = ratingData()[key];
    return r && r.count ? {average: r.sum / r.count, count: r.count} : {average: 0, count: 0};
  }

  // ---- data loading (each page loads only what it needs) ---------------------
  async function loadConfig() {
    config = await fetchJson("config.json").catch(() => ({}));
  }
  async function loadRegistry() {
    const registry = await fetchJson("data/collections.json");
    const slugs = Array.isArray(registry) ? registry : registry.collections;
    if (!Array.isArray(slugs)) throw new Error("data/collections.json must contain a \"collections\" array");
    return slugs;
  }
  // One collection's own info.json (no theme files are read here).
  async function loadCollection(slug) {
    const basePath = `collections/${encodeURIComponent(slug)}`;
    const info = await fetchJson(`${basePath}/info.json`);
    return {...info, id: slug, basePath, themeSlugs: asArray(info.themes)};
  }
  async function loadCollections(problems) {
    const slugs = await loadRegistry();
    const loaded = await Promise.all(slugs.map(slug => loadCollection(slug).catch(error => {
      console.warn(error);
      problems.push(`Collection "${slug}" could not be loaded: ${error.message}`);
      return null;
    })));
    return loaded.filter(Boolean);
  }
  async function loadTheme(collection, slug) {
    const themePath = `${collection.basePath}/${encodeURIComponent(slug)}`;
    const info = await fetchJson(`${themePath}/info.json`);
    return {...info, tags: asArray(info.tags), id: slug, collectionId: collection.id,
      collectionTitle: collection.title || collection.id, basePath: themePath};
  }
  async function loadThemes(collection, problems) {
    const themes = await Promise.all(collection.themeSlugs.map(slug => loadTheme(collection, slug).catch(error => {
      console.warn(error);
      problems.push(`Theme "${slug}" in "${collection.id}" could not be loaded: ${error.message}`);
      return null;
    })));
    return themes.filter(Boolean);
  }

  // ---- cards ----------------------------------------------------------------
  function favoriteButton(theme) {
    const on = favorites().includes(themeKey(theme));
    return `<button class="favorite-button ${on ? "is-favorite" : ""}" data-favorite="${escapeHtml(themeKey(theme))}" aria-label="${on ? "Remove from" : "Add to"} favorites" title="${on ? "Remove favorite" : "Add favorite"}">${on ? "♥" : "♡"}</button>`;
  }
  function themeCard(theme) {
    const r = ratingFor(themeKey(theme));
    return `<article class="theme-card">
      <a class="theme-image" href="${themeHref(theme)}"><img src="${escapeHtml(previewUrl(theme))}" alt="${escapeHtml(theme.title)} preview" loading="lazy" onerror="this.onerror=null;this.src='${PREVIEW_FALLBACK}'">${theme.type ? `<span class="type-pill">${escapeHtml(theme.type)}</span>` : ""}</a>
      ${favoriteButton(theme)}
      <div class="card-content"><div class="card-topline"><h3 class="card-title">${escapeHtml(theme.title || theme.id)}</h3><span class="rating-mini">${r.count ? `★ ${r.average.toFixed(1)}` : ""}</span></div>
      <p class="card-description">${escapeHtml(theme.description || "")}</p>
      <div class="card-meta"><span>${escapeHtml(theme.author || "Unknown creator")}</span><a href="${themeHref(theme)}">Details →</a></div></div>
    </article>`;
  }
  function collectionCard(collection) {
    const n = collection.themeSlugs.length;
    return `<a class="collection-card" href="${collectionHref(collection)}">
      <img src="${escapeHtml(coverUrl(collection))}" alt="${escapeHtml(collection.title)} cover" loading="lazy" onerror="this.onerror=null;this.src='${COVER_FALLBACK}'">
      <div class="collection-card-content"><h3>${escapeHtml(collection.title || collection.id)}</h3><p>${escapeHtml(collection.description || "")}</p><small>${n} ${n === 1 ? "THEME" : "THEMES"}${collection.author ? ` · BY ${escapeHtml(collection.author)}` : ""}</small></div>
    </a>`;
  }
  function problemBanner(problems) {
    if (!problems.length) return "";
    return `<div class="problem-banner"><strong>Some content could not be loaded</strong><ul>${problems.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul></div>`;
  }

  // ---- shared UI ------------------------------------------------------------
  function updateNavCount() {
    const el = $("#favorite-nav-count");
    if (el) el.textContent = favorites().length;
  }
  function setupGithubLink() {
    const link = $(".github-link");
    if (!link) return;
    let url = (config.repositoryUrl || "").trim();
    if (!url && /\.github\.io$/i.test(location.hostname)) {
      const owner = location.hostname.split(".")[0];
      const repo = location.pathname.split("/").filter(Boolean)[0];
      url = repo && !/\.html$/i.test(repo) ? `https://github.com/${owner}/${repo}` : `https://github.com/${owner}`;
    }
    if (url) link.href = url; else link.remove();
  }
  function attachFavoriteEvents(root, rerender) {
    root.querySelectorAll("[data-favorite]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault(); event.stopPropagation();
        const key = button.dataset.favorite;
        const current = favorites();
        const next = current.includes(key) ? current.filter(x => x !== key) : [...current, key];
        writeStore(FAVORITES_KEY, next);
        updateNavCount();
        if (rerender) rerender();
        else {
          const on = next.includes(key);
          button.classList.toggle("is-favorite", on);
          button.textContent = on ? "♥" : "♡";
        }
        notify(next.includes(key) ? "Added to favorites" : "Removed from favorites");
      });
    });
  }

  // ---- pages ----------------------------------------------------------------
  async function renderHome() {
    const grid = $("#collection-grid"), input = $("#search-input");
    const problems = [];
    const collections = await loadCollections(problems);
    const banner = $("#problems");
    if (banner) banner.innerHTML = problemBanner(problems);
    const draw = () => {
      const q = (input ? input.value : "").trim().toLowerCase();
      const list = q ? collections.filter(c => [c.title, c.author, c.description].join(" ").toLowerCase().includes(q)) : collections;
      grid.innerHTML = list.length
        ? list.map(collectionCard).join("")
        : `<div class="empty-state"><strong>${collections.length ? "No collections found" : "No collections yet"}</strong>${collections.length ? "Try a different search." : "Add a collection folder to get started."}</div>`;
    };
    if (input) input.addEventListener("input", draw);
    draw();
  }

  async function renderCollectionPage() {
    const root = $("#collection-detail");
    const id = new URLSearchParams(location.search).get("id");
    if (!id) { location.replace(u("")); return; }
    let collection;
    try { collection = await loadCollection(id); }
    catch (error) {
      console.warn(error);
      root.innerHTML = `<div class="empty-state"><strong>Collection not found</strong>${escapeHtml(error.message)}</div><p><a class="text-link" href="${u("")}">← Back to collections</a></p>`;
      return;
    }
    document.title = `${collection.title || id} · ${config.siteName || "PS4 Theme Library"}`;
    const problems = [];
    const themes = await loadThemes(collection, problems);
    const n = collection.themeSlugs.length;
    const archiveHref = assetUrl(collection.basePath, collection.archive || "collection.zip");
    root.innerHTML = `<a class="detail-back" href="${u("")}">← All collections</a>
      <section class="collection-detail-head"><img src="${escapeHtml(coverUrl(collection))}" alt="${escapeHtml(collection.title)} cover" onerror="this.onerror=null;this.src='${COVER_FALLBACK}'">
        <div><h1>${escapeHtml(collection.title || id)}</h1><p>${escapeHtml(collection.description || "")}</p>
        <small>${n} ${n === 1 ? "theme" : "themes"}${collection.author ? ` · by ${escapeHtml(collection.author)}` : ""}</small>
        <div class="detail-actions" id="collection-actions"></div></div></section>
      ${problemBanner(problems)}
      <div class="section-heading"><h2>Themes</h2></div>
      <div class="theme-grid">${themes.length ? themes.map(themeCard).join("") : `<div class="empty-state">This collection has no themes yet.</div>`}</div>`;
    attachFavoriteEvents(root);

    // Only offer the ZIP if it exists (the GitHub workflow generates it).
    try {
      const head = await fetch(archiveHref, {method: "HEAD", cache: "no-cache"});
      if (head.ok) $("#collection-actions").innerHTML = `<a class="button button-primary" href="${escapeHtml(archiveHref)}" download>↓ Download collection ZIP</a>`;
    } catch {}
  }

  async function renderFavorites() {
    const root = $("#favorites-grid");
    const keys = favorites();
    const bySlug = {};
    keys.forEach(k => { const [c, ...rest] = k.split("/"); if (c && rest.length) (bySlug[c] ||= []).push(rest.join("/")); });
    const themes = [];
    await Promise.all(Object.entries(bySlug).map(async ([slug, themeSlugs]) => {
      try {
        const collection = await loadCollection(slug);
        for (const t of themeSlugs) { try { themes.push(await loadTheme(collection, t)); } catch (e) { console.warn(e); } }
      } catch (e) { console.warn(e); }
    }));
    themes.sort((a, b) => keys.indexOf(themeKey(a)) - keys.indexOf(themeKey(b)));
    const draw = () => {
      const current = favorites();
      const shown = themes.filter(t => current.includes(themeKey(t)));
      root.innerHTML = shown.length
        ? shown.map(themeCard).join("")
        : `<div class="empty-state"><strong>No favorites yet</strong>Open a collection and tap the heart on a theme to save it here. Favorites are stored only in this browser.</div>`;
      attachFavoriteEvents(root, draw);
    };
    draw();
  }

  async function renderThemePage() {
    const root = $("#theme-detail");
    const params = new URLSearchParams(location.search);
    const collectionId = params.get("collection"), id = params.get("id");
    const notFound = message => {
      root.innerHTML = `<div class="empty-state"><strong>Theme not found</strong>${escapeHtml(message)}</div><p><a class="text-link" href="${u("")}">← Back to collections</a></p>`;
    };
    if (!collectionId || !id) return notFound("The link is missing the collection or theme name.");
    let theme;
    try { theme = await loadTheme(await loadCollection(collectionId), id); }
    catch (error) { console.warn(error); return notFound(error.message); }
    document.title = `${theme.title || id} · ${config.siteName || "PS4 Theme Library"}`;
    drawTheme(root, theme);
  }

  function drawTheme(root, theme) {
    const key = themeKey(theme), r = ratingFor(key);
    const download = theme.download ? assetUrl(theme.basePath, theme.download) : "";
    root.innerHTML = `<a class="detail-back" href="${collectionHref({id: theme.collectionId})}">← ${escapeHtml(theme.collectionTitle)}</a>
      <div class="detail-layout"><div><img class="detail-preview" src="${escapeHtml(previewUrl(theme))}" alt="${escapeHtml(theme.title)} preview" onerror="this.onerror=null;this.src='${PREVIEW_FALLBACK}'">
      <div class="rating-box"><strong>Rate this theme</strong><div class="stars" role="group" aria-label="Rate this theme">${[1,2,3,4,5].map(n => `<button class="star-button ${r.count && n <= Math.round(r.average) ? "selected" : ""}" data-rate="${n}" aria-label="Rate ${n} out of 5">★</button>`).join("")}</div><p class="muted-small">${r.count ? `Your rating: ${r.average.toFixed(0)} / 5 (saved in this browser)` : "Your rating is saved in this browser."}</p></div></div>
      <div class="detail-info">${theme.type ? `<p class="eyebrow">${escapeHtml(String(theme.type).toUpperCase())} THEME</p>` : ""}<h1>${escapeHtml(theme.title || theme.id)}</h1><p>${escapeHtml(theme.description || "")}</p>
      <div class="detail-actions">${download ? `<a class="button button-primary" id="download-theme" href="${escapeHtml(download)}" download>↓ Download .pkg</a>` : `<button class="button button-primary" disabled title="No download file has been added to this theme yet">Download unavailable</button>`}<button class="button button-quiet" data-favorite="${escapeHtml(key)}">${favorites().includes(key) ? "♥ Saved" : "♡ Favorite"}</button></div>
      <div class="metadata-list"><div class="metadata-row"><span>Creator</span><b>${escapeHtml(theme.author || "Unknown")}</b></div><div class="metadata-row"><span>Collection</span><b>${escapeHtml(theme.collectionTitle)}</b></div><div class="metadata-row"><span>Type</span><b>${escapeHtml(theme.type || "Not specified")}</b></div><div class="metadata-row"><span>Version</span><b>${escapeHtml(theme.version || "—")}</b></div><div class="metadata-row"><span>Added</span><b>${escapeHtml(theme.created || "—")}</b></div></div>
      ${theme.tags.length ? `<div class="tag-list">${theme.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      ${theme.notes ? `<p class="detail-notes">${escapeHtml(theme.notes)}</p>` : ""}</div></div>`;
    attachFavoriteEvents(root, () => drawTheme(root, theme));
    root.querySelectorAll("[data-rate]").forEach(button => button.addEventListener("click", () => {
      const all = ratingData();
      all[key] = {sum: Number(button.dataset.rate), count: 1}; // one rating per browser; re-rating replaces it
      writeStore(RATINGS_KEY, all);
      notify("Your rating was saved in this browser.");
      drawTheme(root, theme);
    }));
    const downloadLink = $("#download-theme");
    if (downloadLink) downloadLink.addEventListener("click", () => {
      const counts = readStore(DOWNLOADS_KEY, {});
      counts[key] = (counts[key] || 0) + 1;
      writeStore(DOWNLOADS_KEY, counts);
    });
  }

  // ---- init -----------------------------------------------------------------
  async function init() {
    updateNavCount();
    const page = document.body.dataset.page;
    const target = $("#collection-grid, #collection-detail, #theme-detail, #favorites-grid");
    try {
      if (location.protocol === "file:") throw new Error("This site can't be opened by double-clicking the file. Serve it over HTTP (GitHub Pages, or run python3 -m http.server in the project folder).");
      await loadConfig();
      setupGithubLink();
      if (page === "home") await renderHome();
      else if (page === "collection") await renderCollectionPage();
      else if (page === "theme") await renderThemePage();
      else if (page === "favorites") await renderFavorites();
    } catch (error) {
      console.error(error);
      if (target) target.innerHTML = `<div class="empty-state"><strong>Could not load this page</strong>${escapeHtml(error.message)}</div>`;
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
