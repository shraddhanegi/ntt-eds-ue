/**
 * Resolve site-specific block mapping rules from URL hostname.
 */
import wyndham from '../mappings/wyndham.mjs';
import ntt from '../mappings/ntt.mjs';
import defaultMapping from '../mappings/default.mjs';

/** Ordered list — first match wins (default must remain last). */
const MAPPINGS = [wyndham, ntt, defaultMapping];

/**
 * @param {string} url Source page URL
 * @returns {import('../mappings/types.mjs').DomainMapping}
 */
export function resolveDomainMapping(url) {
  let hostname = '';
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return defaultMapping;
  }

  const match = MAPPINGS.find((entry) => entry.id !== 'default' && entry.matches(hostname, url));
  return match || defaultMapping;
}

/**
 * Resolve mapping by explicit id (for franchise site templates).
 * @param {string} id Mapping id (wyndham, ntt, default)
 * @returns {import('../mappings/types.mjs').DomainMapping}
 */
export function resolveDomainMappingById(id) {
  const key = String(id || '').toLowerCase().trim();
  const match = MAPPINGS.find((entry) => entry.id === key);
  return match || defaultMapping;
}

/**
 * List registered mapping ids for CLI diagnostics.
 * @returns {string[]}
 */
export function listDomainMappings() {
  return MAPPINGS.map((entry) => entry.id);
}
