import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const TITLE_TYPES = ['h2', 'h3'];
const DEFAULT_TITLE_TAG = 'h2';
const IMAGE_WIDTHS = [{ media: '(min-width: 900px)', width: '800' }, { width: '600' }];

function getTitleTag(block) {
  const titleTypeField = block.querySelector('[data-aue-prop="titleType"]');
  const titleType = titleTypeField?.textContent?.trim().toLowerCase();
  return TITLE_TYPES.includes(titleType) ? titleType : DEFAULT_TITLE_TAG;
}

function isExternalUrl(href) {
  try {
    const url = new URL(href, window.location.href);
    return url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function isSameOriginImage(src) {
  try {
    const url = new URL(src, window.location.href);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

function isConfigRow(row) {
  if (!row) return true;
  return Boolean(row.querySelector('[data-aue-prop="link"], [data-aue-prop="image"], [data-aue-prop="description"], [data-aue-prop="descriptionLink"], [data-aue-prop="descriptionLinkText"], [data-aue-prop="imageAlt"], [data-aue-prop="titleType"]'));
}

function getLinkInfo(block) {
  const linkField = block.querySelector('[data-aue-prop="link"]');
  const linkRow = linkField?.closest(':scope > div');
  const anchor = linkRow?.querySelector('a[href]');
  const href = anchor?.getAttribute('href')
    || (linkField?.textContent?.trim().match(/^(https?:\/\/|\/|#)/) ? linkField.textContent.trim() : '');

  if (!href) return null;

  return { href, linkField, anchor };
}

function getTextFromRow(row) {
  const cell = row?.querySelector(':scope > div') || row;
  return cell?.textContent?.trim() || '';
}

function buildTitleLine(text, className, source) {
  const line = document.createElement('span');
  line.className = className;
  line.textContent = text;
  if (source) moveInstrumentation(source, line);
  return line;
}

function buildTitle(block) {
  const titleField = block.querySelector('[data-aue-prop="title"]');
  const subtitleField = block.querySelector('[data-aue-prop="subtitle"]');
  const existingHeading = block.querySelector('h1, h2, h3, h4, h5, h6');

  const titleTag = existingHeading?.tagName.toLowerCase() || getTitleTag(block);
  const heading = document.createElement(titleTag);
  heading.className = 'offer-banner-title';

  const contentRows = [...block.children].filter((row) => {
    if (isConfigRow(row) || row.querySelector('picture, ul')) return false;
    if (row.querySelector('a[href]') && !row.querySelector('h1, h2, h3, h4, h5, h6')) return false;
    return Boolean(getTextFromRow(row));
  });

  const titleText = titleField?.textContent?.trim()
    || existingHeading?.textContent?.trim()
    || contentRows[0]?.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim()
    || getTextFromRow(contentRows[0]);

  let subtitleText = subtitleField?.textContent?.trim();
  if (!subtitleText) {
    const subtitleRow = contentRows.find((row) => row !== contentRows[0] && !row.querySelector('h1, h2, h3, h4, h5, h6'));
    subtitleText = getTextFromRow(subtitleRow);
  }

  if (titleText) {
    const titleSource = titleField || existingHeading?.closest(':scope > div') || contentRows[0];
    heading.append(buildTitleLine(titleText, 'offer-banner-title-line', titleSource));
  }

  if (subtitleText) {
    const subtitleSource = subtitleField?.closest(':scope > div')
      || contentRows.find((row) => row !== contentRows[0]);
    heading.append(buildTitleLine(subtitleText, 'offer-banner-title-line offer-banner-subtitle', subtitleSource));
  }

  if (!heading.children.length) return null;
  return heading;
}

function getBannerPicture(block) {
  const imageField = block.querySelector('[data-aue-prop="image"]');
  const imageRow = imageField?.closest(':scope > div')
    || [...block.children].find((row) => row.querySelector('picture'));

  return imageRow?.querySelector('picture') || block.querySelector('picture');
}

function optimizeBannerImage(picture) {
  const img = picture?.querySelector('img');
  if (!img) return null;

  if (!isSameOriginImage(img.src)) {
    img.setAttribute('loading', 'lazy');
    return picture;
  }

  const optimizedPic = createOptimizedPicture(
    img.src,
    img.alt || '',
    true,
    IMAGE_WIDTHS,
  );
  moveInstrumentation(img, optimizedPic.querySelector('img'));
  return optimizedPic;
}

function buildMedia(picture) {
  if (!picture) return null;

  const media = document.createElement('div');
  media.className = 'offer-banner-media';
  moveInstrumentation(picture.closest('li, div') || picture, media);
  media.append(optimizeBannerImage(picture));
  return media;
}

function buildContent(title) {
  const content = document.createElement('div');
  content.className = 'offer-banner-content';

  if (title) content.append(title);

  return content;
}

function buildInner(linkInfo, title, media) {
  const tagName = linkInfo?.href ? 'a' : 'article';
  const inner = document.createElement(tagName);
  inner.className = 'offer-banner-inner';

  if (linkInfo?.href) {
    inner.href = linkInfo.href;
    inner.setAttribute('aria-label', title?.textContent?.trim() || 'Offer banner');
    if (isExternalUrl(linkInfo.href)) {
      inner.target = '_blank';
      inner.rel = 'noopener noreferrer';
    }
    if (linkInfo.linkField) moveInstrumentation(linkInfo.linkField, inner);
    else if (linkInfo.anchor) moveInstrumentation(linkInfo.anchor, inner);
  }

  inner.append(buildContent(title));
  if (media) inner.append(media);
  return inner;
}

function getDescriptionRow(block) {
  const descriptionField = block.querySelector('[data-aue-prop="description"]');
  if (descriptionField) return descriptionField.closest(':scope > div');

  const bannerLinkRow = block.querySelector('[data-aue-prop="link"]')?.closest(':scope > div')
    || [...block.children].find((row) => {
      const anchor = row.querySelector('a[href]');
      return anchor && !row.querySelector('picture, h1, h2, h3, h4, h5, h6');
    });

  const rows = [...block.children];
  const bannerLinkIndex = bannerLinkRow ? rows.indexOf(bannerLinkRow) : -1;
  if (bannerLinkIndex >= 0 && rows[bannerLinkIndex + 1]) {
    return rows[bannerLinkIndex + 1];
  }

  const paragraphRows = rows.filter((row) => row.querySelector('p') && !row.querySelector('picture, h1, h2, h3, h4, h5, h6'));
  return paragraphRows[paragraphRows.length - 1];
}

function getDescriptionLinkRow(block) {
  const linkField = block.querySelector('[data-aue-prop="descriptionLink"]');
  if (linkField) return linkField.closest(':scope > div');

  const descriptionRow = getDescriptionRow(block);
  const rows = [...block.children];
  const descriptionIndex = descriptionRow ? rows.indexOf(descriptionRow) : -1;
  if (descriptionIndex >= 0 && rows[descriptionIndex + 1]) {
    const nextRow = rows[descriptionIndex + 1];
    if (nextRow.querySelector('a[href]')) return nextRow;
  }

  return null;
}

function buildDescriptionLink(block) {
  const linkTextField = block.querySelector('[data-aue-prop="descriptionLinkText"]');
  const linkField = block.querySelector('[data-aue-prop="descriptionLink"]');
  const linkRow = getDescriptionLinkRow(block);
  const anchor = linkRow?.querySelector('a[href]');

  const href = anchor?.getAttribute('href')
    || linkField?.querySelector('a[href]')?.getAttribute('href')
    || (linkField?.textContent?.trim().match(/^(https?:\/\/|\/|#)/) ? linkField.textContent.trim() : '');

  if (!href) return null;

  const label = linkTextField?.textContent?.trim()
    || anchor?.textContent?.trim()
    || 'Click here to go to amazon.in';

  const link = document.createElement('a');
  link.className = 'offer-banner-description-link';
  link.href = href;
  link.textContent = label;

  if (anchor) moveInstrumentation(anchor, link);
  else if (linkField) moveInstrumentation(linkField, link);
  else if (linkTextField) moveInstrumentation(linkTextField, link);

  if (isExternalUrl(href)) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }

  return link;
}

function buildDescriptionCard(block) {
  const descriptionField = block.querySelector('[data-aue-prop="description"]');
  const descriptionRow = getDescriptionRow(block);
  const subtitleField = block.querySelector('[data-aue-prop="subtitle"]');
  const subtitleText = subtitleField?.textContent?.trim()
    || getTextFromRow([...block.children].find((row) => row.querySelector('p') && !row.querySelector('picture, h1, h2, h3, h4, h5, h6')));

  let descriptionText = descriptionField?.textContent?.trim()
    || descriptionRow?.querySelector('p')?.textContent?.trim()
    || getTextFromRow(descriptionRow);

  if (descriptionText === subtitleText) {
    const rows = [...block.children].filter((row) => row.querySelector('p') && !row.querySelector('picture, h1, h2, h3, h4, h5, h6'));
    descriptionText = rows[rows.length - 1]?.querySelector('p')?.textContent?.trim() || '';
  }

  const descriptionLink = buildDescriptionLink(block);

  if (!descriptionText && !descriptionLink) return null;

  const card = document.createElement('div');
  card.className = 'offer-banner-description-card';

  if (descriptionText) {
    const description = document.createElement('p');
    description.className = 'offer-banner-description';
    description.textContent = descriptionText;
    if (descriptionField) moveInstrumentation(descriptionField, description);
    else if (descriptionRow) moveInstrumentation(descriptionRow.querySelector('p') || descriptionRow, description);
    card.append(description);
  }

  if (descriptionLink) card.append(descriptionLink);

  return card;
}

/**
 * loads and decorates the offer banner block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  if (block.querySelector('.offer-banner-layout')) return;

  const linkInfo = getLinkInfo(block);
  const title = buildTitle(block);
  const media = buildMedia(getBannerPicture(block));
  const inner = buildInner(linkInfo, title, media);
  const descriptionCard = buildDescriptionCard(block);

  const layout = document.createElement('div');
  layout.className = 'offer-banner-layout';
  layout.append(inner);
  if (descriptionCard) layout.append(descriptionCard);

  moveInstrumentation(block, layout);
  block.replaceChildren(layout);
  block.setAttribute('role', 'region');
  block.setAttribute('aria-label', title?.textContent?.trim() || 'Offer banner');
}
