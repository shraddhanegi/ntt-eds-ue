import { decorateSignInLinks, resolveSignInUrl } from '../../../scripts/whydham/wh-auth.js';
import { WH_DEFAULTS } from '../../../scripts/whydham/wh-config.js';
import {
  createButton, getImageFromCell, normalizeConfigKey, readLinkField, readSetting,
} from '../../../scripts/whydham/wh-common.js';
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

/** Setting rows share the block with nav rows, so they must not become nav links. */
const SETTING_KEYS = new Set(['signInUrl', 'bookNowUrl', 'phone'].map(normalizeConfigKey));

const LOGO_SELECTOR = '.wh-logo, .logo, [data-aue-component="wh-logo"]';

function isSettingRow(row) {
  const cells = [...row.children];
  return cells.length >= 2 && SETTING_KEYS.has(normalizeConfigKey(cells[0].textContent || ''));
}

/**
 * Locates the nested logo block. The published pipeline flattens nested blocks
 * into an unclassed row, so fall back to the row whose first cell is an image.
 * @param {Element} block header block element
 * @returns {Element|null} the logo element, or null when none was authored
 */
function findLogoRow(block) {
  const explicit = block.querySelector(LOGO_SELECTOR);
  if (explicit) return explicit;
  return [...block.children].find((row) => {
    if (isSettingRow(row)) return false;
    return [...row.children].length >= 2 && Boolean(getImageFromCell(row.children[0]));
  }) || null;
}

function readNavItems(block, logoRow) {
  const items = [];
  [...block.children].forEach((row) => {
    if (row === logoRow || row.matches(LOGO_SELECTOR) || isSettingRow(row)) return;
    const cells = [...row.children];
    if (cells.length < 2) return;
    const label = cells[0].textContent.trim();
    // An image in the label cell means a logo-like row rather than a nav entry.
    if (!label || getImageFromCell(cells[0])) return;
    const link = readLinkField(cells[1]);
    if (!link.href) return;
    items.push({ label, href: link.href });
  });
  return items;
}

/**
 * Reads utility links from an explicit tools container. Only drafts author one,
 * so an absent container yields nothing rather than every anchor in the block.
 * @param {Element} block header block element
 * @returns {object[]} utility link data
 */
function readUtilityLinks(block) {
  const tools = block.querySelector('[data-wh-tools]');
  if (!tools) return [];
  return [...tools.querySelectorAll('a[href]')].map((anchor) => ({
    href: anchor.getAttribute('href') || '',
    label: anchor.textContent.trim(),
    signIn: anchor.hasAttribute('data-wh-signin'),
  })).filter((entry) => entry.href && entry.label);
}

/**
 * Decorates the Wyndham header block (logo + navigation only).
 * @param {Element} block header block element
 */
export default async function decorate(block) {
  if (block.querySelector('.wh-header-inner')) return;

  const signInUrl = readSetting(block, 'signInUrl') || WH_DEFAULTS.signInUrl;
  const bookNowUrl = readSetting(block, 'bookNowUrl') || WH_DEFAULTS.bookNowUrl;
  const phone = readSetting(block, 'phone', WH_DEFAULTS.reservationsPhone);

  const logoBlock = findLogoRow(block);
  const navItems = readNavItems(block.querySelector('[data-wh-nav-items]') || block, logoBlock);
  const utilityLinks = readUtilityLinks(block);

  // Universal Editor and the published pipeline carry settings instead of a
  // tools container, so build the utility links from them.
  if (!utilityLinks.length) {
    utilityLinks.push({ href: signInUrl, label: 'Sign In - Join', signIn: true });
    if (phone) utilityLinks.push({ href: `tel:${phone.replace(/[^\d+]/g, '')}`, label: phone });
  }

  const inner = document.createElement('div');
  inner.className = 'wh-header-inner';

  const logoSlot = document.createElement('div');
  logoSlot.className = 'wh-header-logo logo';
  if (logoBlock) {
    // Nested blocks carry no block class, so claim it before handing it to the loader.
    logoBlock.classList.add('wh-logo');
    logoBlock.dataset.whBlock = 'wh-logo';
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
