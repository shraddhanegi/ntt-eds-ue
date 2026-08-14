import path from 'path';
import { readFileSync } from 'fs';
import { ingestSite } from '../pipeline/ingest-site.mjs';
import { initFranchiseSiteOnly } from '../pipeline/franchise-scaffold.mjs';
import { applyFranchiseToConfig, listFranchiseSites } from './franchise-site.mjs';
import { loadSiteTemplates } from './site-templates.mjs';
import { normalizeTarget, VALID_TARGETS } from './target.mjs';
import { defaultOutputRoot, defaultProjectName, resolveProjectRoot } from './project-root.mjs';

/**
 * Normalize ingest options from CLI or UI into a consistent shape.
 * @param {object} opts Raw options
 * @returns {object}
 */
export function normalizeIngestOptions(opts = {}) {
  return {
    url: opts.url || '',
    target: opts.target || 'local',
    franchise: opts.franchise || '',
    siteTemplate: opts.siteTemplate || opts.site_template || '',
    theme: opts.theme || '',
    generateTheme: Boolean(opts.generateTheme ?? opts.generate_theme),
    initFranchiseOnly: Boolean(opts.initFranchiseOnly ?? opts.init_franchise_only),
    validate: opts.validate !== false && !opts.noValidate && !opts.no_validate,
    validateThreshold: Number.parseFloat(opts.validateThreshold ?? opts.validate_threshold) || 0.8,
    validateMaxPasses: Number.parseInt(opts.validateMaxPasses ?? opts.validate_max_passes, 10) || 3,
    crawl: Boolean(opts.crawl),
    sitemap: Boolean(opts.sitemap),
    sitemapUrl: opts.sitemapUrl || opts.sitemap_url || '',
    maxPages: Number.parseInt(opts.maxPages ?? opts.max_pages, 10) || 10,
    exportMetadata: opts.exportMetadata !== false && !opts.noExportMetadata && !opts.no_export_metadata,
    packageAem: Boolean(opts.packageAem ?? opts.package_aem),
    pushAem: Boolean(opts.pushAem ?? opts.push_aem),
    configPath: opts.config || opts.configPath || '',
    project: opts.project || opts.projectName || '',
    projectRoot: opts.projectRoot || opts.project_root || '',
  };
}

/**
 * Validate options before running ingest.
 * @param {object} opts Normalized options
 */
export function assertIngestOptions(opts) {
  normalizeTarget(opts.target);
  if (!opts.initFranchiseOnly && !opts.url) {
    throw new Error('Source URL is required unless scaffolding a franchise site only.');
  }
  if (opts.initFranchiseOnly && !opts.franchise) {
    throw new Error('Franchise slug is required for scaffold-only mode.');
  }
  if (opts.crawl && opts.sitemap) {
    throw new Error('Choose either crawl or sitemap discovery, not both.');
  }
}

/**
 * Build merged ingest config from options.
 * @param {object} opts Normalized options
 * @returns {{ resolvedConfig: object, franchise: object|null }}
 */
export function buildIngestConfig(opts) {
  const projectRoot = resolveProjectRoot({ projectRoot: opts.projectRoot });
  let config = {
    projectRoot,
    projectName: opts.project || defaultProjectName({ projectRoot }),
    publicPrefix: '/drafts/ingest',
    outputRoot: defaultOutputRoot({ projectRoot }),
  };

  if (opts.configPath) {
    const configFile = path.isAbsolute(opts.configPath)
      ? opts.configPath
      : path.join(projectRoot, opts.configPath);
    config = { ...config, ...JSON.parse(readFileSync(configFile, 'utf8')) };
  }

  if (opts.project) {
    config.projectName = opts.project;
  }

  config.validate = opts.validate;
  config.validation = {
    threshold: opts.validateThreshold,
    maxPasses: opts.validateMaxPasses,
  };

  return applyFranchiseToConfig(config, {
    franchise: opts.franchise || undefined,
    siteTemplate: opts.siteTemplate || undefined,
    theme: opts.theme || undefined,
    generateTheme: opts.generateTheme,
  });
}

/**
 * UI/API metadata for form dropdowns.
 * @returns {Promise<object>}
 */
export async function getIngestUiConfig() {
  const templates = loadSiteTemplates();
  const franchises = await listFranchiseSites();
  return {
    phases: [
      { id: 1, label: 'Scrape & block conversion', description: 'Puppeteer fetch, Wyndham/NTT block mapping' },
      { id: 2, label: 'Authoring target', description: 'Local, Document Authoring, Universal Editor, or both' },
      { id: 3, label: 'Theme, nav & footer', description: 'Theme CSS, navigation and footer fragments' },
      { id: 4, label: 'Multi-page crawl', description: 'HTML link crawl or sitemap discovery' },
      { id: 5, label: 'Assets & domain rules', description: 'Image optimize, GIF→MP4, ingest report' },
      { id: 6, label: 'Metadata & AEM package', description: 'SEO CSV/JSON export, UE content ZIP' },
      { id: 7, label: 'Franchise provisioning', description: 'Isolated franchise sites from templates' },
      { id: 8, label: 'Validation & auto-fix', description: 'Compare EDS output to source and reconcile' },
    ],
    targets: VALID_TARGETS.map((value) => ({
      value,
      label: {
        local: 'Local preview (drafts/)',
        da: 'Document Authoring (SharePoint)',
        aem: 'Universal Editor (AEM staging)',
        both: 'DA + UE (both)',
      }[value] || value,
    })),
    siteTemplates: Object.entries(templates).map(([id, template]) => ({
      id,
      label: template.label,
      defaultTheme: template.defaultTheme,
    })),
    themes: [
      'theme-corporate',
      'theme-grand-clearwater',
      'theme-riomar',
      'theme-wyndhamgrandclearwater',
    ],
    defaultProjectName: defaultProjectName(),
    franchises,
  };
}

/**
 * Run the full ingest pipeline programmatically.
 * @param {object} rawOpts CLI or UI options
 * @param {object} [hooks={}]
 * @param {function(string): void} [hooks.onLog] Log line callback
 * @returns {Promise<object>}
 */
export async function runIngest(rawOpts, hooks = {}) {
  const opts = normalizeIngestOptions(rawOpts);
  assertIngestOptions(opts);

  const { config: resolvedConfig, franchise } = buildIngestConfig(opts);
  const log = hooks.onLog || (() => {});
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  const capture = (level, fn) => (...args) => {
    const message = args.map((arg) => (
      typeof arg === 'string' ? arg : JSON.stringify(arg)
    )).join(' ');
    log({ level, message, time: new Date().toISOString() });
    fn(...args);
  };

  console.log = capture('info', original.log);
  console.warn = capture('warn', original.warn);
  console.error = capture('error', original.error);

  try {
    if (opts.initFranchiseOnly) {
      const result = await initFranchiseSiteOnly(resolvedConfig);
      log({ level: 'info', message: '[ingest] Franchise scaffold complete.', time: new Date().toISOString() });
      return { mode: 'scaffold', ...result };
    }

    const result = await ingestSite({
      url: opts.url,
      target: opts.target,
      config: resolvedConfig,
      crawl: opts.crawl,
      sitemap: opts.sitemap,
      sitemapUrl: opts.sitemapUrl || undefined,
      maxPages: opts.maxPages,
      exportMetadata: opts.exportMetadata,
      packageAem: opts.packageAem,
      pushAem: opts.pushAem,
      franchise,
      sourceUrl: opts.url,
    });

    log({ level: 'info', message: '[ingest] Done.', time: new Date().toISOString() });
    return { mode: 'ingest', ...result };
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }
}
