import { getItemRows, isModelRow, readSplitLink } from '../../../scripts/whydham/wh-common.js';

function readCrumbs(block) {
  return getItemRows(block).map((row) => {
    const cells = [...row.children];

    // Universal Editor emits label | link.
    if (isModelRow(row)) return readSplitLink(cells[0], cells[1]);

    const label = cells[0]?.textContent.trim() || '';
    const href = cells[0]?.querySelector('a[href]')?.getAttribute('href')?.trim()
      || cells[1]?.querySelector('a[href]')?.getAttribute('href')?.trim()
      || cells[1]?.textContent.trim()
      || '';
    return { label, href };
  }).filter((crumb) => crumb.label);
}

/**
 * Decorates the Wyndham breadcrumb trail. The final crumb is the current page
 * and is rendered as plain text regardless of whether a link was authored.
 * @param {Element} block breadcrumb block element
 */
export default function decorate(block) {
  const crumbs = readCrumbs(block);
  block.replaceChildren();
  if (!crumbs.length) return;

  const nav = document.createElement('nav');
  nav.className = 'wh-breadcrumb-nav';
  nav.setAttribute('aria-label', 'Breadcrumb');

  const list = document.createElement('ol');
  list.className = 'wh-breadcrumb-list';

  crumbs.forEach((crumb, index) => {
    const item = document.createElement('li');
    item.className = 'wh-breadcrumb-item';
    const isLast = index === crumbs.length - 1;

    if (crumb.href && !isLast) {
      const link = document.createElement('a');
      link.href = crumb.href;
      link.textContent = crumb.label;
      item.append(link);
    } else {
      const current = document.createElement('span');
      current.textContent = crumb.label;
      if (isLast) current.setAttribute('aria-current', 'page');
      item.append(current);
    }

    list.append(item);
  });

  nav.append(list);
  block.append(nav);
}
