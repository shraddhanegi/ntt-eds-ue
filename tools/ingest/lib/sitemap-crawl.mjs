/**
 * Fetch and parse sitemap.xml (or sitemap index) for same-origin page URLs.
 * @param {string} sitemapUrl Absolute sitemap URL
 * @param {string} seedUrl Seed page URL (for origin filter)
 * @param {object} [options]
 * @param {number} [options.maxPages=50] Maximum URLs to return
 * @returns {Promise<string[]>}
 */
export async function collectSitemapLinks(sitemapUrl, seedUrl, { maxPages = 50 } = {}) {
  const { origin } = new URL(seedUrl);
  const seen = new Set();
  const results = [];

  /**
   * @param {string} url Sitemap URL to fetch
   */
  async function fetchSitemap(url) {
    if (seen.has(url) || results.length >= maxPages) return;
    seen.add(url);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'EDS-Ingest/1.0' },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return;

    const xml = await response.text();
    const locPattern = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
    let match = locPattern.exec(xml);

    while (match && results.length < maxPages) {
      const loc = match[1].trim();
      try {
        const resolved = new URL(loc);
        if (resolved.pathname.endsWith('.xml')) {
          await fetchSitemap(resolved.href);
        } else if (resolved.origin === origin && /^https?:$/i.test(resolved.protocol)) {
          resolved.hash = '';
          const normalized = resolved.href.replace(/\/index\.html?$/i, '/').replace(/\/$/, '')
            || origin;
          const pageUrl = normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
          const seedNormalized = seedUrl.replace(/\/index\.html?$/i, '/').replace(/\/$/, '');
          if (pageUrl !== seedNormalized) {
            results.push(pageUrl);
          }
        }
      } catch {
        // skip invalid loc
      }
      match = locPattern.exec(xml);
    }
  }

  await fetchSitemap(sitemapUrl);
  return [...new Set(results)].slice(0, maxPages);
}

/**
 * Guess sitemap URL from seed page origin.
 * @param {string} seedUrl Seed page URL
 * @returns {string}
 */
export function defaultSitemapUrl(seedUrl) {
  const { origin } = new URL(seedUrl);
  return `${origin}/sitemap.xml`;
}
