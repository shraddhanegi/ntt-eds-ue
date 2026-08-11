import { decorateSignInLinks, resolveSignInUrl } from '../../../scripts/whydham/wh-auth.js';
import { WH_DEFAULTS } from '../../../scripts/whydham/wh-config.js';
import { createButton, readFieldText, readLinkField } from '../../../scripts/whydham/wh-common.js';
import { loadWhBlock } from '../../../scripts/whydham/wh-block-loader.js';

function buildNavList(items) {
  const nav = document.createElement('nav');
  nav.className = 'wh-navigation navigation';
  nav.id = 'primary-nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Primary Menu');

  const list = document.createElement('ul');
  list.className = 'wh-navigation-list privary-navigation__list';

  items.forEach(({ label, href, children = [] }) => {
    const item = document.createElement('li');
    item.className = 'wh-navigation-item privary-navigation__item';

    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    if (children.length) {
      link.setAttribute('aria-haspopup', 'menu');
      link.setAttribute('aria-expanded', 'false');
    }
    item.append(link);

    if (children.length) {
      const sub = document.createElement('ul');
      sub.className = 'wh-navigation-submenu privary-navigation__submenu';
      children.forEach((child) => {
        const subItem = document.createElement('li');
        subItem.className = 'wh-navigation-item privary-navigation__item';
        const subLink = document.createElement('a');
        subLink.href = child.href;
        subLink.textContent = child.label;
        subItem.append(subLink);
        sub.append(subItem);
      });
      item.append(sub);
    }

    list.append(item);
  });

  nav.append(list);
  return nav;
}

function readNavItems(block) {
  const items = [];
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (cells.length < 2) return;
    const label = cells[0].textContent.trim();
    const link = readLinkField(cells[1]);
    if (!label || !link.href) return;
    items.push({ label, href: link.href });
  });
  return items;
}

function readUtilityLinks(block) {
  const tools = block.querySelector('[data-wh-tools]') || block;
  const links = [...tools.querySelectorAll('a[href]')].map((anchor) => ({
    href: anchor.getAttribute('href') || '',
    label: anchor.textContent.trim(),
    signIn: anchor.hasAttribute('data-wh-signin'),
  }));
  return links.filter((entry) => entry.href && entry.label);
}

/**
 * Decorates the Wyndham header block (logo + navigation only).
 * @param {Element} block header block element
 */
export default async function decorate(block) {
  if (block.querySelector('.wh-header-inner')) return;

  const signInUrl = readFieldText(block.querySelector('[data-aue-prop="signInUrl"]'))
    || WH_DEFAULTS.signInUrl;
  const bookNowUrl = readFieldText(block.querySelector('[data-aue-prop="bookNowUrl"]'))
    || WH_DEFAULTS.bookNowUrl;

  const logoBlock = block.querySelector('.wh-logo') || block.querySelector('.logo');
  const navItems = readNavItems(block.querySelector('[data-wh-nav-items]') || block);
  const utilityLinks = readUtilityLinks(block);

  const inner = document.createElement('div');
  inner.className = 'wh-header-inner';

  const logoSlot = document.createElement('div');
  logoSlot.className = 'wh-header-logo logo';
  if (logoBlock) {
    await loadWhBlock(logoBlock);
    logoSlot.append(logoBlock);
  }

  const navSlot = document.createElement('div');
  navSlot.className = 'wh-header-navigation navigation';
  const navInner = document.createElement('div');
  navInner.className = 'navigation-intern wh-navigation-intern';

  if (navItems.length) navInner.append(buildNavList(navItems));

  const utilities = document.createElement('div');
  utilities.className = 'wh-header-tools';
  utilityLinks.forEach(({ href, label, signIn }) => {
    const link = document.createElement('a');
    link.href = signIn ? resolveSignInUrl(signInUrl) : href;
    link.textContent = label;
    if (signIn) link.setAttribute('data-wh-signin', 'true');
    utilities.append(link);
  });

  const bookNow = createButton(bookNowUrl, 'Book Now', 'wh-btn wh-btn-primary');
  if (bookNow) utilities.append(bookNow);

  navInner.append(utilities);
  navSlot.append(navInner);
  inner.append(logoSlot, navSlot);

  block.replaceChildren(inner);
  block.classList.add('wh-header');
  decorateSignInLinks(block, signInUrl);
}
