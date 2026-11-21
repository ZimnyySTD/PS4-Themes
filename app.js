(() => {
  "use strict";

  // ---------------------------------------------------------------------------
  // Site root. Every page (index.html and pages/*.html) loads this file from the
  // site root, so we resolve all data / image / download paths against the
  // script's own URL. That makes the site work from any folder depth, from a
  // GitHub Pages project URL (user.github.io/repo/) and from a custom domain.
  // ---------------------------------------------------------------------------
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || new URL("app.js", location.href).href;
  const ROOT = new URL("./", SCRIPT_SRC);
  const u = (path = "") => new URL(path, ROOT).href;

  const $ = (selector, root = document) => root.querySelector(selector);
  const FAVORITES_KEY = "ps4tl:favorites";
  const RATINGS_KEY = "ps4tl:ratings";
  const DOWNLOADS_KEY = "ps4tl:downloads";
  const PREVIEW_FALLBACK = u("assets/images/preview-fallback.svg");
  const COVER_FALLBACK = u("assets/images/cover-fallback.svg");

  let collections = [];
  let library = [];
  let config = {};
  let problems = [];
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
  // Join a folder path (relative to site root) and a file name into a full URL.
  function assetUrl(base, file) {
    if (!file) return "";
    if (/^(https?:|data:|blob:)/i.test(file)) return file;
    return u(`${base.replace(/\/$/, "")}/${String(file).replace(/^\//, "")}`);
  }
  function fetchJson(path) {
    return fetch(u(path), {cache: "no-cache"}).then(res => {
      if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status})`);
      return res.json();
    });
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

  // ---- cards ----------------------------------------------------------------
  function favoriteButton(theme) {
    const on = favorites().includes(themeKey(theme));
    return `<button class="favorite-button ${on ? "is-favorite" : ""}" data-favorite="${escapeHtml(themeKey(theme))}" aria-label="${on ? "Remove from" : "Add to"} favorites" title="${on ? "Remove favorite" : "Add favorite"}">${on ? "♥" : "♡"}</button>`;
  }
  function themeCard(theme) {
    const r = ratingFor(themeKey(theme));
    const rating = r.count ? `★ ${r.average.toFixed(1)}` : "";
    return `<article class="theme-card">
      <a class="theme-image" href="${themeHref(theme)}"><img src="${escapeHtml(previewUrl(theme))}" alt="${escapeHtml(theme.title)} preview" loading="lazy" onerror="this.onerror=null;this.src='${PREVIEW_FALLBACK}'">${theme.type ? `<span class="type-pill">${escapeHtml(theme.type)}</span>` : ""}</a>
      ${favoriteButton(theme)}
      <div class="card-content"><div class="card-topline"><h3 class="card-title">${escapeHtml(theme.title)}</h3><span class="rating-mini">${rating}</span></div>
      <p class="card-description">${escapeHtml(theme.description || "")}</p>
      <div class="card-meta"><span>${escapeHtml(theme.author || "Unknown creator")}</span><a href="${themeHref(theme)}">Details →</a></div></div>
    </article>`;
  }
  function collectionCard(collection) {
    const n = collection.themes.length;
    return `<a class="collection-card" href="${collectionHref(collection)}">
      <img src="${escapeHtml(coverUrl(collection))}" alt="${escapeHtml(collection.title)} cover" loading="lazy" onerror="this.onerror=null;this.src='${COVER_FALLBACK}'">
      <div class="collection-card-content"><h3>${escapeHtml(collection.title)}</h3><p>${escapeHtml(collection.description || "")}</p><small>${n} ${n === 1 ? "THEME" : "THEMES"}${collection.author ? ` · BY ${escapeHtml(collection.author)}` : ""}</small></div>
    </a>`;
  }

  // ---- data loading ---------------------------------------------------------
  async function loadLibrary() {
    if (location.protocol === "file:") throw new Error("This site cannot be opened by double-clicking the file. Serve it over HTTP (GitHub Pages, or run python3 -m http.server in the project folder).");
    problems = [];
    config = await fetchJson("config.json").catch(() => ({}));
    const registry = await fetchJson("data/collections.json");
    const slugs = Array.isArray(registry) ? registry : registry.collections;
    if (!Array.isArray(slugs)) throw new Error("data/collections.json must contain a \"collections\" array");

    const loaded = await Promise.all(slugs.map(async slug => {
      const basePath = `collections/${encodeURIComponent(slug)}`;
      let info;
      try { info = await fetchJson(`${basePath}/info.json`); }
      catch (error) { console.warn(error); problems.push(`Collection "${slug}" could not be loaded: its info.json is missing or invalid (looked in ${basePath}/info.json).`); return null; }
      const collectionId = info.id || slug;
      const themeSlugs = Array.isArray(info.themes) ? info.themes : [];
      const themes = (await Promise.all(themeSlugs.map(async themeSlug => {
        const themePath = `${basePath}/${encodeURIComponent(themeSlug)}`;
        try {
          const themeInfo = await fetchJson(`${themePath}/info.json`);
          return {...themeInfo, id: themeInfo.id || themeSlug, collectionId,
            collectionTitle: info.title || slug, basePath: themePath};
        } catch (error) { console.warn(error); problems.push(`Theme "${themeSlug}" in collection "${slug}" could not be loaded: its info.json is missing or invalid.`); return null; }
      }))).filter(Boolean);
      return {...info, id: collectionId, basePath, themes};
    }));
    collections = loaded.filter(Boolean);
    library = collections.flatMap(c => c.themes);
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
      url = repo ? `https://github.com/${owner}/${repo}` : `https://github.com/${owner}`;
    }
    if (url) link.href = url; else link.remove();
  }
  function attachFavoriteEvents(root = document) {
    root.querySelectorAll("[data-favorite]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault(); event.stopPropagation();
        const key = button.dataset.favorite;
        const current = favorites();
        const next = current.includes(key) ? current.filter(x => x !== key) : [...current, key];
        writeStore(FAVORITES_KEY, next);
        updateNavCount();
        const page = document.body.dataset.page;
        if (page === "favorites") renderFavorites();
        else if (page === "theme") renderThemePage();
        else {
          const on = next.includes(key);
          button.classList.toggle("is-favorite", on);
          button.textContent = on ? "♥" : "♡";
        }
        notify(next.includes(key) ? "Added to favorites" : "Removed from favorites");
      });
    });
  }
  function filterCollections(query) {
    const q = query.trim().toLowerCase();
    if (!q) return collections;
    return collections.filter(c => [c.title, c.author, c.description].join(" ").toLowerCase().includes(q));
  }

  function problemBanner() {
    if (!problems.length) return "";
    return `<div class="problem-banner"><strong>Some content could not be loaded</strong><ul>${problems.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul></div>`;
  }

  // ---- pages ----------------------------------------------------------------
  function renderHome() {
    const grid = $("#collection-grid");
    const input = $("#search-input");
    const banner = $("#problems");
    if (banner) banner.innerHTML = problemBanner();
    const draw = () => {
      const list = filterCollections(input ? input.value : "");
      grid.innerHTML = list.length
        ? list.map(collectionCard).join("")
        : `<div class="empty-state"><strong>${collections.length ? "No collections found" : "No collections yet"}</strong>${collections.length ? "Try a different search." : "Add one to data/collections.json to get started."}</div>`;
    };
    if (input) input.addEventListener("input", draw);
    draw();
  }

  async function renderCollectionPage() {
    const root = $("#collection-detail");
    const id = new URLSearchParams(location.search).get("id");
    if (!id) { location.replace(u("")); return; }
    const collection = collections.find(c => c.id === id);
    if (!collection) {
      root.innerHTML = `<div class="empty-state"><strong>Collection not found</strong>It may have been moved or removed.</div><p><a class="text-link" href="${u("")}">← Back to collections</a></p>`;
      return;
    }
    document.title = `${collection.title} · ${config.siteName || "PS4 Theme Library"}`;
    const n = collection.themes.length;
    const archiveHref = assetUrl(collection.basePath, collection.archive || "collection.zip");
    root.innerHTML = `<a class="detail-back" href="${u("")}">← All collections</a>
      <section class="collection-detail-head"><img src="${escapeHtml(coverUrl(collection))}" alt="${escapeHtml(collection.title)} cover" onerror="this.onerror=null;this.src='${COVER_FALLBACK}'">
        <div><h1>${escapeHtml(collection.title)}</h1><p>${escapeHtml(collection.description || "")}</p>
        <small>${n} ${n === 1 ? "theme" : "themes"}${collection.author ? ` · by ${escapeHtml(collection.author)}` : ""}</small>
        <div class="detail-actions" id="collection-actions"></div></div></section>
      ${problemBanner()}
      <div class="section-heading"><h2>Themes</h2></div>
      <div class="theme-grid">${n ? collection.themes.map(themeCard).join("") : `<div class="empty-state">This collection is empty.</div>`}</div>`;
    attachFavoriteEvents(root);

    // Only offer the ZIP if it actually exists (it is generated by the GitHub workflow).
    if (archiveHref) {
      try {
        const head = await fetch(archiveHref, {method: "HEAD", cache: "no-cache"});
        if (head.ok) $("#collection-actions").innerHTML = `<a class="button button-primary" href="${escapeHtml(archiveHref)}" download>↓ Download collection ZIP</a>`;
      } catch {}
    }
  }

  function renderFavorites() {
    const root = $("#favorites-grid");
    if (!root) return;
    const keys = favorites();
    const saved = library.filter(t => keys.includes(themeKey(t)));
    root.innerHTML = saved.length
      ? saved.map(themeCard).join("")
      : `<div class="empty-state"><strong>No favorites yet</strong>Open a collection and tap the heart on a theme to save it here. Favorites are stored only in this browser.</div>`;
    attachFavoriteEvents(root);
  }

  function renderThemePage() {
    const params = new URLSearchParams(location.search);
    const collectionId = params.get("collection"), id = params.get("id");
    const theme = library.find(t => t.collectionId === collectionId && t.id === id);
    const root = $("#theme-detail");
    if (!theme) {
      root.innerHTML = `<div class="empty-state"><strong>Theme not found</strong>Check the link or go back to the collections.</div><p><a class="text-link" href="${u("")}">← Back to collections</a></p>`;
      return;
    }
    document.title = `${theme.title} · ${config.siteName || "PS4 Theme Library"}`;
    const key = themeKey(theme), r = ratingFor(key);
    const download = theme.download ? assetUrl(theme.basePath, theme.download) : "";
    root.innerHTML = `<a class="detail-back" href="${collectionHref({id: theme.collectionId})}">← ${escapeHtml(theme.collectionTitle)}</a>
      <div class="detail-layout"><div><img class="detail-preview" src="${escapeHtml(previewUrl(theme))}" alt="${escapeHtml(theme.title)} preview" onerror="this.onerror=null;this.src='${PREVIEW_FALLBACK}'">
      <div class="rating-box"><strong>Rate this theme</strong><div class="stars" role="group" aria-label="Rate this theme">${[1,2,3,4,5].map(n => `<button class="star-button ${r.count && n <= Math.round(r.average) ? "selected" : ""}" data-rate="${n}" aria-label="Rate ${n} out of 5">★</button>`).join("")}</div><p class="muted-small">${r.count ? `Your rating: ${r.average.toFixed(0)} / 5 (saved in this browser)` : "Your rating is saved in this browser."}</p></div></div>
      <div class="detail-info">${theme.type ? `<p class="eyebrow">${escapeHtml(theme.type.toUpperCase())} THEME</p>` : ""}<h1>${escapeHtml(theme.title)}</h1><p>${escapeHtml(theme.description || "")}</p>
      <div class="detail-actions">${download ? `<a class="button button-primary" id="download-theme" href="${escapeHtml(download)}" download>↓ Download .pkg</a>` : `<button class="button button-primary" disabled title="No download file has been added to this theme yet">Download unavailable</button>`}<button class="button button-quiet" data-favorite="${escapeHtml(key)}">${favorites().includes(key) ? "♥ Saved" : "♡ Favorite"}</button></div>
      <div class="metadata-list"><div class="metadata-row"><span>Creator</span><b>${escapeHtml(theme.author || "Unknown")}</b></div><div class="metadata-row"><span>Collection</span><b>${escapeHtml(theme.collectionTitle)}</b></div><div class="metadata-row"><span>Type</span><b>${escapeHtml(theme.type || "Not specified")}</b></div><div class="metadata-row"><span>Version</span><b>${escapeHtml(theme.version || "—")}</b></div><div class="metadata-row"><span>Added</span><b>${escapeHtml(theme.created || "—")}</b></div></div>
      ${(theme.tags || []).length ? `<div class="tag-list">${theme.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      ${theme.notes ? `<p class="detail-notes">${escapeHtml(theme.notes)}</p>` : ""}</div></div>`;
    attachFavoriteEvents(root);
    root.querySelectorAll("[data-rate]").forEach(button => button.addEventListener("click", () => {
      const all = ratingData();
      all[key] = {sum: Number(button.dataset.rate), count: 1}; // one rating per browser; re-rating replaces it
      writeStore(RATINGS_KEY, all);
      notify("Your rating was saved in this browser.");
      renderThemePage();
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
      await loadLibrary();
      setupGithubLink();
      if (page === "home") renderHome();
      else if (page === "collection") await renderCollectionPage();
      else if (page === "theme") renderThemePage();
      else if (page === "favorites") renderFavorites();
    } catch (error) {
      console.error(error);
      if (target) target.innerHTML = `<div class="empty-state"><strong>Could not load the library</strong>${escapeHtml(error.message)}<br>Check that the JSON files are valid and that the site is served over HTTP (for example GitHub Pages or <code>python3 -m http.server</code>).</div>`;
    }
  }
  document.addEventListener("DOMContentLoaded", init);
})();
