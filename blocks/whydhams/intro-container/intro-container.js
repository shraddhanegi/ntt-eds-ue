import { createOptimizedPicture } from '../../../scripts/aem.js';
import {
  createButton, getImageFromCell, readLinkField, readSetting,
} from '../../../scripts/whydham/wh-common.js';

function readAlignment(block) {
  const value = readSetting(block, 'imageAlignment', 'left').toLowerCase();
  return value === 'right' ? 'right' : 'left';
}

/**
 * Decorates the Wyndham intro container block.
 * @param {Element} block intro block element
 */
export default function decorate(block) {
  if (block.querySelector('.wh-intro-container-inner')) return;

  block.classList.add('intro-container', 'intro-content', 'bg-white');
  const alignment = readAlignment(block);

  const imageCell = block.querySelector('[data-wh-image]')
    || [...block.children].find((row) => row.querySelector('picture, img'));
  const copyCell = block.querySelector('[data-wh-copy]')
    || [...block.children].find((row) => row.querySelector('h1, h2, p, a'));

  const imageData = getImageFromCell(imageCell?.querySelector('div') || imageCell);
  const headingText = copyCell?.querySelector('h1, h2')?.textContent?.trim()
    || readSetting(block, 'heading');

  // The last paragraph holding a link is the call to action; the rest is body copy.
  const paragraphs = [...(copyCell?.querySelectorAll('p') || [])];
  const ctaParagraph = [...paragraphs].reverse().find((p) => p.querySelector('a[href]'));
  const descriptionHtml = paragraphs
    .filter((p) => p !== ctaParagraph)
    .map((p) => `<p>${p.innerHTML}</p>`)
    .join('') || readSetting(block, 'description');
  const cta = readLinkField(ctaParagraph);

  const inner = document.createElement('div');
  inner.className = 'wh-intro-container-inner';

  const media = document.createElement('div');
  media.className = `block-img block-img_half wh-intro-media wh-intro-media-${alignment}`;

  if (imageData?.src) {
    const pic = createOptimizedPicture(imageData.src, imageData.alt || headingText, true, [
      { media: '(min-width: 900px)', width: '800' },
      { width: '600' },
    ]);
    media.append(pic);
  }

  const copy = document.createElement('div');
  copy.className = `block-copy block-copy_half wh-intro-copy wh-intro-copy-${alignment === 'left' ? 'right' : 'left'}`;

  if (headingText) {
    const heading = document.createElement('h1');
    heading.className = 'heading-border-bottom wh-intro-heading';
    const words = headingText.split(/\s+/);
    if (words.length > 2) {
      const kicker = document.createElement('span');
      kicker.textContent = words.slice(0, 2).join(' ');
      heading.append(kicker, document.createTextNode(` ${words.slice(2).join(' ')}`));
    } else {
      heading.textContent = headingText;
    }
    copy.append(heading);
  }

  if (descriptionHtml) {
    const description = document.createElement('div');
    description.className = 'wh-intro-description';
    description.innerHTML = descriptionHtml;
    copy.append(description);
  }

  const button = createButton(cta.href, cta.label, 'btn wh-btn');
  if (button) copy.append(button);

  if (alignment === 'right') inner.append(copy, media);
  else inner.append(media, copy);

  block.replaceChildren(inner);
}
