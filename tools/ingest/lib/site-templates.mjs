import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const templatesPath = path.join(configDir, '../config/site-templates.json');

let cachedTemplates = null;

/**
 * Load site template catalog from config/site-templates.json.
 * @returns {Record<string, object>}
 */
export function loadSiteTemplates() {
  if (cachedTemplates) return cachedTemplates;
  const raw = readFileSync(templatesPath, 'utf8');
  cachedTemplates = JSON.parse(raw).templates || {};
  return cachedTemplates;
}

/**
 * List available site template ids.
 * @returns {string[]}
 */
export function listSiteTemplates() {
  return Object.keys(loadSiteTemplates());
}

/**
 * Resolve a site template by id.
 * @param {string} id Template id (e.g. wyndham-hospitality)
 * @returns {object|null}
 */
export function resolveSiteTemplate(id) {
  if (!id) return null;
  const templates = loadSiteTemplates();
  const key = String(id).trim().toLowerCase();
  return templates[key] || null;
}

/**
 * Human-readable template label for logging.
 * @param {string} id Template id
 * @returns {string}
 */
export function siteTemplateLabel(id) {
  const template = resolveSiteTemplate(id);
  return template?.label || id;
}
