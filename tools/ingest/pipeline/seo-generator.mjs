import { generateSeoSlug, truncateSeo } from '../lib/slug.mjs';

/**
 * Build SEO metadata rows for EDS metadata block.
 * @param {object} options
 * @param {object} options.meta Scraped page meta
 * @param {string} options.url Source URL
 * @param {string} [options.ogImagePath] Resolved OG image public path
 * @param {string} [options.navPath] Nav fragment path
 * @param {string} [options.footerPath] Footer fragment path
 * @param {string} [options.theme] Theme body class (e.g. theme-corporate)
 * @param {string} [options.megaMenuStyle] Mega menu layout class
 * @param {string} [options.templateClass] Page template body class
 * @returns {{ slug: string, rows: Record<string, string>, pagePath: string }}
 */
export function generateSeo({
  meta, url, ogImagePath, navPath, footerPath, theme, megaMenuStyle, templateClass,
}) {
  const title = truncateSeo(meta.ogTitle || meta.title || generateSeoSlug(url), 60);
  const description = truncateSeo(meta.ogDescription || meta.description || title, 160);
  const slug = generateSeoSlug(title || url, { removeStopWords: true });

  const rows = {
    title,
    description,
    robots: meta.robots || 'index, follow',
    nav: navPath || '/drafts/ingest/nav',
    footer: footerPath || '/drafts/ingest/footer',
  };

  if (theme) rows.theme = theme;
  if (megaMenuStyle) rows['mega-menu-style'] = megaMenuStyle;
  if (templateClass) rows.template = templateClass;
  if (ogImagePath) rows.image = ogImagePath;
  if (title) rows['og:title'] = title;
  if (description) rows['og:description'] = description;
  if (ogImagePath) rows['og:image'] = ogImagePath;

  return {
    slug,
    rows,
    pagePath: `pages/${slug}/index.plain.html`,
  };
}
