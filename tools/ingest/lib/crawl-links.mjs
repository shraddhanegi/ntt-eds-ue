/**
 * Discover same-site page URLs from rendered HTML.
 * @param {string} html Page HTML
 * @param {string} baseUrl Source page URL
 * @param {object} [options]
 * @param {number} [options.maxPages=10] Maximum URLs to return
 * @returns {string[]}
 */
export function collectSameSiteLinks(html, baseUrl, { maxPages = 10 } = {}) {
  const { origin } = new URL(baseUrl);
  const base = new URL(baseUrl);
  const links = new Set();

  const hrefPattern = /href=["']([^"'#?]+(?:\?[^"'#]*)?)["']/gi;
  let match = hrefPattern.exec(html);
  while (match) {
    try {
      const resolved = new URL(match[1], base);
      if (resolved.origin !== origin) {
        match = hrefPattern.exec(html);
        continue;
      }
      if (!/^https?:$/i.test(resolved.protocol)) {
        match = hrefPattern.exec(html);
        continue;
      }

      resolved.hash = '';
      const normalized = resolved.href.replace(/\/index\.html?$/i, '/').replace(/\/$/, '') || `${origin}/`;
      if (normalized !== base.href.replace(/\/$/, '')) {
        links.add(normalized.endsWith('/') ? normalized.slice(0, -1) : normalized);
      }
    } catch {
      // ignore invalid URLs
    }
    match = hrefPattern.exec(html);
  }

  return [...links].slice(0, maxPages);
}
