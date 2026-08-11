import { createOptimizedPicture } from '../../../scripts/aem.js';
import { readSetting } from '../../../scripts/whydham/wh-common.js';

/** Splits the headline so the first half renders as a lighter kicker line. */
function parseHeadline(text) {
  const value = String(text || '').trim();
  if (!value) return { lead: '', rest: '' };
  const parts = value.split(/\s+/);
  if (parts.length <= 2) return { lead: value, rest: '' };
  const split = Math.ceil(parts.length / 2);
  return { lead: parts.slice(0, split).join(' '), rest: parts.slice(split).join(' ') };
}

/**
 * Decorates the Wyndham hero container block.
 * @param {Element} block hero block element
 */
export default function decorate(block) {
  if (block.querySelector('.wh-hero-container-inner')) return;

  block.classList.add('hero-container', 'top-content');

  const videoUrl = readSetting(block, 'videoUrl')
    || block.querySelector('a[href$=".mp4"]')?.getAttribute('href')
    || '';
  const posterCell = block.querySelector('picture, img')?.closest('div');
  const posterImg = posterCell?.querySelector('picture img, img');
  const headlineText = readSetting(block, 'headline')
    || block.querySelector('h1, h2')?.textContent
    || '';

  const inner = document.createElement('div');
  inner.className = 'wh-hero-container-inner';

  const videoWrap = document.createElement('div');
  videoWrap.className = 'header-video wh-header-video';

  if (videoUrl) {
    const video = document.createElement('video');
    video.id = 'header-video';
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('title', readSetting(block, 'videoTitle', 'Hero video'));
    if (posterImg?.src) video.poster = posterImg.src;

    const source = document.createElement('source');
    source.src = videoUrl;
    source.type = 'video/mp4';
    video.append(source);
    videoWrap.append(video);
  } else if (posterImg?.src) {
    const pic = createOptimizedPicture(
      posterImg.src,
      posterImg.alt || headlineText,
      true,
      [{ width: '1600' }],
    );
    videoWrap.append(pic);
  }

  const { lead, rest } = parseHeadline(headlineText);
  const headline = document.createElement('div');
  headline.className = 'headline wh-headline heading-border-bottom heading-border-bottom_white';
  if (lead) {
    const span = document.createElement('span');
    span.textContent = lead;
    headline.append(span);
  }
  if (rest) headline.append(document.createTextNode(` ${rest}`));

  inner.append(videoWrap, headline);
  block.replaceChildren(inner);
}
