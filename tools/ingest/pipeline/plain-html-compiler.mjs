import { buildMetadataBlock } from '../lib/import-rules.mjs';
import { serializeElement } from '../lib/dom-env.mjs';

/**
 * Wrap a block or section in EDS section markup.
 * @param {Document} document Document
 * @param {Element} content Block or section content
 * @returns {string}
 */
function wrapSection(document, content) {
  const outer = document.createElement('div');
  const section = document.createElement('div');
  section.className = 'section';
  section.append(content.cloneNode(true));
  outer.append(section);
  return serializeElement(outer);
}

/**
 * Compile full index.plain.html with metadata and main sections.
 * @param {object} options
 * @param {Document} document Linkedom document
 * @param {object} WebImporter WebImporter shim
 * @param {Element} main Converted main element
 * @param {Record<string, string>} metadataRows SEO/metadata rows
 * @param {object} pageMeta Head meta (title, description)
 * @returns {string}
 */
export function compilePlainHtml({
  document,
  WebImporter,
  main,
  metadataRows,
  pageMeta,
}) {
  const metadataBlock = buildMetadataBlock(document, WebImporter, metadataRows);
  const mainClone = main.cloneNode(true);
  mainClone.querySelectorAll('.metadata.block').forEach((el) => el.remove());

  const sections = [wrapSection(document, metadataBlock)];
  [...mainClone.children].forEach((child) => {
    sections.push(wrapSection(document, child));
  });

  const title = pageMeta.title || metadataRows.title || 'Imported page';
  const description = pageMeta.description || metadataRows.description || '';

  return `<!DOCTYPE html>
<html>
  <head>
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="nav" content="${escapeHtml(metadataRows.nav || '')}">
    <meta name="footer" content="${escapeHtml(metadataRows.footer || '')}">
    ${metadataRows.theme ? `<meta name="theme" content="${escapeHtml(metadataRows.theme)}">` : ''}
  </head>
  <body>
    <header></header>
    <main>
${sections.join('\n')}
    </main>
    <footer></footer>
  </body>
</html>
`;
}

/**
 * @param {string} text Raw text
 * @returns {string}
 */
function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
