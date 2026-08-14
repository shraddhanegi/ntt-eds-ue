import { createDomEnvironment } from '../lib/dom-env.mjs';
import { convertMain } from '../lib/import-rules.mjs';

/**
 * Parse scraped main HTML and convert to EDS block structure.
 * @param {string} mainHtml Raw main inner HTML
 * @param {string} sourceUrl Source page URL
 * @param {object} [options={}]
 * @param {string} [options.mappingId] Force domain mapping id from site template
 * @returns {{ document: Document, main: Element, WebImporter: object, mappingId: string }}
 */
export function segmentBlocks(mainHtml, sourceUrl, options = {}) {
  const wrapped = `<!DOCTYPE html><html><head><title></title></head><body><main>${mainHtml}</main></body></html>`;
  const { document, WebImporter } = createDomEnvironment(wrapped);
  const main = document.querySelector('main');
  if (!main) {
    throw new Error('No main element found after parsing scraped content.');
  }

  const mappingId = convertMain(main, document, sourceUrl, WebImporter, options.mappingId);
  return { document, main, WebImporter, mappingId };
}

/**
 * Collect block and section nodes from converted main for compilation.
 * @param {Element} main Main element
 * @returns {Element[]}
 */
export function collectMainSections(main) {
  return [...main.children];
}
