# Installing EDS URL Ingest in other environments

The ingest tool is packaged as **`@ntt/eds-url-ingest`** — an installable npm plugin you can add to any AEM Edge Delivery (xwalk) project.

## What gets installed

| Component | Command | Purpose |
|-----------|---------|---------|
| CLI | `eds-ingest` | Full 8-phase pipeline (terminal / CI) |
| Author UI | `eds-ingest-ui` | Browser tool (Tools > General) |
| Library | `@ntt/eds-url-ingest` | Programmatic API (`runIngest`) |

All 8 phases: scrape, target, theme/nav, crawl, assets, metadata/package, franchise, validation.

---

## Option 1 — Install from this repo (monorepo / file link)

In your EDS project `package.json`:

```json
{
  "devDependencies": {
    "@ntt/eds-url-ingest": "file:./tools/ingest"
  },
  "scripts": {
    "ingest": "eds-ingest",
    "ingest:ui": "eds-ingest-ui"
  }
}
```

Then:

```bash
npm install
npm run ingest:ui
# Open http://localhost:3002/
```

Copy `tools/ingest/` into the new project, or submodule the repo.

---

## Option 2 — Private npm registry

Publish once from `tools/ingest/`:

```bash
cd tools/ingest
npm publish --access restricted
```

In any EDS site:

```bash
npm install -D @ntt/eds-url-ingest
npx eds-ingest-ui
```

---

## Option 3 — Git dependency

```json
{
  "devDependencies": {
    "@ntt/eds-url-ingest": "git+https://github.com/YOUR_ORG/ntt-eds-ue.git#main:tools/ingest"
  }
}
```

---

## Option 4 — Docker (shared author server)

Build and run the UI + API in any environment (VM, Kubernetes, Cloud Run):

```bash
cd tools/ingest
docker build -t eds-url-ingest .
docker run -p 3002:3002 \
  -e EDS_PROJECT_ROOT=/workspace \
  -v /path/to/your/eds-site:/workspace \
  eds-url-ingest
```

Authors open `http://<host>:3002/` — no Node install on their laptops.

---

## Host project configuration

The package writes into **your EDS project root** (where you run commands):

```
your-eds-site/
├── drafts/ingest/          ← local target output
├── styles/themes/          ← parent themes (for --theme)
├── ingest.config.json      ← optional (see config/ingest.config.example.json)
└── .env                    ← SharePoint / AEM credentials
```

### Environment variables

| Variable | Purpose |
|----------|---------|
| `EDS_PROJECT_ROOT` | Override project root (Docker / CI) |
| `INGEST_UI_PORT` | Author UI port (default `3002`) |
| `AZURE_*`, `SP_*` | Document Authoring (SharePoint) |
| `AEM_IMPORT_TOKEN`, `AEM_TARGET` | Universal Editor push |
| `PUPPETEER_EXECUTABLE_PATH` | Chrome path if needed |

### Per-environment config file

Copy and customize:

```bash
cp node_modules/@ntt/eds-url-ingest/config/ingest.config.example.json ingest.config.json
```

Run with:

```bash
eds-ingest --url=https://example.com --target=da --config=ingest.config.json
```

---

## Custom domain mappings & templates

Extend the **host project** (not the package defaults):

1. **Site templates** — edit `node_modules/@ntt/eds-url-ingest/config/site-templates.json`  
   Or fork the package and add templates in your published version.

2. **Block mappings** — add `mappings/your-brand.mjs` and register in `lib/domain-registry.mjs`  
   For long-term maintenance, fork `@ntt/eds-url-ingest` or use npm patch / local file dependency.

3. **Themes** — add CSS to host `styles/themes/theme-yourbrand.css`; select in UI or `--theme=theme-yourbrand`.

---

## CI/CD example

```yaml
# GitHub Actions
- run: npm ci
  working-directory: your-eds-site
- run: npx eds-ingest --url=${{ vars.SEED_URL }} --target=local --crawl --max-pages=10
  env:
    EDS_PROJECT_ROOT: ${{ github.workspace }}/your-eds-site
- run: npm run dev:drafts &
# smoke test preview URL
```

---

## Programmatic use

```javascript
import { runIngest } from '@ntt/eds-url-ingest';

await runIngest({
  url: 'https://www.example.com/',
  target: 'local',
  franchise: 'my-franchise',
  siteTemplate: 'wyndham-hospitality',
  theme: 'theme-grand-clearwater',
  crawl: true,
  maxPages: 5,
}, {
  onLog: (entry) => console.log(entry.message),
});
```

---

## Tools > General (Sidekick)

The author UI is served by `eds-ingest-ui` at port **3002**. For production:

- Run Docker container on an internal server
- Or add a reverse proxy: `https://tools.yourcompany.com/eds-ingest/` → `localhost:3002`

Bookmark for authors: **Tools > General > EDS URL Ingest**

---

## Upgrading

```bash
npm update @ntt/eds-url-ingest
```

Or with file dependency, pull latest repo and `npm install`.
