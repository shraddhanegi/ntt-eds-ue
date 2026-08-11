import { createOptimizedPicture } from '../../../scripts/aem.js';
import {
  getImageFromCell, readSetting, readSettingCell,
} from '../../../scripts/whydham/wh-common.js';

const MAX_STARS = 5;

function splitList(value) {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function buildStars(rating) {
  const value = Number.parseFloat(rating);
  if (!Number.isFinite(value) || value <= 0) return null;

  const wrapper = document.createElement('p');
  wrapper.className = 'wh-property-summary-rating';

  const track = document.createElement('span');
  track.className = 'wh-property-summary-stars';
  track.setAttribute('role', 'img');
  track.setAttribute('aria-label', `${value} out of ${MAX_STARS} stars`);

  // A clipped overlay renders half stars without needing extra glyph assets.
  const fill = document.createElement('span');
  fill.className = 'wh-property-summary-stars-fill';
  fill.style.width = `${Math.min(value / MAX_STARS, 1) * 100}%`;
  track.append(fill);
  wrapper.append(track);
  return wrapper;
}

/**
 * Decorates the Wyndham property summary shown above the room list.
 * @param {Element} block property summary block element
 */
export default function decorate(block) {
  const name = readSetting(block, 'propertyName');
  const rating = readSetting(block, 'rating');
  const address = readSetting(block, 'address');
  const checkInTime = readSetting(block, 'checkInTime');
  const checkOutTime = readSetting(block, 'checkOutTime');
  const amenities = splitList(readSetting(block, 'amenities'));
  const image = getImageFromCell(readSettingCell(block, 'image'), name);

  block.replaceChildren();

  const inner = document.createElement('div');
  inner.className = 'wh-property-summary-inner';

  if (image?.src) {
    const figure = document.createElement('figure');
    figure.className = 'wh-property-summary-media';
    figure.append(createOptimizedPicture(image.src, image.alt || name, true, [{ width: '900' }]));
    inner.append(figure);
  }

  const body = document.createElement('div');
  body.className = 'wh-property-summary-body';

  if (name) {
    const title = document.createElement('h1');
    title.className = 'wh-property-summary-title';
    title.textContent = name;
    body.append(title);
  }

  const stars = buildStars(rating);
  if (stars) body.append(stars);

  if (address) {
    const line = document.createElement('p');
    line.className = 'wh-property-summary-address';
    line.textContent = address;
    body.append(line);
  }

  if (checkInTime || checkOutTime) {
    const times = document.createElement('dl');
    times.className = 'wh-property-summary-times';
    [['Check In', checkInTime], ['Checkout', checkOutTime]].forEach(([label, value]) => {
      if (!value) return;
      const term = document.createElement('dt');
      term.textContent = label;
      const detail = document.createElement('dd');
      detail.textContent = value;
      times.append(term, detail);
    });
    body.append(times);
  }

  if (amenities.length) {
    const heading = document.createElement('h2');
    heading.className = 'wh-property-summary-amenities-heading';
    heading.textContent = 'Featured Amenities';
    const list = document.createElement('ul');
    list.className = 'wh-property-summary-amenities';
    amenities.forEach((amenity) => {
      const item = document.createElement('li');
      item.textContent = amenity;
      list.append(item);
    });
    body.append(heading, list);
  }

  inner.append(body);
  block.append(inner);
}
