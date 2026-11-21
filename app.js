(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const FAVORITES_KEY = "ps4tl:favorites";
  const RATINGS_KEY = "ps4tl:ratings";
  const DOWNLOADS_KEY = "ps4tl:downloads";
  let library = [];
  let collections = [];
  let toastTimer;

  function readStore(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
  function favorites() { return readStore(FAVORITES_KEY, []); }
  function ratingData() { return readStore(RATINGS_KEY, {}); }
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
  function pathJoin(base, file) {
    if (!file) return "";
    if (/^(https?:|data:|blob:)/i.test(file)) return file;
    return `${base.replace(/\/$/, "")}/${String(file).replace(/^\//, "")}`;
  }
  function ratingFor(themeKey) {
    const r = ratingData()[themeKey];
    return r && r.count ? { average: r.sum / r.count, count: r.count } : { average: 0, count: 0 };
  }
  function themeKey(theme) { return `${theme.collectionId}/${theme.id}`; }
  function themeUrl(theme) {
    return `theme.html?collection=${encodeURIComponent(theme.collectionId)}&id=${encodeURIComponent(theme.id)}`;
  }
  function allThemeUrl(theme) {
    const prefix = document.body.dataset.page === "home" ? "pages/" : "";
    return `${prefix}${themeUrl(theme)}`;
  }
  function imageUrl(theme) { return pathJoin(theme.basePath, theme.preview); }
  function favoriteButton(theme) {
    const on = favorites().includes(themeKey(theme));
    return `<button class="favorite-button ${on ? "is-favorite" : ""}" data-favorite="${escapeHtml(themeKey(theme))}" aria-label="${on ? "Remove from" : "Add to"} favorites" title="${on ? "Remove favorite" : "Add favorite"}">${on ? "♥" : "♡"}</button>`;
  }
  function themeCard(theme, compact = false) {
    const r = ratingFor(themeKey(theme));
    const rating = r.count ? `★ ${r.average.toFixed(1)}` : "Not rated";
    return `<article class="theme-card">
      <a class="theme-image" href="${allThemeUrl(theme)}"><img src="${escapeHtml(imageUrl(theme))}" alt="${escapeHtml(theme.title)} preview" loading="lazy" onerror="this.src='../assets/images/preview-fallback.svg'"><span class="type-pill">${escapeHtml(theme.type || "theme")}</span></a>
      ${favoriteButton(theme)}
      <div class="card-content"><div class="card-topline"><h3 class="card-title">${escapeHtml(theme.title)}</h3><span class="rating-mini">${rating}</span></div>
      <p class="card-description">${escapeHtml(theme.description || "No description provided.")}</p>
      <div class="card-meta"><span>${escapeHtml(theme.author || "Unknown creator")}</span><a href="${allThemeUrl(theme)}">Details →</a></div></div>
    </article>`;
  }
  function collectionCard(collection) {
    const cover = pathJoin(collection.basePath, collection.cover);
    return `<a class="collection-card" href="pages/collection.html?id=${encodeURIComponent(collection.id)}">
      <img src="${escapeHtml(cover || "assets/images/cover-fallback.svg")}" alt="${escapeHtml(collection.title)} cover" loading="lazy" onerror="this.src='../assets/images/cover-fallback.svg'">
      <div class="collection-card-content"><h3>${escapeHtml(collection.title)}</h3><p>${escapeHtml(collection.description || "")}</p><small>${collection.themes.length} ${collection.themes.length === 1 ? "THEME" : "THEMES"} · BY ${escapeHtml(collection.author || "UNKNOWN")}</small></div>
    </a>`;
  }
  async function loadLibrary() {
    const response = await fetch("data/collections.json");
    if (!response.ok) throw new Error("Could not load data/collections.json");
    const registry = await response.json();
    const slugs = Array.isArray(registry) ? registry : registry.collections;
    if (!Array.isArray(slugs)) throw new Error("data/collections.json must contain a collections array");
    const loaded = await Promise.all(slugs.map(async slug => {
      const basePath = `collections/${encodeURIComponent(slug)}`;
      const res = await fetch(`${basePath}/info.json`);
      if (!res.ok) throw new Error(`Could not load ${basePath}/info.json`);
      const info = await res.json();
      const themeSlugs = Array.isArray(info.themes) ? info.themes : [];
      const themes = await Promise.all(themeSlugs.map(async themeSlug => {
        const themePath = `${basePath}/${encodeURIComponent(themeSlug)}`;
        const themeRes = await fetch(`${themePath}/info.json`);
        if (!themeRes.ok) throw new Error(`Could not load ${themePath}/info.json`);
        const themeInfo = await themeRes.json();
        return {...themeInfo, id: themeInfo.id || themeSlug, collectionId: info.id || slug,
          collectionTitle: info.title || slug, basePath: themePath};
      }));
      return {...info, id: info.id || slug, basePath, themes};
    }));
    collections = loaded;
    library = loaded.flatMap(c => c.themes);
  }
  function updateNavCount() {
    const el = $("#favorite-nav-count");
    if (el) el.textContent = favorites().length;
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
        else if (page === "home") renderHomeCards();
        else button.classList.toggle("is-favorite", next.includes(key));
        notify(next.includes(key) ? "Added to favorites" : "Removed from favorites");
      });
    });
  }
  function renderHomeCards() {
    const search = ($("#search-input")?.value || "").trim().toLowerCase();
    const type = $("#type-filter")?.value || "";
    const collection = $("#collection-filter")?.value || "";
    const sort = $("#sort-select")?.value || "newest";
    let filtered = library.filter(t => {
      const haystack = [t.title,t.author,t.description,t.collectionTitle,...(t.tags || [])].join(" ").toLowerCase();
      return (!search || haystack.includes(search)) && (!type || (t.type || "").toLowerCase() === type) && (!collection || t.collectionId === collection);
    });
    filtered.sort((a,b) => {
      if (sort === "az") return a.title.localeCompare(b.title);
      if (sort === "oldest") return (a.created || "").localeCompare(b.created || "");
      if (sort === "rating") return ratingFor(themeKey(b)).average - ratingFor(themeKey(a)).average;
      return (b.created || "").localeCompare(a.created || "");
    });
    const grid = $("#theme-grid");
    if (grid) grid.innerHTML = filtered.length ? filtered.map(t => themeCard(t)).join("") : `<div class="empty-state"><strong>No themes found</strong>Try another search or clear your filters.</div>`;
    const count = $("#result-count");
    if (count) count.textContent = `Showing ${filtered.length} of ${library.length} themes`;
    attachFavoriteEvents(grid || document);
    const recent = [...library].sort((a,b) => (b.created || "").localeCompare(a.created || "")).slice(0,3);
    const recentGrid = $("#recent-grid");
    if (recentGrid) recentGrid.innerHTML = recent.map(t => themeCard(t,true)).join("") || `<div class="empty-state">No themes have been added yet.</div>`;
    attachFavoriteEvents(recentGrid || document);
  }
  function renderHome() {
    $("#stat-themes").textContent = library.length;
    $("#stat-collections").textContent = collections.length;
    $("#stat-authors").textContent = new Set(library.map(t => t.author).filter(Boolean)).size;
    const select = $("#collection-filter");
    if (select) select.innerHTML = `<option value="">All collections</option>` + collections.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title)}</option>`).join("");
    const colGrid = $("#collection-grid");
    if (colGrid) colGrid.innerHTML = collections.slice(0,4).map(collectionCard).join("") || `<div class="empty-state">No collections yet.</div>`;
    ["search-input","type-filter","collection-filter","sort-select"].forEach(id => $("#"+id)?.addEventListener(id === "search-input" ? "input" : "change", renderHomeCards));
    $("#random-theme")?.addEventListener("click", () => {
      if (!library.length) return notify("There are no themes to pick from yet.");
      const chosen = library[Math.floor(Math.random() * library.length)];
      location.href = allThemeUrl(chosen);
    });
    renderHomeCards();
  }
  function renderCollectionsPage() {
    const root = $("#all-collections");
    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    if (id) {
      const collection = collections.find(c => c.id === id);
      if (!collection) { root.innerHTML = `<div class="empty-state"><strong>Collection not found</strong>It may have been moved or removed.</div>`; return; }
      root.className = "";
      root.innerHTML = `<a class="detail-back" href="collection.html">← All collections</a>
        <section class="collection-detail-head"><img src="${escapeHtml(pathJoin(collection.basePath,collection.cover))}" alt="${escapeHtml(collection.title)} cover"><div><p class="eyebrow">COLLECTION</p><h1>${escapeHtml(collection.title)}</h1><p>${escapeHtml(collection.description || "")}</p><small>${collection.themes.length} themes · by ${escapeHtml(collection.author || "Unknown")}</small><div class="detail-actions">${collection.archive ? `<a class="button button-primary" href="${escapeHtml(pathJoin(collection.basePath,collection.archive))}" download>↓ Download collection ZIP</a>` : ""}</div></div></section>
        <div class="section-heading"><div><p class="eyebrow">INSIDE THIS COLLECTION</p><h2>Themes</h2></div></div>
        <div class="theme-grid">${collection.themes.length ? collection.themes.map(t => themeCard(t)).join("") : `<div class="empty-state">This collection is empty.</div>`}</div>`;
      attachFavoriteEvents(root);
      return;
    }
    root.innerHTML = collections.length ? collections.map(collectionCard).join("") : `<div class="empty-state">No collections have been published yet.</div>`;
  }
  function renderFavorites() {
    const root = $("#favorites-grid");
    if (!root) return;
    const keys = favorites();
    const saved = library.filter(t => keys.includes(themeKey(t)));
    root.innerHTML = saved.length ? saved.map(t => themeCard(t)).join("") : `<div class="empty-state"><strong>No favorites yet</strong>Tap the heart on any theme to save it here. Favorites are stored only in this browser.</div>`;
    attachFavoriteEvents(root);
  }
  function renderThemePage() {
    const params = new URLSearchParams(location.search);
    const collectionId = params.get("collection"), id = params.get("id");
    const theme = library.find(t => t.collectionId === collectionId && t.id === id);
    const root = $("#theme-detail");
    if (!theme) { root.innerHTML = `<div class="empty-state"><strong>Theme not found</strong>Check the link or return to the library.</div><a class="text-link" href="../">← Back to library</a>`; return; }
    const key = themeKey(theme), r = ratingFor(key);
    const download = theme.download ? pathJoin(theme.basePath, theme.download) : "";
    root.innerHTML = `<a class="detail-back" href="collection.html?id=${encodeURIComponent(theme.collectionId)}">← ${escapeHtml(theme.collectionTitle)}</a>
      <div class="detail-layout"><div><img class="detail-preview" src="${escapeHtml(imageUrl(theme))}" alt="${escapeHtml(theme.title)} preview" onerror="this.src='../assets/images/preview-fallback.svg'">
      <div class="rating-box"><strong>Rate this theme</strong><div class="stars" role="group" aria-label="Rate this theme">${[1,2,3,4,5].map(n=>`<button class="star-button ${r.count && n <= Math.round(r.average) ? "selected" : ""}" data-rate="${n}" aria-label="Rate ${n} out of 5">★</button>`).join("")}</div><p class="muted-small">${r.count ? `${r.average.toFixed(1)} / 5 from ${r.count} rating${r.count===1?"":"s"} on this browser` : "No local ratings yet. Your rating is saved in this browser."}</p></div></div>
      <div class="detail-info"><p class="eyebrow">${escapeHtml((theme.type || "THEME").toUpperCase())} THEME</p><h1>${escapeHtml(theme.title)}</h1><p>${escapeHtml(theme.description || "No description provided.")}</p>
      <div class="detail-actions">${download ? `<a class="button button-primary" id="download-theme" href="${escapeHtml(download)}" download>↓ Download .pkg</a>` : `<button class="button button-primary" disabled title="Add a download filename to this theme's info.json">Download unavailable</button>`}<button class="button button-quiet" data-favorite="${escapeHtml(key)}">${favorites().includes(key) ? "♥ Saved" : "♡ Favorite"}</button></div>
      <div class="metadata-list"><div class="metadata-row"><span>Creator</span><b>${escapeHtml(theme.author || "Unknown")}</b></div><div class="metadata-row"><span>Collection</span><b>${escapeHtml(theme.collectionTitle)}</b></div><div class="metadata-row"><span>Type</span><b>${escapeHtml(theme.type || "Not specified")}</b></div><div class="metadata-row"><span>Version</span><b>${escapeHtml(theme.version || "—")}</b></div><div class="metadata-row"><span>Added</span><b>${escapeHtml(theme.created || "—")}</b></div></div>
      ${(theme.tags || []).length ? `<div class="tag-list">${theme.tags.map(tag=>`<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      ${theme.notes ? `<p class="detail-notes">${escapeHtml(theme.notes)}</p>` : ""}</div></div>`;
    attachFavoriteEvents(root);
    root.querySelectorAll("[data-rate]").forEach(button => button.addEventListener("click", () => {
      const all = ratingData(); const previous = all[key];
      // Local ratings are stored as one rating per browser; changing a rating replaces the previous one.
      all[key] = {sum: Number(button.dataset.rate), count: 1};
      writeStore(RATINGS_KEY, all); notify("Your rating was saved in this browser."); renderThemePage();
    }));
    const downloadLink = $("#download-theme");
    if (downloadLink) downloadLink.addEventListener("click", () => {
      const counts = readStore(DOWNLOADS_KEY, {});
      counts[key] = (counts[key] || 0) + 1;
      writeStore(DOWNLOADS_KEY, counts);
    });
  }
  async function init() {
    updateNavCount();
    try {
      await loadLibrary();
      const page = document.body.dataset.page;
      if (page === "home") renderHome();
      if (page === "collections") renderCollectionsPage();
      if (page === "theme") renderThemePage();
      if (page === "favorites") renderFavorites();
    } catch (error) {
      console.error(error);
      const target = $("#theme-grid,#all-collections,#theme-detail,#favorites-grid");
      if (target) target.innerHTML = `<div class="empty-state"><strong>Could not load the library</strong>${escapeHtml(error.message)}<br>Check that the JSON files are valid and the site is served over HTTP (for example, GitHub Pages).</div>`;
    }
  }
  document.addEventListener("DOMContentLoaded", init);
})();