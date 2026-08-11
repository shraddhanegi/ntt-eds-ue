import { createOptimizedPicture } from '../../../scripts/aem.js';
import { moveInstrumentation } from '../../../scripts/scripts.js';
import { readKeyValueConfig, readProp, readLinkField } from '../../../scripts/whydham/wh-common.js';

const ALIASES = {
  logoalt: 'logoAlt',
  homelink: 'homeLink',
};

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

  const kv = readKeyValueConfig(block, ALIASES);
  const image = readLogoImage(block);
  const homeField = block.querySelector('[data-aue-prop="homeLink"]');
  const home = homeField
    ? readLinkField(homeField)
    : { href: kv.homeLink || '/', label: 'Go to homepage' };

  block.replaceChildren();
  block.classList.add('logo');

  const link = document.createElement('a');
  link.className = 'wh-logo-link logo';
  link.href = home.href || '/';
  link.setAttribute('aria-label', kv.logoAlt || home.label || 'Go to homepage');

  if (image?.src) {
    const pic = createOptimizedPicture(image.src, image.alt, false, [{ width: '200' }]);
    moveInstrumentation(block, link);
    link.append(pic);
  } else {
    link.textContent = readProp(block, 'logoAlt') || 'Wyndham Grand';
  }

  block.append(link);
}
