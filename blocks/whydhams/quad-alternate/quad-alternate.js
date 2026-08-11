import { createOptimizedPicture } from '../../../scripts/aem.js';
import {
  createButton, getImageFromCell, getItemRows, isModelRow, readLinkField, readSetting,
  readSplitLink,
} from '../../../scripts/whydham/wh-common.js';

function readItems(block) {
  return getItemRows(block).filter((row) => {
    const key = row.children[0]?.textContent.trim().toLowerCase();
    return key !== 'heading';
  }).map((row, index) => {
    const cells = [...row.children];

    // Universal Editor emits imageAlignment | image | title | description | ctaText | ctaLink.
    if (isModelRow(row)) {
      const title = cells[2]?.textContent.trim() || '';
      const alignment = cells[0]?.textContent.trim().toLowerCase();
      return {
        image: getImageFromCell(cells[1], title),
        title,
        description: cells[3]?.textContent.trim() || '',
        cta: readSplitLink(cells[4], cells[5]),
        alignment: alignment === 'right' ? 'right' : 'left',
      };
    }

    const imageCell = cells.find((cell) => cell.querySelector('picture, img'));
    const textCells = cells.filter((cell) => cell !== imageCell);

    // Rich copy lives in the cell with markup; a bare left/right cell sets alignment.
    const richCell = textCells.find((cell) => cell.querySelector('p, h2, h3, strong'));
    const alignmentCell = textCells.find((cell) => cell !== richCell
      && /^(left|right)$/i.test(cell.textContent.trim()));
    const labelCell = textCells.find((cell) => cell !== richCell && cell !== alignmentCell);

    const paragraphs = [...(richCell?.querySelectorAll('p') || [])];
    const ctaParagraph = [...paragraphs].reverse().find((p) => p.querySelector('a[href]'));
    const alignment = alignmentCell?.textContent.trim().toLowerCase()
      || (index % 2 === 0 ? 'left' : 'right');

    return {
      image: getImageFromCell(imageCell),
      title: richCell?.querySelector('h2, h3, strong')?.textContent.trim()
        || labelCell?.textContent.trim()
        || '',
      description: paragraphs
        .filter((p) => p !== ctaParagraph)
        .map((p) => p.textContent.trim())
        .filter(Boolean)
        .join(' '),
      cta: readLinkField(ctaParagraph),
      alignment: alignment === 'right' ? 'right' : 'left',
    };
  }).filter((item) => item.title || item.image?.src);
}

/**
 * Decorates the Wyndham alternating quad block.
 * @param {Element} block quad alternate block element
 */
export default function decorate(block) {
  if (block.querySelector('.wh-quad-alternate-inner')) return;

  block.classList.add('columns-altern');
  const heading = readSetting(block, 'heading')
    || block.querySelector('h2')?.textContent.trim()
    || '';
  const items = readItems(block);

  block.replaceChildren();

  if (heading) {
    const title = document.createElement('h2');
    title.className = 'wh-quad-alternate-heading';
    title.textContent = heading;
    block.append(title);
  }

  const inner = document.createElement('div');
  inner.className = 'wrapper wh-quad-alternate-inner';

  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = `columns-altern__item wh-quad-alternate-item wh-align-${item.alignment}`;

    const media = document.createElement('div');
    media.className = 'wh-quad-alternate-media';
    if (item.image?.src) {
      const figure = document.createElement('figure');
      const pic = createOptimizedPicture(item.image.src, item.image.alt || item.title, true, [{ width: '900' }]);
      figure.append(pic);
      media.append(figure);
    }

    const copy = document.createElement('div');
    copy.className = 'wh-quad-alternate-copy';
    if (item.title) {
      const title = document.createElement('h3');
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

    if (item.alignment === 'right') card.append(copy, media);
    else card.append(media, copy);

    inner.append(card);
  });

  block.append(inner);
}
