/**
 * Extract comparable content fingerprints from source HTML and converted EDS main.
 */

/**
 * Normalize text for fuzzy comparison.
 * @param {string} text Raw text
 * @returns {string}
 */
export function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenize normalized text into significant words.
 * @param {string} text Normalized text
 * @returns {Set<string>}
 */
function tokenize(text) {
  const stop = new Set(['the', 'and', 'for', 'with', 'from', 'your', 'our', 'are', 'was', 'this', 'that']);
  return new Set(
    normalizeText(text)
      .split(' ')
      .filter((word) => word.length > 2 && !stop.has(word)),
  );
}

/**
 * Jaccard similarity between two token sets.
 * @param {Set<string>} a First set
 * @param {Set<string>} b Second set
 * @returns {number}
 */
function jaccardSimilarity(a, b) {
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  a.forEach((token) => {
    if (b.has(token)) intersection += 1;
  });
  const union = a.size + b.size - intersection;
  return union ? intersection / union : 0;
}

/**
 * Resolve image URL basename for loose matching.
 * @param {string} src Image src
 * @returns {string}
 */
function imageKey(src) {
  try {
    const { pathname } = new URL(src, 'https://example.com');
    return pathname.split('/').pop()?.toLowerCase() || src;
  } catch {
    return String(src || '').split('/').pop()?.toLowerCase() || '';
  }
}

/**
 * Build fingerprint from a DOM main element.
 * @param {Element} main Main element
 * @param {object} [meta={}] Optional page meta
 * @param {string} [baseUrl=''] Page base URL for resolving relative src
 * @returns {object}
 */
export function fingerprintFromMain(main, meta = {}, baseUrl = '') {
  const headings = [...main.querySelectorAll('h1, h2, h3, h4, h5, h6')]
    .map((el) => normalizeText(el.textContent))
    .filter(Boolean);

  const images = [...main.querySelectorAll('img[src]')].map((img) => {
    const src = img.getAttribute('src') || '';
    let absSrc = src;
    try {
      absSrc = new URL(src, baseUrl || 'https://example.com').href;
    } catch {
      absSrc = src;
    }
    return {
      src,
      absSrc,
      alt: img.getAttribute('alt') || '',
      key: imageKey(src),
    };
  });

  const links = main.querySelectorAll('a[href]').length;
  const text = normalizeText(main.textContent || '');
  const words = tokenize(text);
  const blocks = main.querySelectorAll('[class*="block"], [class*="wh-"]').length;
  const sections = main.children.length;

  return {
    headings,
    images,
    links,
    text,
    words,
    blocks,
    sections,
    textLength: text.length,
    meta: {
      title: normalizeText(meta.title || meta.ogTitle || ''),
      description: normalizeText(meta.description || meta.ogDescription || ''),
    },
  };
}

/**
 * Whether a source image is represented in EDS output or asset manifest.
 * @param {object} img Source image entry
 * @param {Set<string>} edsKeys EDS image filename keys
 * @param {object} [manifest={}] Asset manifest (source URL → public path)
 * @returns {boolean}
 */
export function isImageCovered(img, edsKeys, manifest = {}) {
  if (img.key && edsKeys.has(img.key)) return true;
  if (img.absSrc && manifest[img.absSrc]) return true;
  const stem = img.key?.replace(/\.[a-z0-9]+$/i, '') || '';
  if (stem && Object.keys(manifest).some((src) => src.toLowerCase().includes(stem.slice(0, 24)))) {
    return true;
  }
  return Object.values(manifest).some((publicPath) => (
    String(publicPath).toLowerCase().includes(img.key)
  ));
}

/**
 * Compare source and EDS fingerprints.
 * @param {object} source Source fingerprint
 * @param {object} eds EDS fingerprint
 * @param {object} [options={}]
 * @param {number} [options.threshold=0.8] Pass score threshold
 * @param {object} [options.manifest={}] Asset manifest for image coverage
 * @returns {{ score: number, passed: boolean, issues: object[] }}
 */
