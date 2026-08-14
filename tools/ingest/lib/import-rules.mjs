/**
 * Ported Helix Importer rules from tools/importer/import.js for Node (Linkedom).
 * @see tools/importer/import.js
 */

import { resolveDomainMapping, resolveDomainMappingById } from './domain-registry.mjs';

export const CHROME_SELECTORS = [
  'header',
  'footer',
  'nav',
  '.l-header-ed23',
  '.l-footer',
  '.primary-nav-header',
  '.countryInitialModal',
  '.cookie-banner',
  '.disclaimer',
  'script',
  'noscript',
  'form',
  '.l-header__search-form',
];

const COLUMN_CLASS_RE = /\bc-\d+column(-tab)?\b/;
const HERO_CLASS_RE = /mainvisual|banner-container/i;

function isInChrome(el) {
  return !!el.closest('header, footer, nav, .l-header-ed23, .l-footer');
}

function sortDeepestFirst(elements) {
  return [...elements].sort((a, b) => {
    if (a.contains(b)) return 1;
    if (b.contains(a)) return -1;
    return 0;
  });
}

function absoluteSrc(img, baseUrl) {
  const src = img.getAttribute('src') || img.src || '';
  if (!src || src.startsWith('data:')) return src;
  if (!baseUrl) return src;
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}

function createPicture(img, document, baseUrl) {
  const pic = document.createElement('picture');
  const image = document.createElement('img');
  image.src = absoluteSrc(img, baseUrl);
  image.alt = img.alt || '';
  pic.append(image);
  return pic;
}

function buildImageList(images, document, baseUrl) {
  const list = document.createElement('ul');
  images.forEach((img) => {
    const li = document.createElement('li');
    li.append(createPicture(img, document, baseUrl));
    list.append(li);
  });
  return list;
}

function extractTitle(root) {
  return root.querySelector('h1, h2, h3, [class*="__title"], [class*="-title"]');
}

function extractDescription(root) {
  const title = extractTitle(root);
  const p = [...root.querySelectorAll('p')].find(
    (node) => !node.closest('[class*="__img"]') && node !== title && !node.querySelector('a'),
  );
  return p?.textContent?.trim() || '';
}

function extractLink(root) {
  return root.querySelector('a[href]');
}

function wrapLink(link, document) {
  if (!link) return '';
  const p = document.createElement('p');
  const a = link.cloneNode(true);
  a.removeAttribute('class');
  p.append(a);
  return p;
}

function copyCardBody(panel, document) {
  const body = document.createElement('div');
  const source = panel.querySelector('[class*="__body"]') || panel;
  source.querySelectorAll('h2, h3, h4, p').forEach((node) => {
    if (node.closest('[class*="__img"]')) return;
    body.append(node.cloneNode(true));
  });
  const link = extractLink(panel);
  if (link && !body.querySelector('a[href]')) {
    body.append(wrapLink(link, document));
  }
  return body;
}

function isHeroRoot(el) {
  if (isInChrome(el)) return false;
  if (!['SECTION', 'DIV'].includes(el.tagName)) return false;
  const cls = el.getAttribute('class') || '';
  if (/cookie|modal|nav/i.test(cls)) return false;
  return HERO_CLASS_RE.test(cls);
}

function isPanel(el) {
  if (el.tagName !== 'DIV' || isInChrome(el)) return false;
  return /\bp-panel\b/.test(el.getAttribute('class') || '')
    || el.className.includes('p-panel');
}

function isColumnLayout(el) {
  if (el.tagName !== 'DIV' || isInChrome(el)) return false;
  if (isPanel(el)) return false;
  return COLUMN_CLASS_RE.test(el.getAttribute('class') || '');
}

function isBlockSection(el) {
  if (isInChrome(el)) return false;
  return /\bp-block\b/.test(el.getAttribute('class') || '');
}

function getColumnCount(el) {
  const cls = el.getAttribute('class') || '';
  const match = cls.match(/c-(\d)column(?!-tab)/) || cls.match(/c-(\d)column-tab/);
  if (match) return Number.parseInt(match[1], 10);
  const children = [...el.children].filter((child) => child.tagName === 'DIV');
  return Math.max(1, Math.min(children.length, 4));
}

function buildHeroBlock(source, document, baseUrl, WebImporter) {
  const slides = [...source.querySelectorAll('.swiper-slide')];
  const items = slides.length ? slides : [source];
  const first = items[0];

  const titleEl = extractTitle(first);
  const titleRow = titleEl ? titleEl.cloneNode(true) : document.createElement('h2');

  const descRow = document.createElement('p');
  descRow.textContent = extractDescription(first);

  const linkRow = wrapLink(extractLink(first), document);

  const images = items.flatMap((item) => [...item.querySelectorAll('img')]);
  const imageRow = images.length ? buildImageList(images, document, baseUrl) : '';

  return WebImporter.Blocks.createBlock(document, {
    name: 'hero-banner',
    cells: [
      [titleRow],
      [descRow],
      [linkRow || ''],
      [imageRow || ''],
    ],
  });
}

function buildCardsBlock(panels, document, baseUrl, WebImporter) {
  const cells = panels.map((panel) => {
    const img = panel.querySelector('img');
    const image = img ? createPicture(img, document, baseUrl) : '';
    return [image, copyCardBody(panel, document)];
  });
  return WebImporter.Blocks.createBlock(document, { name: 'cards', cells });
}

