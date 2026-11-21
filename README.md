# PS4 Theme Library

A static, GitHub Pages-ready theme library. Browse collections, search and filter themes, open individual theme pages, save local favorites, rate themes locally, and download individual `.pkg` files or collection ZIP archives.

## Features

- Data-driven collections and themes (add content by editing JSON and uploading files; no frontend edits required).
- Collection pages and individual theme detail pages.
- Search by title, creator, description, collection and tags.
- Filters for theme type and collection; sorting by newest, oldest, name or locally rated score.
- Favorites stored in the visitor's browser using `localStorage`.
- Theme ratings stored locally in each visitor's browser.
- Recently added themes based on the `created` date in theme metadata.
- Random theme button.
- Individual `.pkg` downloads and generated ZIP archives for whole collections.
- Responsive dark UI, suitable for desktop and mobile.

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

## 2. Add a collection

Every collection has its own folder inside `collections/`. The folder name is its slug: lowercase, no spaces, use hyphens.

Example:

```text
collections/
└── vaporwave-pack/
    ├── info.json
    ├── cover.png
    ├── collection.zip       # generated automatically by workflow
    └── neon-city/
        ├── info.json
        ├── preview.png
        └── neon-city.pkg
```

### A. Register the collection

Add the folder slug to `data/collections.json`:

```json
{
  "collections": [
    "starter-pack",
    "vaporwave-pack"
  ]
}
```

### B. Create collection metadata

Create `collections/vaporwave-pack/info.json`:

```json
{
  "id": "vaporwave-pack",
  "title": "Vaporwave Pack",
  "description": "Neon colors and retro-futuristic PS4 themes.",
  "author": "Zimnyy",
  "cover": "cover.png",
  "created": "2026-11-21",
  "updated": "2026-11-21",
  "themes": [
    "neon-city"
  ],
  "archive": "collection.zip"
}
```

- `id`: should match the collection folder slug.
- `title`: display name.
- `description`: short collection description.
- `author`: collection curator or creator.
- `cover`: image filename inside the collection folder.
- `created` / `updated`: ISO dates (`YYYY-MM-DD`).
- `themes`: theme folder slugs, in the order you want them listed.
- `archive`: generated ZIP filename. Keep it as `collection.zip` unless you have a reason to change it.

## 3. Add a theme

Create a folder inside the collection, for example `collections/vaporwave-pack/neon-city/`, and put these files inside:

```text
neon-city/
├── info.json
├── preview.png
└── neon-city.pkg
```

Create `info.json`:

```json
{
  "id": "neon-city",
  "title": "Neon City",
  "author": "Creator Name",
  "description": "A neon-lit city theme for your PS4.",
  "type": "dynamic",
  "tags": ["neon", "city", "vaporwave"],
  "preview": "preview.png",
  "download": "neon-city.pkg",
  "created": "2026-11-21",
  "version": "1.0.0",
  "notes": "Optional extra information about the theme."
}
```

Then add `"neon-city"` to the `themes` array in the collection's `info.json`.

### Theme metadata fields

| Field | Required? | Meaning |
|---|---|---|
| `id` | Recommended | Theme slug; should match folder name |
| `title` | Yes | Theme display name |
| `author` | No | Theme creator |
| `description` | No | Short description |
| `type` | No | `dynamic` or `static` |
| `tags` | No | Searchable tags |
| `preview` | Yes for a preview | Image filename relative to theme folder |
| `download` | Yes for a download button | `.pkg` filename relative to theme folder |
| `created` | Recommended | ISO date used for recently added and sorting |
| `version` | No | Theme version |
| `notes` | No | Additional details |

Use the real `.pkg` filename in `download`. If you omit `download`, the site displays a disabled download state rather than a broken link.

## 4. Generate collection ZIP files

The website links to a pre-generated ZIP for each collection. The ZIP contains that collection's `info.json` and all files inside the theme folders listed in its `themes` array.

### Automatic generation on GitHub

The included workflow `.github/workflows/generate-archives.yml` generates or updates `collection.zip` whenever collection content or the registry changes on `main`.

For the workflow to commit generated ZIPs, open **Settings → Actions → General → Workflow permissions** and enable **Read and write permissions**.

You can also run the workflow manually from **Actions → Generate collection ZIP archives → Run workflow**.

### Generate locally

Requires Python 3:

```bash
python3 scripts/generate-archives.py
```

The script writes `collections/<collection-slug>/collection.zip`.

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

- Homepage: `/`
- All collections: `/pages/collection.html`
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
