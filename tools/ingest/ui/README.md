# EDS URL Ingest — Tools > General

Browser-based tool for authors who prefer not to use the terminal. Supports **all 8 ingest pipeline phases**.

## Start the tool

```bash
npm run ingest:ui
```

Open in your browser:

```
http://localhost:3002/
```

Path in the project: **`tools/general/eds-ingest/`**

## Who should use this?

| User | Recommended approach |
|------|---------------------|
| Authors / content ops | **Tools > General > EDS URL Ingest** (this UI) |
| Developers / CI | `npm run ingest -- …` (CLI) |

## What the UI supports

All phases from the CLI:

1. **Scrape & block conversion** — Puppeteer fetch, domain block mapping
2. **Authoring target** — Local, DA, UE, or both
3. **Theme, nav & footer** — Theme CSS + fragments
4. **Multi-page crawl** — HTML link crawl or sitemap
5. **Assets & reports** — Image pipeline, ingest report
6. **Metadata & AEM package** — SEO export, content ZIP
7. **Franchise provisioning** — Template, theme, isolated site folder
8. **Validation & auto-fix** — Compare EDS to source, reconcile gaps

## Typical workflow (Wyndham franchise)

1. Run `npm run ingest:ui`
2. Enter URL: `https://www.wyndhamgrandclearwater.com/`
3. Choose **Local preview** as destination
4. Set franchise slug: `clearwater-beach`
5. Pick site template: **Wyndham hotel franchise**
6. Pick theme: **theme-grand-clearwater**
7. Enable **Crawl same-site links**, max pages **5**
8. Click **Start ingest**
9. When complete, run `npm run dev:drafts` and open the preview path shown

## Update an existing franchise

Select the franchise from **Existing franchise** — the tool loads the stored source URL, template, and theme from `sites-registry.json`.

## Requirements

- Node.js (same as project setup)
- Chrome (for Puppeteer scraping)
- For DA/UE targets: configure `.env` and `tools/ingest/config/ingest.config.json` as documented in [ingest README](../ingest/README.md)

## Port

Default API/UI port: **3002**. Override with:

```bash
INGEST_UI_PORT=3003 npm run ingest:ui
```