function panelToColumnCell(panel, document, baseUrl) {
  const col = document.createElement('div');
  const img = panel.querySelector('img');
  if (img) col.append(createPicture(img, document, baseUrl));
  col.append(copyCardBody(panel, document));
  return col;
}

function buildColumnsBlock(layout, document, baseUrl, WebImporter) {
  const panels = [...layout.children].filter(isPanel);
  const children = panels.length
    ? panels
    : [...layout.children].filter((child) => child.tagName === 'DIV');

  if (!children.length) return null;

  const columnCount = getColumnCount(layout);
  const rows = [];
  for (let i = 0; i < children.length; i += columnCount) {
    rows.push(
      children.slice(i, i + columnCount).map((child) => (
        isPanel(child)
          ? panelToColumnCell(child, document, baseUrl)
          : child.cloneNode(true)
      )),
    );
  }

  return WebImporter.Blocks.createBlock(document, { name: 'columns', cells: rows });
}

function convertHeroBanners(main, document, baseUrl, WebImporter) {
  const heroes = sortDeepestFirst(
    [...main.querySelectorAll('section, div')].filter(isHeroRoot),
  );
  heroes.forEach((hero) => {
    if (hero.isConnected) hero.replaceWith(buildHeroBlock(hero, document, baseUrl, WebImporter));
  });
}

function convertColumnLayouts(main, document, baseUrl, WebImporter) {
  const layouts = sortDeepestFirst(
    [...main.querySelectorAll('div')].filter(isColumnLayout),
  );
  layouts.forEach((layout) => {
    if (!layout.isConnected) return;
    const block = buildColumnsBlock(layout, document, baseUrl, WebImporter);
    if (block) layout.replaceWith(block);
  });
}

function convertPanelGroupsToCards(main, document, baseUrl, WebImporter) {
  const panels = [...main.querySelectorAll('div')].filter(isPanel);
  const groups = new Map();

  panels.forEach((panel) => {
    const { parentElement } = panel;
    if (!groups.has(parentElement)) groups.set(parentElement, []);
    groups.get(parentElement).push(panel);
  });

  groups.forEach((panelList) => {
    if (!panelList.length) return;
    const block = buildCardsBlock(panelList, document, baseUrl, WebImporter);
    panelList[0].replaceWith(block);
    panelList.slice(1).forEach((panel) => panel.remove());
  });
}

function convertSimpleBlockSections(main, document) {
  [...main.querySelectorAll('section, div')].filter(isBlockSection).forEach((section) => {
    if (!section.isConnected) return;
    if ([...section.querySelectorAll('div')].some((el) => isColumnLayout(el) || isPanel(el))) {
      return;
    }
    const heading = section.querySelector('h1, h2, h3');
    if (!heading) return;

    const wrapper = document.createElement('div');
    wrapper.append(heading.cloneNode(true));
    section.querySelectorAll('p').forEach((p) => {
      if (!p.closest('[class*="__img"]')) wrapper.append(p.cloneNode(true));
    });
    const link = extractLink(section);
    if (link) wrapper.append(wrapLink(link, document));
    section.replaceWith(wrapper);
  });
}

/**
 * Generic fallback: wrap top-level main children as default content sections.
 * @param {Element} main Main element
 * @param {Document} document Document
 */
function wrapDefaultSections(main, document) {
  const directChildren = [...main.children];
  if (directChildren.some((el) => el.classList?.contains('block'))) return;

  directChildren.forEach((child) => {
    if (child.classList?.contains('block')) return;
    const section = document.createElement('div');
    section.append(child.cloneNode(true));
    child.replaceWith(section);
  });
}

/**
 * NTT / generic Helix Importer block conversion.
 * @param {Element} main Main content root
 * @param {Document} document Document
 * @param {string} url Source page URL
 * @param {object} WebImporter WebImporter shim
 */
export function convertNttBlocks(main, document, url, WebImporter) {
  convertHeroBanners(main, document, url, WebImporter);
  convertColumnLayouts(main, document, url, WebImporter);
  convertPanelGroupsToCards(main, document, url, WebImporter);
  convertSimpleBlockSections(main, document);
}

/**
 * Convert scraped main content into EDS block structure.
 * @param {Element} main Main content root
 * @param {Document} document Document
 * @param {string} url Source page URL
 * @param {object} WebImporter WebImporter shim
 * @param {string} [mappingIdOverride] Force a domain mapping id (from site template)
 * @returns {string} Resolved domain mapping id
 */
export function convertMain(main, document, url, WebImporter, mappingIdOverride) {
  WebImporter.DOMUtils.remove(main, CHROME_SELECTORS);
  const mapping = mappingIdOverride
    ? resolveDomainMappingById(mappingIdOverride)
    : resolveDomainMapping(url);
  mapping.convertBlocks(main, document, url, WebImporter);
  wrapDefaultSections(main, document);
  return mapping.id;
}

/**
 * Build metadata block for page (nav/footer paths supplied by caller).
 * @param {Document} document Document
 * @param {object} WebImporter WebImporter shim
 * @param {object} meta Metadata key/value pairs
 * @returns {Element}
 */
export function buildMetadataBlock(document, WebImporter, meta) {
  return WebImporter.Blocks.getMetadataBlock(document, meta);
}
