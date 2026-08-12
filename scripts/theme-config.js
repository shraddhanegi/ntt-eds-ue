import { getMetadata, readBlockConfig, toClassName } from './aem.js';

export const DEFAULT_THEME = 'theme-corporate';

export const THEME_DEFAULTS = {
  'theme-corporate': { nav: 'nav', footer: 'footer' },
  'theme-brand': { nav: 'nav-brand', footer: 'footer-brand' },
};

const THEME_ALIASES = {
  'theme-corporate': 'theme-corporate',
  'theme-brand': 'theme-brand',
  'theme-1-corporate': 'theme-corporate',
  'theme-2-brand': 'theme-brand',
};

/**
 * Normalize a theme metadata value to a supported theme class name.
 * @param {string} raw Raw theme metadata value
 * @returns {string}
 */
export function normalizeThemeClass(raw) {
  const className = toClassName(String(raw || '').trim());
  return THEME_ALIASES[className] || className;
}

/**
 * Read config rows from a metadata block element.
 * @param {Element} block Metadata block element
 * @returns {object}
 */
function readMetadataBlock(block) {
  if (!block) return {};
  return readBlockConfig(block);
}

/**
 * Promote metadata block values into head meta tags for downstream consumers.
 * @param {Document} doc Document to update
 */
export function extractMetadataFromMain(doc = document) {
  const main = doc.querySelector('main');
  if (!main) return;

  main.querySelectorAll('.metadata').forEach((metadataBlock) => {
    const config = readMetadataBlock(metadataBlock);
    Object.entries(config).forEach(([key, value]) => {
      if (!value || getMetadata(key, doc)) return;
      const meta = doc.createElement('meta');
      meta.name = key;
      meta.content = Array.isArray(value) ? value.join(',') : String(value);
      doc.head.append(meta);
    });

    const wrapper = metadataBlock.closest('main > div') || metadataBlock.parentElement;
    wrapper?.remove();
  });
}

/**
 * Read a metadata value from head, page metadata block, or embedded draft meta tags.
 * @param {string} name Metadata name
 * @param {Document} doc Document to query
 * @returns {string}
 */
export function getPageMetadataValue(name, doc = document) {
  const attr = name && name.includes(':') ? 'property' : 'name';

  const metaTags = [...doc.querySelectorAll(`meta[${attr}="${name}"]`)]
    .map((m) => m.content)
    .filter(Boolean)
    .join(', ');
  if (metaTags) return metaTags;

  const metadataBlocks = doc.querySelectorAll('.metadata');
  for (let i = 0; i < metadataBlocks.length; i += 1) {
    const config = readMetadataBlock(metadataBlocks[i]);
    const key = toClassName(name);
    if (config[key]) return config[key];
  }

  return '';
}

/**
 * Resolve the active page theme class name.
 * @param {Document} doc Document to query
 * @returns {string}
 */
export function getPageTheme(doc = document) {
  const theme = getPageMetadataValue('theme', doc);
  const className = theme ? normalizeThemeClass(theme) : DEFAULT_THEME;
  return THEME_DEFAULTS[className] ? className : DEFAULT_THEME;
}

/**
 * Apply template and theme classes from page metadata.
 * @param {Document} doc Document to decorate
 */
export function applyPageThemeClass(doc = document) {
  const addClasses = (classes) => {
    classes.split(',').forEach((c) => {
      const className = toClassName(c.trim());
      if (className) doc.body.classList.add(className);
    });
  };

  const template = getPageMetadataValue('template', doc);
  if (template) addClasses(template);

  doc.body.classList.add(getPageTheme(doc));
}

/**
 * Extract metadata, then apply page theme classes.
 * @param {Document} doc Document to initialize
 */
export function initPageTheme(doc = document) {
  extractMetadataFromMain(doc);
  applyPageThemeClass(doc);
}

/**
 * Resolve theme-specific fragment basename (nav, footer, nav-brand, etc.).
 * @param {'nav'|'footer'} type Fragment type
 * @returns {string}
 */
export function getThemeFragmentName(type) {
  const theme = getPageTheme();
  return THEME_DEFAULTS[theme][type];
}
