# EDS URL Ingest CLI

Scrape an external website URL and generate AEM Edge Delivery Services (EDS) `.plain.html` content with optimized assets. Upload to local drafts or SharePoint Online (synced to da.live).

## Dependencies

| Package | Purpose |
|---------|---------|
| `puppeteer` | Headless browser — render page, extract DOM |
| `linkedom` | Node DOM for import rules |
| `sharp` | Image optimize + EXIF strip |
| `commander` | CLI argument parsing |
| `dotenv` | Environment variable loading |
| `@azure/identity` | Azure AD app authentication (SharePoint) |
| `@microsoft/microsoft-graph-client` | Microsoft Graph file upload |

## Usage

`--target` is **required** — choose where ingested content is written:

### Install in other environments

See **[INSTALL.md](./INSTALL.md)** — npm package `@ntt/eds-url-ingest`, Docker, private registry, and CI/CD.

### Author-friendly UI (Tools > General)

For non-technical authors, use the browser tool instead of the terminal:

```bash
npm run ingest:ui
```

Open **http://localhost:3002/** — form covers all 8 pipeline phases (source URL, target, franchise, crawl, validation, export). See `tools/general/eds-ingest/README.md`.

### CLI (developers)

| Target | Authoring | Output |
|--------|-----------|--------|
| `local` | Dev preview only | `drafts/ingest/` |
| `da` | Document Authoring (da.live) | SharePoint → Author Bus |
| `aem` | Universal Editor (AEM Cloud) | `aem-content/{project}/` staging |
| `both` | DA + UE | SharePoint **and** AEM staging (same URL paths) |

Aliases: `sharepoint` → `da`, `ue` → `aem`

### Local preview (dev)

```bash
npm run ingest -- --url=https://example.com --target=local
npm run dev:drafts
```

**Local preview URLs** (AEM CLI serves `drafts/` at `/drafts/`):

| File | URL |
|------|-----|
| `drafts/ingest/pages/{slug}/index.plain.html` | http://localhost:3000/drafts/ingest/pages/{slug}/index |

### Document Authoring (DA)

1. Copy `tools/ingest/config/.env.example` values into project root `.env`
2. Register an Azure AD app with **Microsoft Graph** application permissions:
   - `Sites.ReadWrite.All`
   - `Files.ReadWrite.All`
3. Grant admin consent
4. Collect **Site ID** and **Drive ID** for the SharePoint document library connected to da.live

```bash
npm run ingest -- --url=https://www.example.com --target=da --config=tools/ingest/config/ingest.config.example.json
```

After upload, allow a few minutes for SharePoint → da.live sync, then preview:

```
https://main--ntt-eds-ue--{owner}.aem.page/{projectName}/pages/{slug}/index
```

Use `fstab.yaml` (Author Bus). Sidekick → **Document Authoring**.

Adjust `sharepoint.publicPrefix` and `sharepoint.rootFolder` in config to match your SharePoint → da.live path mapping.

### Universal Editor (UE)

Stages content under `aem-content/{project}/` with paths matching AEM delivery (`aem.publicPrefix`).

```bash
npm run ingest -- --url=https://www.example.com --target=aem --config=tools/ingest/config/ingest.config.example.json
```

Push to AEM Cloud (requires `AEM_IMPORT_TOKEN` and `AEM_TARGET` in `.env`):

```bash
npx aem-import-helper aem upload --zip=path/to/package.zip --token=$AEM_IMPORT_TOKEN --target=$AEM_TARGET
```

Use `fstab.aem.yaml` as `fstab.yaml` for UE authoring. Sidekick → **Universal Editor**.

### Both DA and UE

Requires SharePoint credentials **and** matching `publicPrefix` in config (`sharepoint.publicPrefix` === `aem.publicPrefix`):

```bash
npm run ingest -- --url=https://www.example.com --target=both --config=tools/ingest/config/ingest.config.example.json
```

## Environment variables

| Variable | Required for | Description |
|----------|--------------|-------------|
| `AZURE_TENANT_ID` | `da`, `both` | Azure AD tenant ID |
| `AZURE_CLIENT_ID` | `da`, `both` | App registration client ID |
| `AZURE_CLIENT_SECRET` | `da`, `both` | App client secret |
| `SP_SITE_ID` | `da`, `both` | SharePoint site ID (Graph API) |
| `SP_DRIVE_ID` | `da`, `both` | Document library drive ID synced to da.live |
| `AEM_IMPORT_TOKEN` | UE push (optional) | AEM login token for `aem-import-helper aem upload` |
| `AEM_TARGET` | UE push (optional) | AEM target environment name |
| `PUPPETEER_EXECUTABLE_PATH` | No | Path to Chrome if Puppeteer bundled browser unavailable |

### Finding Site ID and Drive ID

```bash
# Site ID (replace hostname and path)
GET https://graph.microsoft.com/v1.0/sites/{hostname}:/{site-path}

# Drive ID for default document library
GET https://graph.microsoft.com/v1.0/sites/{site-id}/drives
```

## SharePoint folder layout

