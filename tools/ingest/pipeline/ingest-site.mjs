import puppeteer from 'puppeteer';
import { ingestPage } from './ingest-page.mjs';
import { writeIngestReport } from './ingest-report.mjs';
import { writeMetadataExport, writeMetadataJson } from './metadata-export.mjs';
import { packageIngestedContent } from './aem-package.mjs';
import { pushAemPackage, resolveAemPushConfig } from './aem-push.mjs';
import { collectSameSiteLinks } from '../lib/crawl-links.mjs';
import { collectSitemapLinks, defaultSitemapUrl } from '../lib/sitemap-crawl.mjs';
import { listDomainMappings } from '../lib/domain-registry.mjs';
import { normalizeTarget, targetLabel } from '../lib/target.mjs';
import { scaffoldFranchiseSite } from './franchise-scaffold.mjs';
import { siteTemplateLabel } from '../lib/site-templates.mjs';

/**
 * Launch Puppeteer with system Chrome when bundled browser is unavailable.
 * @returns {Promise<import('puppeteer').Browser>}
 */
async function launchBrowser() {
  const options = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  } else {
    options.channel = 'chrome';
  }
  try {
    return await puppeteer.launch(options);
  } catch {
    delete options.channel;
    return puppeteer.launch({ ...options, headless: true });
  }
}

/**
 * Ingest a seed URL and optionally crawl additional same-site pages.
 * @param {object} options
 * @param {string} options.url Seed page URL
 * @param {string} options.target Authoring target: local | da | aem | both
 * @param {object} [options.config={}] Ingest configuration
 * @param {boolean} [options.crawl=false] Discover and ingest linked pages from HTML
 * @param {boolean} [options.sitemap=false] Discover pages from sitemap.xml
 * @param {string} [options.sitemapUrl] Override sitemap URL
 * @param {number} [options.maxPages=10] Max additional pages to crawl
 * @param {boolean} [options.exportMetadata=true] Write metadata-seo.csv/json
 * @param {boolean} [options.packageAem=false] Create content ZIP for UE handoff
 * @param {boolean} [options.pushAem=false] Upload package to AEM Cloud (requires credentials)
 * @param {object} [options.franchise=null] Franchise metadata when --franchise is set
 * @param {string} [options.sourceUrl] Source URL stored on franchise manifest
 * @returns {Promise<object>}
 */
