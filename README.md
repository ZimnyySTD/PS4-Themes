# PS4 Theme Library

A static, GitHub Pages-ready theme library. Browse collections, search and filter themes, open individual theme pages, save local favorites, rate themes locally, and download individual `.pkg` files or collection ZIP archives.

## How the site works

- The home page shows **collections only**. Open a collection to see its themes, then click a theme for its page and `.pkg` download.
- Each collection page can offer a collection ZIP (generated automatically by the workflow).
- Favorites and ratings are stored in the visitor's browser (`localStorage`). The Favorites page is the only other place themes are listed.
- Content is data-driven: add collections/themes by editing JSON and uploading files. No frontend edits needed.
- All paths are resolved from the site root, so it works on a GitHub Pages project URL, a custom domain, or a local server.

> **Important about ratings and counters:** GitHub Pages is static hosting. Favorites and ratings are local to each browser, not shared globally. The download count in this starter is also a local click count, not a public global counter. Shared ratings and reliable global download analytics require a backend or analytics service. The starter intentionally does not pretend that local data is global.

## 1. Create the GitHub repository

1. Create a new GitHub repository, for example `ps4-theme-library`.
2. Upload the contents of this folder to the repository root (not the ZIP file itself).
3. Commit to the `main` branch.
4. In GitHub, open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select branch `main` and folder `/ (root)`, then save.
7. Wait for GitHub Pages to publish the site.

The website uses relative paths and works from a GitHub Pages project URL such as `https://YOUR-NAME.github.io/ps4-theme-library/`.

The GitHub button in the header is detected automatically on `*.github.io` sites. For a custom domain, set `repositoryUrl` in `config.json`.

## 2. Add a collection

1. Create a folder in `collections/` (lowercase, hyphens, no spaces), e.g. `collections/vaporwave-pack/`.
2. Put a cover image in it (e.g. `cover.png`) and an `info.json`:

```json
{
  "title": "Vaporwave Pack",
  "description": "Neon colors and retro-futuristic PS4 themes.",
  "author": "Zimnyy",
  "cover": "cover.png",
  "created": "2026-11-21"
}
```

That is all. You do **not** need to edit `data/collections.json` or list themes by hand: the GitHub workflow (**Sync library and generate collection ZIPs**) scans the folders after every push, updates `data/collections.json`, fills in each collection's `themes` list, and builds `collection.zip`. You can also run it yourself with `python3 scripts/sync-library.py`.

## 3. Add a theme

Create a folder inside the collection, e.g. `collections/vaporwave-pack/neon-city/`, containing:

```text
neon-city/
├── info.json
├── preview.png
└── neon-city.pkg
```

```json
{
  "title": "Neon City",
  "author": "Creator Name",
  "description": "A neon-lit city theme for your PS4.",
  "type": "dynamic",
  "tags": ["neon", "city"],
  "preview": "preview.png",
  "download": "neon-city.pkg",
  "created": "2026-11-21",
  "version": "1.0.0"
}
```

`preview` and `download` must match the real filenames exactly (including capitalization). `type` is `dynamic` or `static`.

## 4. Automatic sync and ZIPs

Enable **Settings → Actions → General → Workflow permissions → Read and write permissions** so the workflow can commit the updated index and ZIPs. After you push, wait for the green check under the **Actions** tab (about a minute), then refresh the site. The **Validate** workflow fails with a clear message if a JSON file is broken or a referenced file is missing.

If the site cannot load something, a red notice on the page tells you exactly which file is the problem.

## 5. Local preview

Because the website fetches JSON files, open it through a local HTTP server rather than double-clicking `index.html`.

```bash
python3 -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

## 6. GitHub Pages URLs

- Homepage (all collections): `/`
- One collection: `/pages/collection.html?id=COLLECTION_SLUG`
- One theme: `/pages/theme.html?collection=COLLECTION_SLUG&id=THEME_SLUG`
- Favorites: `/pages/favorites.html`

## 7. Ratings, favorites and download counts

The current implementation stores favorites and ratings in the browser's `localStorage`. They are private to that browser and are not synchronized between devices or visitors.

The download click counter is also local-only and is not displayed as a global statistic. For shared ratings, shared favorites, abuse protection or global download analytics, connect a backend such as Supabase or a small API/Cloudflare Worker later. Do not put private API keys or service-role secrets in frontend JavaScript.

## 8. Content tips

- Use optimized JPG, PNG or WebP previews. A 16:9 image works well.
- Keep preview and cover filenames simple.
- Keep each `.pkg` inside its theme folder for this repository-storage setup.
- Keep theme and collection slugs lowercase with hyphens.
- Do not list a theme in `info.json` unless its folder and metadata file exist.
- Only upload themes you have permission to distribute, and credit the original creator.

## License

The website source code is provided under the MIT License (see `LICENSE`). Theme packages, artwork and previews may have separate rights and are not automatically covered by the website code license.
