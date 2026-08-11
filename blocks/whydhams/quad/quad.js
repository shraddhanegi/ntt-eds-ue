import { createOptimizedPicture } from '../../../scripts/aem.js';
import {
  createButton, getImageFromCell, readLinkField, readSetting,
} from '../../../scripts/whydham/wh-common.js';

function readQuadItems(block) {
  return [...block.children].filter((row) => {
    const key = row.children[0]?.textContent.trim().toLowerCase();
    return key !== 'heading';
  }).map((row) => {
    const cells = [...row.children];
    const imageCell = cells.find((cell) => cell.querySelector('picture, img'));
    const textCells = cells.filter((cell) => cell !== imageCell);

    // Rich copy lives in the cell with markup; a bare cell carries the title.
    const richCell = textCells.find((cell) => cell.querySelector('p, h2, h3, strong'));
    const labelCell = textCells.find((cell) => cell !== richCell);

    const paragraphs = [...(richCell?.querySelectorAll('p') || [])];
    const ctaParagraph = [...paragraphs].reverse().find((p) => p.querySelector('a[href]'));

    return {
      image: getImageFromCell(imageCell),
      title: labelCell?.textContent.trim()
        || richCell?.querySelector('h2, h3, strong')?.textContent.trim()
        || '',
      description: paragraphs
        .filter((p) => p !== ctaParagraph)
        .map((p) => p.textContent.trim())
        .filter(Boolean)
        .join(' '),
      cta: readLinkField(ctaParagraph),
    };
  }).filter((item) => item.title || item.image?.src);
}

/**
 * Decorates the Wyndham quad grid block (Top Reasons).
 * @param {Element} block quad block element
 */
export default function decorate(block) {
  if (block.querySelector('.wh-quad-inner')) return;

  block.classList.add('columns-new');
  const heading = readSetting(block, 'heading')
    || block.querySelector('h2')?.textContent.trim()
    || '';
  const items = readQuadItems(block);

  block.replaceChildren();

  if (heading) {
    const title = document.createElement('h2');
    title.className = 'wh-quad-heading';
    title.textContent = heading;
    block.append(title);
  }

  const inner = document.createElement('div');
  inner.className = 'wrapper wh-quad-inner';

  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'columns-new__item wh-quad-item';

    if (item.image?.src) {
      const figure = document.createElement('figure');
      figure.setAttribute('role', 'none');
      const pic = createOptimizedPicture(item.image.src, item.image.alt || item.title, true, [
        { width: '800' },
      ]);
      figure.append(pic);
      if (item.title) {
        const overlay = document.createElement('h2');
        overlay.className = 'title-image wh-quad-overlay-title';
        overlay.textContent = item.title;
        figure.append(overlay);
      }
      card.append(figure);
    }

    const copy = document.createElement('div');
    copy.className = 'columns-new__text wh-quad-copy';
    if (item.title) {
      const title = document.createElement('div');
      title.className = 'title-columns wh-quad-title';
      title.textContent = item.title;
      copy.append(title);
    }
    if (item.description) {
      const paragraph = document.createElement('p');
      paragraph.textContent = item.description;
      copy.append(paragraph);
    }
    const button = createButton(item.cta.href, item.cta.label, 'btn wh-btn');
    if (button) copy.append(button);
    card.append(copy);
    inner.append(card);
  });

  block.append(inner);
}
