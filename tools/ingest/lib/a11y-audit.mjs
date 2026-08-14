/**
 * Basic accessibility checks on converted main content (warnings only).
 * @param {Element} main Converted main element
 * @returns {{ warnings: string[], stats: object }}
 */
export function auditAccessibility(main) {
  const warnings = [];
  const headings = [...main.querySelectorAll('h1, h2, h3, h4, h5, h6')];
  const h1Count = main.querySelectorAll('h1').length;

  if (h1Count === 0) {
    warnings.push('No h1 found in main content');
  } else if (h1Count > 1) {
    warnings.push(`Multiple h1 elements (${h1Count})`);
  }

  let lastLevel = 0;
  headings.forEach((heading) => {
    const level = Number.parseInt(heading.tagName[1], 10);
    if (lastLevel && level > lastLevel + 1) {
      warnings.push(`Heading skip: h${lastLevel} → h${level} ("${heading.textContent.trim().slice(0, 40)}")`);
    }
    lastLevel = level;
  });

  main.querySelectorAll('img').forEach((img, index) => {
    const alt = img.getAttribute('alt');
    if (alt === null || alt.trim() === '') {
      const src = img.getAttribute('src') || `img-${index + 1}`;
      warnings.push(`Missing alt text: ${src.split('/').pop()}`);
    }
  });

  return {
    warnings,
    stats: {
      headings: headings.length,
      images: main.querySelectorAll('img').length,
      blocks: main.querySelectorAll('[class*="wh-"], .block').length,
    },
  };
}
