import { createOptimizedPicture } from '../../../scripts/aem.js';
import {
  getImageFromCell, getItemRows, isModelRow, readFieldText,
} from '../../../scripts/whydham/wh-common.js';

function readIconItems(block) {
  return getItemRows(block).map((row) => {
    const cells = [...row.children];

    // Universal Editor emits iconImage | label | link in model field order.
    if (isModelRow(row)) {
      const label = cells[1]?.textContent.trim() || '';
      const image = getImageFromCell(cells[0], label);
      return {
        href: cells[2]?.querySelector('a[href]')?.getAttribute('href') || '',
        label,
        src: image?.src || '',
        alt: image?.alt || label,
      };
    }

    const imageCell = cells.find((cell) => cell.querySelector('picture, img'));
    const textCell = cells.find((cell) => cell !== imageCell && cell.textContent.trim());
    const link = imageCell?.querySelector('a[href]') || textCell?.querySelector('a[href]');
    const img = imageCell?.querySelector('picture img, img');
    return {
      href: link?.getAttribute('href') || '',
      label: textCell?.textContent.trim() || readFieldText(cells[1]),
      src: img?.getAttribute('src') || '',
      alt: img?.getAttribute('alt') || textCell?.textContent.trim() || '',
    };
  }).filter((item) => item.label || item.src);
}

/**
 * Decorates the Wyndham icons benefit strip block.
 * @param {Element} block icons block element
 */
export default function decorate(block) {
  if (block.querySelector('.wh-icons-inner')) return;

  block.classList.add('icons');
  const items = readIconItems(block);

  const inner = document.createElement('div');
  inner.className = 'wh-icons-inner container';

  const list = document.createElement('div');
  list.className = 'icons__items wh-icons-list';

  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'icons__items item wh-icons-item';

    const logoWrap = document.createElement(item.href ? 'a' : 'div');
    logoWrap.className = 'icons__logos wh-icons-logo';
    if (item.href && logoWrap instanceof HTMLAnchorElement) logoWrap.href = item.href;

    if (item.src) {
      const figure = document.createElement('figure');
      figure.setAttribute('role', 'none');
      const pic = createOptimizedPicture(item.src, item.alt, true, [{ width: '120' }]);
      figure.append(pic);
      logoWrap.append(figure);
    }

    const text = document.createElement('div');
    text.className = 'icons__text wh-icons-text';
    text.textContent = item.label;

    card.append(logoWrap, text);
    list.append(card);
  });

  inner.append(list);
  block.replaceChildren(inner);
}