export async function ingestSite({
  url,
  target,
  config = {},
  crawl = false,
  sitemap = false,
  sitemapUrl,
  maxPages = 10,
  exportMetadata = true,
  packageAem = false,
  pushAem = false,
  franchise = null,
  sourceUrl = null,
}) {
  const normalizedTarget = normalizeTarget(target);
  const shouldPackage = packageAem || normalizedTarget === 'aem' || normalizedTarget === 'both';
  const startedAt = new Date().toISOString();
  const results = [];
  const seen = new Set();

  if (franchise?.slug) {
    // eslint-disable-next-line no-console
    console.log(`[ingest] Franchise site: ${franchise.slug}`);
    if (franchise.siteTemplate) {
      // eslint-disable-next-line no-console
      console.log(`[ingest] Site template: ${siteTemplateLabel(franchise.siteTemplate)}`);
    }
    if (franchise.theme) {
      // eslint-disable-next-line no-console
      console.log(`[ingest] Theme: ${franchise.theme}${franchise.useParentTheme ? ' (parent)' : ''}`);
    }
    // eslint-disable-next-line no-console
    console.log(`[ingest] Content prefix: ${franchise.publicPrefix}`);
  }

  const ingestOne = async (pageUrl) => {
    const normalized = pageUrl.replace(/\/$/, '');
    if (seen.has(normalized)) return null;
    seen.add(normalized);
    const result = await ingestPage({ url: pageUrl, target: normalizedTarget, config });
    results.push(result);
    return result;
  };

  await ingestOne(url);

  let crawlSource = null;
  let discoveredLinks = [];

  if (sitemap) {
    crawlSource = 'sitemap';
    const mapUrl = sitemapUrl || defaultSitemapUrl(url);
    // eslint-disable-next-line no-console
    console.log(`[ingest] Fetching sitemap: ${mapUrl}`);
    discoveredLinks = await collectSitemapLinks(mapUrl, url, { maxPages });
  } else if (crawl) {
    crawlSource = 'html-links';
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      const html = await page.content();
      discoveredLinks = collectSameSiteLinks(html, url, { maxPages });
    } finally {
      await browser.close();
    }
  }

  if (discoveredLinks.length) {
    // eslint-disable-next-line no-console
    console.log(`[ingest] ${crawlSource} discovered ${discoveredLinks.length} page(s)`);
    for (let i = 0; i < discoveredLinks.length; i += 1) {
      const link = discoveredLinks[i];
      // eslint-disable-next-line no-console
      console.log(`[ingest] Crawl ${i + 1}/${discoveredLinks.length}: ${link}`);
      await ingestOne(link);
    }
  }

  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    seed: url,
    target: normalizedTarget,
    targetLabel: targetLabel(normalizedTarget),
    crawlSource,
    franchise: franchise?.slug || null,
    domainMappings: listDomainMappings(),
    pages: results.map((page) => ({
      url: page.url,
      slug: page.slug,
      pagePublicPath: page.pagePublicPath,
      mappingId: page.mappingId,
      assetCount: page.assetCount,
      theme: page.theme,
      a11yWarnings: page.a11y?.warnings?.length || 0,
      validationScore: page.validation?.score ?? null,
      validationPassed: page.validation?.passed ?? null,
    })),
    totals: {
      pages: results.length,
      assets: results.reduce((sum, page) => sum + page.assetCount, 0),
      a11yWarnings: results.reduce((sum, page) => sum + (page.a11y?.warnings?.length || 0), 0),
      validationPassed: results.filter((page) => page.validation?.passed).length,
      validationFailed: results.filter((page) => page.validation && !page.validation.passed).length,
      avgValidationScore: results.length
        ? Math.round(
          (results.reduce((sum, page) => sum + (page.validation?.score || 0), 0) / results.length) * 100,
        ) / 100
        : null,
    },
  };

  const reportPath = await writeIngestReport(report, config);
  // eslint-disable-next-line no-console
  console.log(`[ingest] Report: ${reportPath}`);

  let metadataCsvPath = null;
  let metadataJsonPath = null;
  if (exportMetadata && results.length) {
    metadataCsvPath = await writeMetadataExport(results, config);
    metadataJsonPath = await writeMetadataJson(results, config);
    // eslint-disable-next-line no-console
    console.log(`[ingest] Metadata export: ${metadataCsvPath}`);
  }

  let packageZipPath = null;
  if (shouldPackage) {
    packageZipPath = await packageIngestedContent({ target: normalizedTarget, config });
    // eslint-disable-next-line no-console
    console.log(`[ingest] Content package: ${packageZipPath}`);
  }

  let aemPushOk = null;
  if (pushAem) {
    if (!packageZipPath) {
      packageZipPath = await packageIngestedContent({ target: normalizedTarget, config });
    }
    const { token, target: aemTarget } = resolveAemPushConfig(config);
    if (!token || !aemTarget) {
      // eslint-disable-next-line no-console
      console.warn('[ingest] Skipped AEM push — set AEM_IMPORT_TOKEN and AEM_TARGET in .env');
    } else {
      // eslint-disable-next-line no-console
      console.log('[ingest] Pushing content package to AEM Cloud…');
      aemPushOk = pushAemPackage(packageZipPath, config);
      if (aemPushOk) {
        // eslint-disable-next-line no-console
        console.log('[ingest] AEM upload complete.');
      } else {
        // eslint-disable-next-line no-console
        console.warn('[ingest] AEM upload failed — check token, target, and zip contents.');
      }
    }
  }

  let franchiseScaffold = null;
  if (config.franchise?.slug) {
    franchiseScaffold = await scaffoldFranchiseSite({
      config,
      ingestReport: report,
      sourceUrl: sourceUrl || url,
    });
    // eslint-disable-next-line no-console
    console.log(`[ingest] Franchise manifest: ${franchiseScaffold.siteManifestPath}`);
    // eslint-disable-next-line no-console
    console.log(`[ingest] Sites registry: ${franchiseScaffold.registryPath}`);
  }

  return {
    seed: url,
    target: normalizedTarget,
    franchise: config.franchise || null,
    franchiseScaffold,
    pages: results,
    report,
    reportPath,
    metadataCsvPath,
    metadataJsonPath,
    packageZipPath,
    aemPushOk,
  };
}
