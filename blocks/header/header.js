import { loadCSS } from '../../scripts/aem.js';
import { loadFragment, resolveFragmentPath } from '../fragment/fragment.js';
import { getPageMetadataValue, getThemeFragmentName } from '../../scripts/theme-config.js';

/**
 * Mount decorated navigation markup inside the header block.
 * @param {Element} block Header block element
 * @param {Element} fragment Loaded navigation fragment
 */
async function mountNavigation(block, fragment) {
  const decoratedNav = fragment.querySelector('nav#nav, .navigation.block nav, .navigation nav');

  await loadCSS(`${window.hlx.codeBasePath}/blocks/navigation/navigation.css`);

  block.textContent = '';
  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';

  if (decoratedNav) {
    navWrapper.append(decoratedNav);
    block.append(navWrapper);
    return;
  }

  // Legacy fragment format: three divs (brand, sections, tools)
  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.className = 'navigation';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  navWrapper.append(nav);
  block.append(navWrapper);
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const navMeta = getPageMetadataValue('nav');
  const navPath = await resolveFragmentPath(navMeta, getThemeFragmentName('nav'));
  const fragment = await loadFragment(navPath);

  if (!fragment) {
    block.textContent = '';
    return;
  }

  await mountNavigation(block, fragment);
}
