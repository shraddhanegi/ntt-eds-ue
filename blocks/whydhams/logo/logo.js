import { createOptimizedPicture } from '../../../scripts/aem.js';
import { moveInstrumentation } from '../../../scripts/scripts.js';
import {
  getImageFromCell, readKeyValueConfig, readProp, readLinkField, readSettingCell,
} from '../../../scripts/whydham/wh-common.js';

const ALIASES = {
  logoalt: 'logoAlt',
  homelink: 'homeLink',
};

/**
 * Key-value rows pair a label with a value, so they always hold two cells. A
 * block nested in the header instead renders one cell per field.
 */
function hasKeyValueRows(block) {
  return [...block.children].some((row) => row.children.length >= 2);
}

/** Reads logoImage | logoAlt | homeLink cells, the nested block shape. */
function readPositionalFields(block) {
  const cells = [...block.children];
  const alt = cells[1]?.textContent.trim() || '';
  return {
    image: getImageFromCell(cells[0], alt),
    logoAlt: alt,
    homeLink: cells[2]?.querySelector('a[href]')?.getAttribute('href')?.trim() || '',
  };
}

function readLogoImage(block) {
  const field = block.querySelector('[data-aue-prop="logoImage"]')
    || block.querySelector('picture, img')?.closest('div');
  const img = field?.querySelector('picture img, img') || block.querySelector('picture img, img');
  if (!img) return null;
  return {
    src: img.getAttribute('src') || '',
    alt: readProp(block, 'logoAlt', img.getAttribute('alt') || 'Home'),
  };
}

/**
 * Decorates the Wyndham logo block.
 * @param {Element} block logo block element
 */
export default function decorate(block) {
  if (block.querySelector('.wh-logo-link')) return;

  const positional = hasKeyValueRows(block) ? null : readPositionalFields(block);
  const kv = positional || readKeyValueConfig(block, ALIASES);
  const image = positional ? positional.image : readLogoImage(block);
  const homeField = block.querySelector('[data-aue-prop="homeLink"]');
  // A relative href reads back as its link text, so prefer the anchor itself.
  const homeHref = readSettingCell(block, 'homeLink')?.querySelector('a[href]')?.getAttribute('href')?.trim();
  const home = homeField && !positional
    ? readLinkField(homeField)
    : { href: homeHref || kv.homeLink || '/', label: 'Go to homepage' };

  block.replaceChildren();
  block.classList.add('logo');

  const link = document.createElement('a');
  link.className = 'wh-logo-link logo';
  link.href = home.href || '/';
  link.setAttribute('aria-label', kv.logoAlt || home.label || 'Go to homepage');

  if (image?.src) {
    moveInstrumentation(block, link);
    // An SVG has no raster variants, so the optimizer's webp sources would 404.
    if (/\.svg(\?|#|$)/i.test(image.src)) {
      const img = document.createElement('img');
      img.src = image.src;
      img.alt = image.alt || '';
      img.loading = 'eager';
      link.append(img);
    } else {
      link.append(createOptimizedPicture(image.src, image.alt, false, [{ width: '200' }]));
    }
  } else {
    link.textContent = kv.logoAlt || readProp(block, 'logoAlt') || 'Wyndham Grand';
  }

  block.append(link);
}