```
{rootFolder}/
├── pages/
│   └── {page-slug}/
│       ├── index.plain.html
│       └── media/
├── nav.plain.html          (Phase 3)
├── footer.plain.html       (Phase 3)
└── themes/
    └── theme-{slug}.css    (Phase 3)
```

## Pipeline sequence

1. DOM ingestion (Puppeteer + auto-scroll)
2. Block segmentation (Linkedom + import-rules)
3. **Asset upload first** → AssetManifest (SharePoint or local)
4. Rewrite asset URLs in DOM (in-memory)
5. Theme + nav + footer generation (color sampling, WCAG contrast, nav/footer fragments)
6. SEO generation
7. Plain HTML compile (single pass, paths baked in)
8. Upload HTML document (assets already uploaded)

## Puppeteer / Chrome

```bash
PUPPETEER_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

## Phase 3 — Theme + navigation

The ingest pipeline samples colors from the rendered page (body, header, nav, h1, CTA), validates WCAG AA contrast, and generates:

| Artifact | Local path | SharePoint path |
|----------|------------|-----------------|
| Theme CSS | `drafts/ingest/themes/theme-{hostname}.css` (+ mirrored to `styles/themes/` for local preview) | `{rootFolder}/themes/theme-{hostname}.css` |
| Nav fragment | `drafts/ingest/nav.plain.html` | `{rootFolder}/nav.plain.html` |
| Footer fragment | `drafts/ingest/footer.plain.html` | `{rootFolder}/footer.plain.html` |

Page metadata includes `theme`, `nav`, `footer`, and `mega-menu-style` rows. The page shell uses empty `<header></header>` / `<footer></footer>` elements; `blocks/header/header.js` and `blocks/footer/footer.js` load the fragments at runtime from the metadata paths.

Local preview loads theme CSS via `scripts/scripts.js` when `meta name="theme"` is set.

```bash
npm run ingest -- --url=https://www.wyndhamgrandclearwater.com/ --target=local
npm run dev:drafts
# http://localhost:3000/drafts/ingest/pages/{slug}/index
```

### Wyndham block mapping

When the source hostname contains `wyndham`, scraped sections map to existing `blocks/whydhams/*` contracts:

| Source selector | EDS block |
|-----------------|-----------|
| `.hero-container` | `wh-hero-container` |
| `.Quad` | `wh-quad` (offer) |
| `.intro-container` | `wh-intro-container` |
| `.icons` | `wh-icons` |
| `.columns-new` | `wh-quad` |
| `.awards-new` | `wh-testimonials` |
| `.columns-altern` | `wh-quad-alternate` |
| `.home-room-dine-spa` | `wh-quad wh-quad-feature-tiles` |
| `.home-map` | `wh-intro-container wh-map-intro` |
| `.home-gallery`, `.shortcode-gallery` | `wh-quad wh-quad-gallery` |

## Phase 4 — Multi-page crawl

Ingest a seed URL and optionally follow same-site links discovered in the rendered HTML:

```bash
npm run ingest -- --url=https://www.wyndhamgrandclearwater.com/ --target=local --crawl --max-pages=5
```

Or discover pages from **sitemap.xml**:

```bash
npm run ingest -- --url=https://www.wyndhamgrandclearwater.com/ --target=local --sitemap --max-pages=10
npm run ingest -- --url=https://www.example.com/ --target=local --sitemap --sitemap-url=https://www.example.com/sitemap_index.xml
```

## Phase 5 — Hardening (domain registry, media, report)

### Domain mapping registry

Site-specific block rules live in `tools/ingest/mappings/`:

| Mapping | Hostname match | Rules file |
|---------|----------------|------------|
| `wyndham` | `*wyndham*` | `mappings/wyndham.mjs` → `lib/wyndham-rules.mjs` |
| `ntt` | `*nttdata.com*`, `*ntt.com*` | `mappings/ntt.mjs` → generic Helix importer |
| `default` | fallback | `mappings/default.mjs` |

Add a new site: create `tools/ingest/mappings/{brand}.mjs` and register it in `lib/domain-registry.mjs`.

### GIF → MP4

Animated GIFs are converted to MP4 when **ffmpeg** is installed on the PATH. Without ffmpeg, GIFs are kept as-is (warning logged).

### Ingest report

Every run writes `drafts/ingest/ingest-report.json` with page slugs, mapping ids, asset counts, and a11y warning totals.

### Accessibility audit

Non-blocking warnings for missing `alt` text, heading hierarchy skips, and missing/multiple `h1` elements.

## Phase 6 — SEO export + AEM packaging

### Bulk metadata export (Excel-compatible)

Every ingest run writes:

| File | Purpose |
|------|---------|
| `drafts/ingest/metadata-seo.csv` | Open in Excel for bulk SEO review/editing |
| `drafts/ingest/metadata-seo.json` | Same data for scripts/CI |

Columns: `url`, `slug`, `title`, `description`, `robots`, `theme`, `nav`, `footer`, `og:image`, paths, mapping id, asset count, a11y warnings.

Skip with `--no-export-metadata`.

### AEM content package (Universal Editor)

Create a ZIP of ingested content for UE upload:

```bash
# Local ingest + zip for handoff
npm run ingest -- --url=https://www.wyndhamgrandclearwater.com/ --target=local --package-aem

# AEM staging target auto-packages
npm run ingest -- --url=https://www.example.com/ --target=aem --config=tools/ingest/config/ingest.config.example.json
```

Output: `aem-content/{project}-package.zip` or `drafts/ingest/{project}-ingest-package.zip`

### Push to AEM Cloud

When `AEM_IMPORT_TOKEN` and `AEM_TARGET` are in `.env`:

```bash
npm run ingest -- --url=https://www.example.com/ --target=aem --push-aem --config=tools/ingest/config/ingest.config.example.json
```

Or package locally then upload manually:

## Phase 7 — Franchise site provisioning

The parent repo holds **shared blocks and themes**. Each franchise gets its own **content island** under `sites/{franchise-slug}/` without changing existing single-site ingest behavior.

When `--franchise` is omitted, output stays at `drafts/ingest/` exactly as before.

### Site templates

Templates are defined in `tools/ingest/config/site-templates.json`:

| Template | Theme | Block mapping |
|----------|-------|---------------|
| `corporate` | `theme-corporate` | default |
| `wyndham-hospitality` | `theme-grand-clearwater` | wyndham (`wh-*` blocks) |
| `riomar` | `theme-riomar` | default |

Add new franchises by extending this file — no CLI changes required.

### Scaffold a new franchise site (no URL yet)

```bash
npm run ingest -- --init-franchise-only \
  --franchise=clearwater-beach \
  --site-template=wyndham-hospitality \
  --theme=theme-grand-clearwater \
  --target=local
```

Creates:

```
drafts/ingest/sites/
├── sites-registry.json          # parent index of all franchises
└── clearwater-beach/
    └── site.json                # template, theme, paths
```

### Ingest franchise content into an isolated site

```bash
npm run ingest -- \
  --url=https://www.wyndhamgrandclearwater.com/ \
  --franchise=clearwater-beach \
  --site-template=wyndham-hospitality \
  --theme=theme-grand-clearwater \
  --target=local \
  --crawl --max-pages=5
```

Content layout:

```
drafts/ingest/sites/clearwater-beach/
├── site.json
├── nav.plain.html
├── footer.plain.html
├── themes/theme-grand-clearwater.css   # copied from parent styles/themes/
└── pages/{page-slug}/index.plain.html
```

Local preview:

```
http://localhost:3000/drafts/ingest/sites/clearwater-beach/pages/{slug}/index
```

For **Document Authoring** or **UE**, franchise paths are appended to `sharepoint.rootFolder` / `aem.publicPrefix` automatically (e.g. `{project}/sites/clearwater-beach/...`).

### Theme options

| Flag | Behavior |
|------|----------|
| `--theme=theme-grand-clearwater` | Reuse parent theme CSS from `styles/themes/` |
| `--generate-theme` | Scrape colors and generate new CSS even when `--theme` is set |

### What stays the same

All existing flags work unchanged: `--target`, `--crawl`, `--sitemap`, `--package-aem`, `--push-aem`, domain mappings, Wyndham block rules, metadata export, and ingest reports.

## Phase 8 — Source validation & auto-reconciliation

After each page is converted, the pipeline **re-validates the generated EDS content against the live source URL** and automatically fine-tunes when gaps are found. Enabled by default.

### What it checks

| Check | Action when failing |
|-------|---------------------|
| Missing headings | Recover source sections not represented in EDS |
| Missing images | Append recovery section + upload assets |
| Low text coverage | Recover missing content blocks from source |
| SEO title/description drift | Sync metadata from source |
| Missing alt text | Copy alt from matching source images |

### Validation score

Each page gets a **0–1 fidelity score** (headings, images, text overlap, SEO, alt text). Default pass threshold: **75%**.

```
[ingest] Validating EDS output against source URL…
[ingest] Validation: score 82% (passed, 1 pass(es))
[ingest] Auto-fixes: Recovered 2 missing section(s); Synced alt text on 3 image(s)
```

Results are included in `ingest-report.json` per page (`validationScore`, `validationPassed`) and in site totals (`avgValidationScore`, `validationPassed`, `validationFailed`).

### CLI flags

```bash
# Default — validate and auto-fix (recommended)
npm run ingest -- --url=https://www.example.com --target=local

# Stricter threshold
npm run ingest -- --url=https://www.example.com --target=local --validate-threshold=0.85

# More fix passes (default 2)
npm run ingest -- --url=https://www.example.com --target=local --validate-max-passes=3

# Skip validation for faster runs
npm run ingest -- --url=https://www.example.com --target=local --no-validate
```

Pages that still fail validation after auto-fix are written with a console warning — review `ingest-report.json` for remaining issues.

```bash
npx aem-import-helper aem upload --zip=aem-content/ntt-eds-ue-package.zip --token=$AEM_IMPORT_TOKEN --target=$AEM_TARGET
```
