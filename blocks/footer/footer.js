import { loadFragment, resolveFragmentPath } from '../fragment/fragment.js';
import { getPageMetadataValue, getThemeFragmentName } from '../../scripts/theme-config.js';

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const footerMeta = getPageMetadataValue('footer');
  const footerPath = await resolveFragmentPath(footerMeta, getThemeFragmentName('footer'));
  const fragment = await loadFragment(footerPath);

  block.textContent = '';

  if (!fragment) {
    return;
  }

  const footer = document.createElement('div');
  footer.className = 'footer';
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);
  block.append(footer);
}
