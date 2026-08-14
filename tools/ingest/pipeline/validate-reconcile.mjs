import { createDomEnvironment } from '../lib/dom-env.mjs';
import { collectMediaUrls, processAssets, applyAssetManifest } from './asset-pipeline.mjs';
import {
  compareFingerprints,
  fingerprintFromMain,
  isImageCovered,
  normalizeText,
} from '../lib/content-fingerprint.mjs';

const MIN_SECTION_TEXT = 40;

/**
 * Parse scraped source main HTML into a document.
 * @param {string} mainHtml Source main inner HTML
 * @returns {{ document: Document, main: Element }}
 */
function parseSourceMain(mainHtml) {
  const wrapped = `<!DOCTYPE html><html><body><main>${mainHtml}</main></body></html>`;
  const { document } = createDomEnvironment(wrapped);
  const main = document.querySelector('main');
  if (!main) throw new Error('Unable to parse source main HTML for validation.');
  return { document, main };
}

/**
 * Check whether source section text appears in converted EDS main.
 * @param {Element} sourceNode Source section node
 * @param {Element} edsMain Converted main
 * @returns {boolean}
 */
function isSectionRepresented(sourceNode, edsMain) {
  const snippet = normalizeText(sourceNode.textContent || '').slice(0, 120);
  if (snippet.length < MIN_SECTION_TEXT) return true;
  const edsText = normalizeText(edsMain.textContent || '');
  return edsText.includes(snippet.slice(0, 80));
}

/**
 * Copy alt text from source images onto EDS images matched by filename.
 * @param {Element} edsMain Converted main
 * @param {object[]} sourceImages Source image fingerprint entries
 * @returns {number} Number of alts fixed
 */
function syncAltText(edsMain, sourceImages) {
  const altByKey = new Map(
    sourceImages
      .filter((img) => img.alt?.trim())
      .map((img) => [img.key, img.alt.trim()]),
  );
  let fixed = 0;
  edsMain.querySelectorAll('img[src]').forEach((img) => {
    if (img.getAttribute('alt')?.trim()) return;
    const key = img.getAttribute('src')?.split('/').pop()?.toLowerCase() || '';
    const alt = altByKey.get(key);
    if (alt) {
      img.setAttribute('alt', alt);
      fixed += 1;
    }
  });
  return fixed;
}

/**
 * Append source sections missing from EDS output as recovery sections.
 * @param {Element} edsMain Converted main
 * @param {Element} sourceMain Parsed source main
 * @param {Document} document EDS document
 * @returns {number} Sections appended
 */
function appendMissingSections(edsMain, sourceMain, document) {
  let appended = 0;
  [...sourceMain.children].forEach((child) => {
    const text = normalizeText(child.textContent || '');
    if (text.length < MIN_SECTION_TEXT) return;
    if (isSectionRepresented(child, edsMain)) return;

    const section = document.createElement('div');
    section.className = 'section ingest-recovery';
    section.setAttribute('data-ingest-recovery', 'true');
    section.append(child.cloneNode(true));
    edsMain.append(section);
    appended += 1;
  });
  return appended;
}

/**
 * Collect image filename keys already present in EDS main.
 * @param {Element} edsMain Converted main
 * @returns {Set<string>}
 */
function edsImageKeys(edsMain) {
  return new Set(
    [...edsMain.querySelectorAll('img[src]')]
      .map((el) => el.getAttribute('src')?.split('/').pop()?.toLowerCase() || '')
      .filter(Boolean),
  );
}

/**
 * Append missing images from source as a recovery block.
 * @param {Element} edsMain Converted main
 * @param {object[]} missingImages Missing image entries from comparison
 * @param {Element} sourceMain Parsed source main
 * @param {Document} document EDS document
 * @returns {number} Images appended
 */
function appendMissingImages(edsMain, missingImages, sourceMain, document) {
  if (!missingImages.length) return 0;

  const missingKeys = new Set(missingImages.map((img) => img.key));
  const imgs = [...sourceMain.querySelectorAll('img[src]')].filter((img) => {
    const key = img.getAttribute('src')?.split('/').pop()?.toLowerCase() || '';
    return missingKeys.has(key);
  });

  if (!imgs.length) return 0;

  const section = document.createElement('div');
  section.className = 'section ingest-recovery-images';
  section.setAttribute('data-ingest-recovery', 'images');
  const wrapper = document.createElement('div');
  imgs.slice(0, 12).forEach((img) => {
    const clone = document.createElement('img');
    clone.setAttribute('src', img.getAttribute('src') || '');
    const alt = img.getAttribute('alt');
    if (alt) clone.setAttribute('alt', alt);
    wrapper.append(clone);
  });
  section.append(wrapper);
  edsMain.append(section);
  return imgs.length;
}

/**
 * Sync SEO rows from source metadata when validation detects drift.
 * @param {Record<string, string>} seoRows Current SEO rows
 * @param {object} sourceMeta Scraped source meta
 * @returns {{ rows: Record<string, string>, fixed: string[] }}
 */
