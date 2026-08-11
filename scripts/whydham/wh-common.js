/**
 * Shared DOM and config helpers for Wyndham blocks.
 */

export function sanitizeText(value, maxLength = 500) {
  if (value == null) return '';
  return String(value).trim().slice(0, maxLength);
}

export function readFieldText(field) {
  if (!field) return '';
  const text = field.textContent?.trim() || '';
  const link = field.querySelector('a[href]');
  if (!link) return text;
  const href = link.getAttribute('href')?.trim() || '';
  if (text.startsWith('http://') || text.startsWith('https://')) return text;
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  return text || href;
}

export function readLinkField(field) {
  if (!field) return { href: '', label: '' };
  const link = field.querySelector('a[href]');
  if (!link) return { href: readFieldText(field), label: readFieldText(field) };
  return {
    href: link.getAttribute('href')?.trim() || '',
    label: link.textContent?.trim() || readFieldText(field),
  };
}

export function normalizeConfigKey(key) {
  return key.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

export function readKeyValueConfig(block, aliases) {
  const config = {};
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (cells.length < 2) return;
    const key = cells[0].textContent.trim();
    const value = readFieldText(cells[1]);
    if (!key || !value) return;
    const configKey = aliases[normalizeConfigKey(key)];
    if (configKey) config[configKey] = value;
  });
  return config;
}

export function readProp(block, prop, fallback = '') {
  return readFieldText(block.querySelector(`[data-aue-prop="${prop}"]`)) || fallback;
}

/**
 * Finds the value cell of a `key | value` row, for fields that need the element
 * itself rather than its text, such as images.
 * @param {Element} block block element
 * @param {string} key label in the first cell
 * @returns {Element|null} the value cell, or null when the row is absent
 */
export function readSettingCell(block, key) {
  const target = normalizeConfigKey(key);
  const row = [...block.children].find((candidate) => {
    const cells = [...candidate.children];
    return cells.length >= 2 && normalizeConfigKey(cells[0].textContent || '') === target;
  });
  return row ? row.children[1] : null;
}

/**
 * Reads a value from a `key | value` row, the shape authors get in plain HTML drafts.
 * @param {Element} block block element
 * @param {string} key label in the first cell
 * @returns {string} value of the second cell, or an empty string
 */
export function readRowValue(block, key) {
  return readFieldText(readSettingCell(block, key));
}

/**
 * Reads a setting from a Universal Editor field first, then from a `key | value` row.
 * @param {Element} block block element
 * @param {string} prop property name
 * @param {string} fallback value used when neither source has content
 * @returns {string} resolved setting
 */
export function readSetting(block, prop, fallback = '') {
  return readProp(block, prop) || readRowValue(block, prop) || fallback;
}

export function createButton(href, label, className = 'wh-btn') {
  if (!href || !label) return null;
  const link = document.createElement('a');
  link.className = className;
  link.href = href;
  link.textContent = label;
  return link;
}

const IMAGE_URL = /(\.(avif|gif|jpe?g|png|svg|webp)(\?|#|$))|^\/content\/dam\//i;

/**
 * True when a row was rendered by Universal Editor from a block item model, in
 * which case its cells appear in model field order rather than an authored shape.
 * @param {Element} row row element
 * @returns {boolean} whether the row is a Universal Editor item
 */
export function isModelRow(row) {
  return Boolean(row && row.dataset && row.dataset.aueComponent);
}

/**
 * Returns the rows that carry block items. Universal Editor renders a block's own
 * fields as rows as well, so its instrumented item rows win when present.
 * @param {Element} block block element
 * @returns {Element[]} item rows
 */
export function getItemRows(block) {
  const rows = [...block.children];
  const items = rows.filter(isModelRow);
  return items.length ? items : rows;
}

/**
 * Reads an image from a cell. Universal Editor renders a `reference` field as a
 * link to the asset rather than an `<img>`, so fall back to an image URL.
 * @param {Element} cell cell element
 * @param {string} alt alt text to use when the markup carries none
 * @returns {{src: string, alt: string}|null} image data, or null when absent
 */
export function getImageFromCell(cell, alt = '') {
  if (!cell) return null;
  const img = cell.querySelector('picture img, img');
  if (img) {
    return {
      src: img.getAttribute('src') || '',
      alt: img.getAttribute('alt') || alt,
    };
  }
  const href = cell.querySelector('a[href]')?.getAttribute('href')?.trim()
    || cell.textContent.trim();
  return IMAGE_URL.test(href) ? { src: href, alt } : null;
}

/**
 * Builds a link from separate label and href cells, the shape Universal Editor
 * produces for a `ctaText` / `ctaLink` field pair.
 * @param {Element} labelCell cell holding the link text
 * @param {Element} linkCell cell holding the href
 * @returns {{href: string, label: string}} link data
 */
export function readSplitLink(labelCell, linkCell) {
  const label = labelCell?.textContent.trim() || '';
  const href = linkCell?.querySelector('a[href]')?.getAttribute('href')?.trim()
    || linkCell?.textContent.trim()
    || '';
  return { href, label: label || href };
}
