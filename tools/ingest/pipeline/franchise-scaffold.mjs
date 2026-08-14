import fs from 'fs/promises';
import path from 'path';
import { listSiteTemplates } from '../lib/site-templates.mjs';
import { defaultOutputRoot, resolveProjectRoot } from '../lib/project-root.mjs';

/**
 * Path to the parent sites registry (lists all franchise sites).
 * @param {object} config Ingest config
 * @returns {string}
 */
function resolveRegistryPath(config) {
  if (config.franchise?.slug) {
    return path.join(path.dirname(config.outputRoot), 'sites-registry.json');
  }
  const baseOutput = config.outputRoot || defaultOutputRoot(config);
  return path.join(baseOutput, 'sites', 'sites-registry.json');
}

/**
 * Load existing sites registry or return empty structure.
 * @param {string} registryPath Absolute registry path
 * @returns {Promise<object>}
 */
async function loadRegistry(registryPath) {
  try {
    const raw = await fs.readFile(registryPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { version: 1, sites: [] };
  }
}

/**
 * Write or update franchise site manifest and parent registry.
 * @param {object} options
 * @param {object} options.config Merged ingest config (includes franchise meta)
 * @param {object} [options.ingestReport] Optional ingest report summary
 * @param {string} [options.sourceUrl] Original source URL for franchise updates
 * @returns {Promise<{ siteManifestPath: string, registryPath: string }>}
 */
export async function scaffoldFranchiseSite({ config, ingestReport = null, sourceUrl = null }) {
  const franchise = config.franchise;
  if (!franchise?.slug) {
    throw new Error('scaffoldFranchiseSite requires config.franchise');
  }

  const siteDir = config.outputRoot;
  await fs.mkdir(siteDir, { recursive: true });

  const now = new Date().toISOString();
  const siteManifest = {
    version: 1,
    slug: franchise.slug,
    label: franchise.label,
    siteTemplate: franchise.siteTemplate,
    templateClass: franchise.templateClass,
    theme: franchise.theme,
    megaMenuStyle: franchise.megaMenuStyle,
    domainMapping: franchise.domainMapping,
    publicPrefix: franchise.publicPrefix,
    outputRoot: franchise.outputRoot,
    sourceUrl: sourceUrl || null,
    availableTemplates: listSiteTemplates(),
    createdAt: now,
    updatedAt: now,
    lastIngest: ingestReport ? {
      seed: ingestReport.seed,
      finishedAt: ingestReport.finishedAt,
      pageCount: ingestReport.totals?.pages || ingestReport.pages?.length || 0,
    } : null,
  };

  const siteManifestPath = path.join(siteDir, 'site.json');
  try {
    const existing = JSON.parse(await fs.readFile(siteManifestPath, 'utf8'));
    siteManifest.createdAt = existing.createdAt || now;
  } catch {
    // new site
  }

  await fs.writeFile(siteManifestPath, `${JSON.stringify(siteManifest, null, 2)}\n`, 'utf8');

  const registryPath = resolveRegistryPath(config);
  await fs.mkdir(path.dirname(registryPath), { recursive: true });
  const registry = await loadRegistry(registryPath);
  const sites = Array.isArray(registry.sites) ? registry.sites : [];
  const index = sites.findIndex((site) => site.slug === franchise.slug);
  const entry = {
    slug: franchise.slug,
    label: franchise.label,
    siteTemplate: franchise.siteTemplate,
    theme: franchise.theme,
    publicPrefix: franchise.publicPrefix,
    sourceUrl: sourceUrl || (index >= 0 ? sites[index].sourceUrl : null) || null,
    siteManifest: path.relative(resolveProjectRoot(config), siteManifestPath).replace(/\\/g, '/'),
    updatedAt: now,
  };

  if (index >= 0) {
    sites[index] = { ...sites[index], ...entry };
  } else {
    sites.push({ ...entry, createdAt: now });
  }

  registry.sites = sites.sort((a, b) => a.slug.localeCompare(b.slug));
  registry.updatedAt = now;
  await fs.writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');

  return { siteManifestPath, registryPath };
}

/**
 * Scaffold an empty franchise site without running URL ingest.
 * @param {object} config Merged ingest config with franchise meta
 * @returns {Promise<object>}
 */
export async function initFranchiseSiteOnly(config) {
  const paths = await scaffoldFranchiseSite({ config });
  return {
    franchise: config.franchise,
    ...paths,
    message: 'Franchise site scaffold created. Run ingest with the same --franchise flag to add content.',
  };
}
