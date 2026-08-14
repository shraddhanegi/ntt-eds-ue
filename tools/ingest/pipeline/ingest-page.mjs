import { ingestDom } from './dom-ingestion.mjs';
import { segmentBlocks } from './block-segmentation.mjs';
import { collectMediaUrls, processAssets, applyAssetManifest } from './asset-pipeline.mjs';
import { generateSeo } from './seo-generator.mjs';
import { compilePlainHtml } from './plain-html-compiler.mjs';
import { generateThemeArtifacts } from './theme-generator.mjs';
import { validateAndReconcile } from './validate-reconcile.mjs';
import { auditAccessibility } from '../lib/a11y-audit.mjs';
import {
  createStorageForTarget,
  normalizeTarget,
  shouldMirrorThemeToRepo,
  targetLabel,
} from '../lib/target.mjs';

/**
 * Run full ingest pipeline for a single URL.
 * @param {object} options
 * @param {string} options.url Source page URL
 * @param {string} options.target Storage target: local | da | aem | both
 * @param {object} [options.config={}] Ingest configuration
 * @returns {Promise<object>} Ingest result summary
 */
export async function ingestPage({ url, target, config = {} }) {
  const normalizedTarget = normalizeTarget(target);
  const storage = createStorageForTarget(normalizedTarget, config);

  // eslint-disable-next-line no-console
  console.log(`[ingest] Target: ${targetLabel(normalizedTarget)}`);

  // 1. DOM ingestion
  // eslint-disable-next-line no-console
  console.log(`[ingest] Fetching ${url}…`);
  const scraped = await ingestDom(url);

  const { franchise } = config;

  // 2. Block segmentation
  const {
    document, main, WebImporter, mappingId,
  } = segmentBlocks(scraped.mainHtml, url, {
    mappingId: franchise?.domainMapping || undefined,
  });
  // eslint-disable-next-line no-console
  console.log(`[ingest] Domain mapping: ${mappingId}`);

  // 3. Asset pipeline — resolve paths before compile
  const mediaUrls = collectMediaUrls(main, url);

  // 3b. Theme + nav artifacts (before SEO so nav path is known)
  const themeArtifacts = await generateThemeArtifacts({
    url,
    navHtml: scraped.navHtml,
    footerHtml: scraped.footerHtml,
    themeColors: scraped.themeColors,
    fonts: scraped.fonts,
    logoMeta: scraped.logoMeta,
    footerLogoMeta: scraped.footerLogoMeta,
    storage,
    mirrorToRepoStyles: shouldMirrorThemeToRepo(normalizedTarget),
    themeOverride: franchise?.theme || undefined,
    megaClassOverride: franchise?.megaMenuStyle || undefined,
    useParentTheme: Boolean(franchise?.useParentTheme),
    projectConfig: config,
  });

  const seoExtras = {
    templateClass: franchise?.templateClass || undefined,
  };

  const preliminarySeo = generateSeo({
    meta: scraped.meta,
    url,
    navPath: themeArtifacts.navPath,
    footerPath: themeArtifacts.footerPath,
    theme: themeArtifacts.themeSlug,
    megaMenuStyle: themeArtifacts.megaClass,
    ...seoExtras,
  });

  // eslint-disable-next-line no-console
  console.log(`[ingest] Processing ${mediaUrls.length} assets…`);
  const manifest = await processAssets({
    imageUrls: mediaUrls,
    pageSlug: preliminarySeo.slug,
    storage,
  });

  // 4. Rewrite block JSON in-memory
  applyAssetManifest(main, url, manifest);

  let seoRowsForCompile = null;
  let validation = null;
  const validationEnabled = config.validate !== false;

  if (validationEnabled) {
    // eslint-disable-next-line no-console
    console.log('[ingest] Validating EDS output against source URL…');
    const reconciled = await validateAndReconcile({
      scraped,
      document,
      main,
      url,
      manifest,
      storage,
      seoRows: {
        ...preliminarySeo.rows,
        title: scraped.meta.ogTitle || scraped.meta.title || preliminarySeo.rows.title,
        description: scraped.meta.ogDescription || scraped.meta.description || preliminarySeo.rows.description,
      },
      pageSlug: preliminarySeo.slug,
      validation: config.validation || {},
    });
    seoRowsForCompile = reconciled.seoRows;
    validation = reconciled.validation;
  }

  const a11y = auditAccessibility(main);
  if (a11y.warnings.length) {
    // eslint-disable-next-line no-console
    console.warn(`[ingest] A11y warnings (${a11y.warnings.length}):`, a11y.warnings.slice(0, 5).join('; '));
  }

  let ogImagePath = Object.values(manifest)[0];
  if (scraped.meta.ogImage) {
    try {
      const ogAbs = new URL(scraped.meta.ogImage, url).href;
      if (manifest[ogAbs]) ogImagePath = manifest[ogAbs];
    } catch {
      // ignore invalid og:image URL
    }
  }

  // 5. SEO generation
  const seo = generateSeo({
    meta: scraped.meta,
    url,
    ogImagePath,
    navPath: themeArtifacts.navPath,
    footerPath: themeArtifacts.footerPath,
    theme: themeArtifacts.themeSlug,
    megaMenuStyle: themeArtifacts.megaClass,
    ...seoExtras,
  });

  if (seoRowsForCompile) {
    seo.rows = { ...seo.rows, ...seoRowsForCompile };
  }

  // 6. Plain HTML compile
  const html = compilePlainHtml({
    document,
    WebImporter,
    main,
    metadataRows: seo.rows,
    pageMeta: scraped.meta,
  });

  // 7. Storage adapter — write page
  const pageRelativePath = seo.pagePath;
  await storage.ensureFolder(`pages/${seo.slug}`);
  const pagePublicPath = await storage.uploadDocument(html, pageRelativePath);

  // eslint-disable-next-line no-console
  console.log(`[ingest] Wrote ${pageRelativePath}`);
  if (normalizedTarget === 'da' || normalizedTarget === 'both') {
    // eslint-disable-next-line no-console
    console.log('[ingest] SharePoint upload complete. Allow a few minutes for da.live sync.');
    // eslint-disable-next-line no-console
    console.log(`[ingest] DA preview (after sync): ${pagePublicPath.replace(/\/index\.plain\.html$/, '/index')}`);
  }
  if (normalizedTarget === 'aem' || normalizedTarget === 'both') {
    // eslint-disable-next-line no-console
    console.log('[ingest] AEM staging complete. Push to AEM Cloud with aem-import-helper aem upload.');
    // eslint-disable-next-line no-console
    console.log('[ingest] Set fstab.aem.yaml as fstab.yaml for Universal Editor authoring.');
  }

  return {
    url,
    slug: seo.slug,
    pagePath: pageRelativePath,
    pagePublicPath,
    assetCount: Object.keys(manifest).length,
    manifest,
    target: normalizedTarget,
    mappingId,
    theme: themeArtifacts.themeSlug,
    navPath: themeArtifacts.navPath,
    footerPath: themeArtifacts.footerPath,
    seoRows: seo.rows,
    a11y,
    validation,
  };
}
