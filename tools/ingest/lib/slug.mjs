const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of']);

/**
 * Generate SEO-friendly URL slug from title or path.
 * @param {string} titleOrUrl Page title or URL path
 * @param {object} [options]
 * @param {boolean} [options.removeStopWords=false]
 * @returns {string}
 */
export function generateSeoSlug(titleOrUrl, options = {}) {
  let text = String(titleOrUrl || '').trim();
  try {
    if (text.startsWith('http')) {
      text = new URL(text).pathname;
    }
  } catch {
    // use raw text
  }

  let parts = text
    .toLowerCase()
    .replace(/\.html?$/, '')
    .replace(/[^a-z0-9\s-/]/g, '')
    .replace(/\//g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (options.removeStopWords) {
    parts = parts.filter((w) => !STOP_WORDS.has(w));
  }

  return parts.join('-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'page';
}

/**
 * Truncate text for SEO field limits.
 * @param {string} text Input text
 * @param {number} maxLen Max length
 * @returns {string}
 */
export function truncateSeo(text, maxLen) {
  const value = String(text || '').trim();
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 1).trim()}…`;
}
