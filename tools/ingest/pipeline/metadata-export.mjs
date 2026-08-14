import fs from 'fs/promises';
import path from 'path';
import { defaultOutputRoot } from '../lib/project-root.mjs';

const COLUMNS = [
  'url',
  'slug',
  'title',
  'description',
  'robots',
  'theme',
  'mega-menu-style',
  'nav',
  'footer',
  'og:image',
  'pagePublicPath',
  'mappingId',
  'assetCount',
  'a11yWarnings',
];

/**
 * Escape a CSV field value.
 * @param {string|number} value Cell value
 * @returns {string}
 */
function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Build metadata rows from ingest page results.
 * @param {object[]} pages Ingest page results
 * @returns {Record<string, string|number>[]}
 */
export function buildMetadataRows(pages) {
  return pages.map((page) => {
    const rows = page.seoRows || {};
    return {
      url: page.url,
      slug: page.slug,
      title: rows.title || '',
      description: rows.description || '',
      robots: rows.robots || '',
      theme: rows.theme || page.theme || '',
      'mega-menu-style': rows['mega-menu-style'] || '',
      nav: rows.nav || page.navPath || '',
      footer: rows.footer || page.footerPath || '',
      'og:image': rows['og:image'] || rows.image || '',
      pagePublicPath: page.pagePublicPath,
      mappingId: page.mappingId || '',
      assetCount: page.assetCount || 0,
      a11yWarnings: page.a11y?.warnings?.length || 0,
    };
  });
}

/**
 * Write metadata-seo.csv (Excel-compatible, UTF-8 BOM) for bulk SEO authoring.
 * @param {object[]} pages Ingest page results
 * @param {object} [config] Ingest config
 * @returns {Promise<string>} Absolute path to CSV file
 */
export async function writeMetadataExport(pages, config = {}) {
  const outputRoot = config.outputRoot || defaultOutputRoot(config);
  const csvPath = path.join(outputRoot, 'metadata-seo.csv');
  const dataRows = buildMetadataRows(pages);

  const lines = [
    COLUMNS.join(','),
    ...dataRows.map((row) => COLUMNS.map((col) => escapeCsv(row[col])).join(',')),
  ];

  await fs.mkdir(outputRoot, { recursive: true });
  await fs.writeFile(csvPath, `\uFEFF${lines.join('\n')}\n`, 'utf8');
  return csvPath;
}

/**
 * Write metadata-seo.json mirror for programmatic consumers.
 * @param {object[]} pages Ingest page results
 * @param {object} [config] Ingest config
 * @returns {Promise<string>}
 */
export async function writeMetadataJson(pages, config = {}) {
  const outputRoot = config.outputRoot || defaultOutputRoot(config);
  const jsonPath = path.join(outputRoot, 'metadata-seo.json');
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.writeFile(jsonPath, `${JSON.stringify(buildMetadataRows(pages), null, 2)}\n`, 'utf8');
  return jsonPath;
}