function syncSeoFromSource(seoRows, sourceMeta) {
  const rows = { ...seoRows };
  const fixed = [];
  const sourceTitle = sourceMeta.ogTitle || sourceMeta.title || '';
  const sourceDescription = sourceMeta.ogDescription || sourceMeta.description || '';

  if (sourceTitle && normalizeText(rows.title) !== normalizeText(sourceTitle)) {
    rows.title = sourceTitle.trim();
    rows['og:title'] = sourceTitle.trim();
    fixed.push('title');
  }
  if (sourceDescription && normalizeText(rows.description) !== normalizeText(sourceDescription)) {
    rows.description = sourceDescription.trim();
    rows['og:description'] = sourceDescription.trim();
    fixed.push('description');
  }
  return { rows, fixed };
}

/**
 * Validate EDS output against source and apply automatic fixes.
 * @param {object} options
 * @param {object} options.scraped Scraped page ({ mainHtml, meta, navHtml, footerHtml })
 * @param {Document} options.document EDS document
 * @param {Element} options.main Converted main element (mutated in place)
 * @param {string} options.url Source URL
 * @param {object} options.manifest Asset manifest
 * @param {import('../adapters/storage-interface.mjs').StorageAdapter} options.storage
 * @param {Record<string, string>} options.seoRows SEO metadata rows
 * @param {string} options.pageSlug Page slug for asset paths
 * @param {object} [options.validation={}] Validation options
 * @returns {Promise<object>}
 */
export async function validateAndReconcile({
  scraped,
  document,
  main,
  url,
  manifest,
  storage,
  seoRows,
  pageSlug,
  validation = {},
}) {
  const threshold = validation.threshold ?? 0.8;
  const maxPasses = validation.maxPasses ?? 3;
  const fixes = [];
  let pass = 0;
  let comparison = null;
  let currentSeoRows = { ...seoRows };

  const { main: sourceMain } = parseSourceMain(scraped.mainHtml);
  const sourceFp = fingerprintFromMain(sourceMain, scraped.meta, url);

  while (pass < maxPasses) {
    pass += 1;
    const edsFp = fingerprintFromMain(main, {
      title: currentSeoRows.title,
      description: currentSeoRows.description,
    }, url);
    comparison = compareFingerprints(sourceFp, edsFp, { threshold, manifest });

    if (comparison.passed) break;

    const passFixes = [];

    const altFixed = syncAltText(main, sourceFp.images);
    if (altFixed) {
      passFixes.push(`Synced alt text on ${altFixed} image(s)`);
    }

    const seoSync = syncSeoFromSource(currentSeoRows, scraped.meta);
    if (seoSync.fixed.length) {
      currentSeoRows = seoSync.rows;
      passFixes.push(`Synced SEO: ${seoSync.fixed.join(', ')}`);
    }

    const missingImageIssue = comparison.issues.find((issue) => issue.id === 'missing-images');
    if (missingImageIssue) {
      const presentKeys = edsImageKeys(main);
      const missingEntries = sourceFp.images.filter((img) => (
        !isImageCovered(img, presentKeys, manifest)
      ));
      const appended = appendMissingImages(main, missingEntries, sourceMain, document);
      if (appended) passFixes.push(`Recovered ${appended} missing image(s)`);
    }

    const needsSections = comparison.issues.some((issue) => (
      issue.id === 'missing-headings'
      || issue.id === 'low-text-coverage'
      || issue.id === 'low-section-coverage'
      || issue.id === 'low-link-coverage'
    ));
    if (needsSections) {
      const sectionsAdded = appendMissingSections(main, sourceMain, document);
      if (sectionsAdded) passFixes.push(`Recovered ${sectionsAdded} missing section(s)`);
    }

    if (passFixes.length) {
      const newUrls = collectMediaUrls(main, url).filter((mediaUrl) => !manifest[mediaUrl]);
      if (newUrls.length) {
        const newManifest = await processAssets({
          imageUrls: newUrls,
          pageSlug,
          storage,
        });
        Object.assign(manifest, newManifest);
        applyAssetManifest(main, url, manifest);
        passFixes.push(`Uploaded ${newUrls.length} recovered asset(s)`);
      }
    }

    fixes.push({ pass, actions: passFixes, score: comparison.score });

    if (!passFixes.length) break;
  }

  const finalEdsFp = fingerprintFromMain(main, {
    title: currentSeoRows.title,
    description: currentSeoRows.description,
  }, url);
  const finalComparison = compareFingerprints(sourceFp, finalEdsFp, { threshold, manifest });

  // eslint-disable-next-line no-console
  console.log(
    `[ingest] Validation: score ${Math.round(finalComparison.score * 100)}% `
    + `(${finalComparison.passed ? 'passed' : 'needs review'}, ${pass} pass(es))`,
  );
  if (fixes.flatMap((entry) => entry.actions).length) {
    // eslint-disable-next-line no-console
    console.log('[ingest] Auto-fixes:', fixes.flatMap((entry) => entry.actions).join('; '));
  }
  if (!finalComparison.passed && finalComparison.issues.length) {
    // eslint-disable-next-line no-console
    console.warn(
      '[ingest] Remaining validation issues:',
      finalComparison.issues.map((issue) => issue.message).join('; '),
    );
  }

  return {
    seoRows: currentSeoRows,
    validation: {
      enabled: true,
      passes: pass,
      score: finalComparison.score,
      passed: finalComparison.passed,
      threshold,
      issues: finalComparison.issues,
      metrics: finalComparison.metrics,
      fixes,
    },
  };
}
