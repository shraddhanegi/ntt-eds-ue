import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSeoSlug } from './slug.mjs';
import { listSiteTemplates, resolveSiteTemplate } from './site-templates.mjs';

import { resolveProjectRoot, defaultOutputRoot, defaultProjectName } from './project-root.mjs';

const FRANCHISE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Base ingest output root before franchise scoping.
 * @param {object} config Ingest config
 * @returns {string}
 */
export function resolveIngestBaseOutput(config = {}) {
  if (config.outputRoot && !config.franchise?.slug) {
    return config.outputRoot;
  }
  if (config.franchise?.slug) {
    return path.dirname(config.outputRoot);
  }
  return config.outputRoot || defaultOutputRoot(config);
}

/**
 * Path to sites-registry.json for the parent ingest root.
 * @param {object} [config={}] Ingest config
 * @returns {string}
 */
export function resolveFranchiseRegistryPath(config = {}) {
  const baseOutput = resolveIngestBaseOutput(config);
  return path.join(baseOutput, 'sites', 'sites-registry.json');
}

/**
 * Load raw franchise registry document.
 * @param {object} [config={}] Ingest config
 * @returns {Promise<object>}
 */
export async function loadFranchiseRegistryDocument(config = {}) {
  const registryPath = resolveFranchiseRegistryPath(config);
  try {
    const raw = await fs.readFile(registryPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { version: 1, sites: [] };
  }
}

/**
 * List franchise sites for UI dropdowns.
 * @param {object} [config={}] Ingest config
 * @returns {Promise<object[]>}
 */
export async function listFranchiseSites(config = {}) {
  const registry = await loadFranchiseRegistryDocument(config);
  return (registry.sites || []).map((site) => ({
    slug: site.slug,
    label: site.label,
    siteTemplate: site.siteTemplate,
    theme: site.theme,
    publicPrefix: site.publicPrefix,
    sourceUrl: site.sourceUrl || null,
    siteManifest: site.siteManifest,
  }));
}

/**
 * Load a franchise site manifest by slug.
 * @param {string} slug Franchise slug
 * @param {object} [config={}] Ingest config
 * @returns {Promise<object|null>}
 */
export async function loadFranchiseManifest(slug, config = {}) {
  const baseOutput = resolveIngestBaseOutput(config);
  const manifestPath = path.join(baseOutput, 'sites', slug, 'site.json');
  try {
    const raw = await fs.readFile(manifestPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Resolve franchise defaults for update mode (reuse stored URL, template, theme).
 * @param {string} franchiseSlug Franchise slug
 * @param {object} [config={}] Ingest config
 * @returns {Promise<object|null>}
 */
export async function resolveFranchiseForUpdate(franchiseSlug, config = {}) {
  const franchises = await listFranchiseSites(config);
  const slug = normalizeFranchiseSlug(franchiseSlug);
  const entry = franchises.find((site) => site.slug === slug);
  if (!entry) return null;

  const manifest = await loadFranchiseManifest(slug, config) || {};

  return {
    slug,
    label: entry.label,
    sourceUrl: entry.sourceUrl || manifest.sourceUrl || manifest.lastIngest?.seed || null,
    siteTemplate: entry.siteTemplate || manifest.siteTemplate || null,
    theme: entry.theme || manifest.theme || null,
    publicPrefix: entry.publicPrefix || manifest.publicPrefix || null,
  };
}

/**
 * Normalize franchise slug from CLI input.
 * @param {string} raw Raw franchise name
 * @returns {string}
 */
export function normalizeFranchiseSlug(raw) {
  const slug = generateSeoSlug(String(raw || '').trim(), { removeStopWords: false });
  if (!slug || !FRANCHISE_SLUG_RE.test(slug)) {
    throw new Error(
      `Invalid franchise slug "${raw}". Use letters, numbers, and hyphens (e.g. clearwater-beach).`,
    );
  }
  return slug;
}

/**
 * Append a path segment, avoiding duplicate slashes.
 * @param {string} base Base path
 * @param {string} segment Segment to append
 * @returns {string}
 */
function joinPathSegment(base, segment) {
  return `${String(base || '').replace(/\/$/, '')}/${segment}`.replace(/\/+/g, '/');
}

/**
 * Apply franchise-scoped output paths and metadata to ingest config.
 * When franchise is omitted, config is returned unchanged.
 * @param {object} config Base ingest config
 * @param {object} [options={}]
 * @param {string} [options.franchise] Franchise slug
 * @param {string} [options.siteTemplate] Site template id from site-templates.json
 * @param {string} [options.theme] Parent theme class (e.g. theme-grand-clearwater)
 * @param {boolean} [options.generateTheme=false] Scrape colors even when theme is set
 * @returns {{ config: object, franchise: object|null }}
 */
export function applyFranchiseToConfig(config = {}, options = {}) {
  const { franchise, siteTemplate, theme, generateTheme = false } = options;
  if (!franchise) {
    return { config, franchise: null };
  }

  const slug = normalizeFranchiseSlug(franchise);
  const template = resolveSiteTemplate(siteTemplate);
  if (siteTemplate && !template) {
    throw new Error(
      `Unknown site template "${siteTemplate}". Available: ${listSiteTemplates().join(', ')}`,
    );
  }

  const merged = { ...config };
  const baseOutput = merged.outputRoot || defaultOutputRoot(config);
  const basePrefix = (merged.publicPrefix || '/drafts/ingest').replace(/\/$/, '');

  merged.outputRoot = path.join(baseOutput, 'sites', slug);
  merged.publicPrefix = joinPathSegment(basePrefix, `sites/${slug}`);

  if (merged.sharepoint) {
    const sp = { ...merged.sharepoint };
    const rootBase = sp.rootFolder || merged.projectName || defaultProjectName(config);
    sp.rootFolder = joinPathSegment(rootBase, `sites/${slug}`).replace(/^\//, '');
    if (sp.publicPrefix) {
      sp.publicPrefix = joinPathSegment(sp.publicPrefix, `sites/${slug}`);
    }
    merged.sharepoint = sp;
  }

  if (merged.aem) {
    const aem = { ...merged.aem };
    if (aem.outputRoot) {
      aem.outputRoot = path.join(aem.outputRoot, 'sites', slug);
    }
    if (aem.publicPrefix) {
      aem.publicPrefix = joinPathSegment(aem.publicPrefix, `sites/${slug}`);
    }
    merged.aem = aem;
  }

  const resolvedTheme = theme || template?.defaultTheme || null;
  const useParentTheme = Boolean(resolvedTheme && !generateTheme);

  const franchiseMeta = {
    slug,
    label: String(franchise).trim(),
    siteTemplate: siteTemplate || null,
    templateClass: template?.templateClass || null,
    theme: resolvedTheme,
    megaMenuStyle: template?.megaMenuStyle || (resolvedTheme
      ? resolvedTheme.replace(/^theme-/, 'mega-')
      : null),
    domainMapping: template?.domainMapping || null,
    useParentTheme,
    generateTheme,
    outputRoot: merged.outputRoot,
    publicPrefix: merged.publicPrefix,
  };

  merged.franchise = franchiseMeta;
  return { config: merged, franchise: franchiseMeta };
}