export function compareFingerprints(source, eds, options = {}) {
  const threshold = options.threshold ?? 0.8;
  const manifest = options.manifest || {};
  const issues = [];

  const edsHeadingSet = new Set(eds.headings);
  const missingHeadings = source.headings.filter((heading) => {
    if (edsHeadingSet.has(heading)) return false;
    return ![...edsHeadingSet].some((edsHeading) => (
      edsHeading.includes(heading) || heading.includes(edsHeading)
    ));
  });

  if (missingHeadings.length) {
    issues.push({
      id: 'missing-headings',
      severity: 'high',
      message: `${missingHeadings.length} heading(s) from source not found in EDS`,
      details: missingHeadings.slice(0, 8),
    });
  }

  const edsImageKeys = new Set(eds.images.map((img) => img.key).filter(Boolean));
  const missingImages = source.images.filter((img) => !isImageCovered(img, edsImageKeys, manifest));
  if (missingImages.length) {
    issues.push({
      id: 'missing-images',
      severity: 'high',
      message: `${missingImages.length} image(s) from source not found in EDS`,
      details: missingImages.slice(0, 8).map((img) => img.key),
    });
  }

  const sourceImageCount = source.images.length;
  const edsImageCount = eds.images.length;
  if (sourceImageCount > 0 && edsImageCount / sourceImageCount < 0.6) {
    issues.push({
      id: 'low-image-coverage',
      severity: 'medium',
      message: `Image coverage low (${edsImageCount}/${sourceImageCount})`,
      details: { source: sourceImageCount, eds: edsImageCount },
    });
  }

  const textSimilarity = jaccardSimilarity(source.words, eds.words);
  if (textSimilarity < 0.55 && source.textLength > 200) {
    issues.push({
      id: 'low-text-coverage',
      severity: 'high',
      message: `Text coverage low (${Math.round(textSimilarity * 100)}% word overlap)`,
      details: { similarity: textSimilarity },
    });
  }

  if (source.meta.title && eds.meta.title) {
    const titleMatch = source.meta.title === eds.meta.title
      || source.meta.title.includes(eds.meta.title)
      || eds.meta.title.includes(source.meta.title);
    if (!titleMatch) {
      issues.push({
        id: 'seo-title-mismatch',
        severity: 'medium',
        message: 'Page title differs from source',
        details: { source: source.meta.title, eds: eds.meta.title },
      });
    }
  }

  if (source.meta.description && eds.meta.description) {
    const descSimilarity = jaccardSimilarity(
      tokenize(source.meta.description),
      tokenize(eds.meta.description),
    );
    if (descSimilarity < 0.5) {
      issues.push({
        id: 'seo-description-mismatch',
        severity: 'low',
        message: 'Meta description differs from source',
        details: { similarity: descSimilarity },
      });
    }
  }

  const missingAlt = eds.images.filter((img) => !img.alt?.trim());
  if (missingAlt.length) {
    issues.push({
      id: 'missing-alt-text',
      severity: 'medium',
      message: `${missingAlt.length} image(s) missing alt text in EDS`,
      details: missingAlt.slice(0, 8).map((img) => img.key),
    });
  }

  const linkRatio = source.links > 0 ? Math.min(1, eds.links / source.links) : 1;
  if (source.links > 5 && linkRatio < 0.4) {
    issues.push({
      id: 'low-link-coverage',
      severity: 'medium',
      message: `Link coverage low (${eds.links}/${source.links})`,
      details: { source: source.links, eds: eds.links },
    });
  }

  const sectionRatio = source.sections > 0 ? Math.min(1, eds.sections / source.sections) : 1;
  if (source.sections >= 4 && sectionRatio < 0.5) {
    issues.push({
      id: 'low-section-coverage',
      severity: 'high',
      message: `Section/block coverage low (${eds.sections}/${source.sections} top-level nodes)`,
      details: { source: source.sections, eds: eds.sections },
    });
  }

  const headingScore = source.headings.length
    ? (source.headings.length - missingHeadings.length) / source.headings.length
    : 1;
  const imageScore = source.images.length
    ? (source.images.length - missingImages.length) / source.images.length
    : 1;
  const seoScore = issues.some((issue) => issue.id.startsWith('seo-')) ? 0.5 : 1;
  const altScore = eds.images.length
    ? (eds.images.length - missingAlt.length) / eds.images.length
    : 1;

  const score = (
    headingScore * 0.20
    + imageScore * 0.20
    + textSimilarity * 0.30
    + seoScore * 0.05
    + altScore * 0.10
    + linkRatio * 0.15
  );

  return {
    score: Math.round(score * 1000) / 1000,
    passed: score >= threshold && !issues.some((issue) => issue.severity === 'high'),
    issues,
    metrics: {
      headingScore,
      imageScore,
      textSimilarity,
      seoScore,
      altScore,
      linkRatio,
      sectionRatio,
    },
  };
}
