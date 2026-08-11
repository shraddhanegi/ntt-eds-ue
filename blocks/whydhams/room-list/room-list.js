import { createOptimizedPicture } from '../../../scripts/aem.js';
import {
  getImageFromCell, getItemRows, readSetting, readSplitLink,
} from '../../../scripts/whydham/wh-common.js';

function splitList(value) {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

/**
 * Reads room cards. Cells arrive in model field order in both Universal Editor
 * and the drafts, so a single positional reader serves both.
 * @param {Element} block room list block element
 * @returns {object[]} room data
 */
function readRooms(block) {
  return getItemRows(block).filter((row) => {
    const key = row.children[0]?.textContent.trim().toLowerCase();
    return key !== 'heading';
  }).map((row) => {
    const cells = [...row.children];
    const name = cells[1]?.textContent.trim() || '';
    return {
      image: getImageFromCell(cells[0], name),
      name,
      description: cells[2]?.textContent.trim() || '',
      features: splitList(cells[3]?.textContent.trim() || ''),
      rate: cells[4]?.textContent.trim() || '',
      rateNote: cells[5]?.textContent.trim() || '',
      points: cells[6]?.textContent.trim() || '',
      roomsLeft: cells[7]?.textContent.trim() || '',
      book: readSplitLink(cells[8], cells[9]),
    };
  }).filter((room) => room.name);
}

function buildPrice(room) {
  const price = document.createElement('div');
  price.className = 'wh-room-list-price';

  if (room.rate) {
    const rate = document.createElement('p');
    rate.className = 'wh-room-list-rate';
    const amount = document.createElement('span');
    amount.className = 'wh-room-list-amount';
    amount.textContent = room.rate;
    rate.append(amount);
    price.append(rate);
  }

  if (room.rateNote) {
    const note = document.createElement('p');
    note.className = 'wh-room-list-rate-note';
    note.textContent = room.rateNote;
    price.append(note);
  }

  if (room.points) {
    const points = document.createElement('p');
    points.className = 'wh-room-list-points';
    points.textContent = `or ${room.points} pts/night`;
    price.append(points);
  }

  const label = room.book.label || 'Book';
  if (room.book.href) {
    const book = document.createElement('a');
    book.className = 'wh-btn wh-room-list-book';
    book.href = room.book.href;
    book.target = '_blank';
    book.rel = 'noopener';
    book.textContent = label;
    book.setAttribute('aria-label', `${label} ${room.name}`);
    price.append(book);
  }

  return price;
}

/**
 * Decorates the Wyndham room list shown on the Rooms & Rates page.
 * @param {Element} block room list block element
 */
export default function decorate(block) {
  if (block.querySelector('.wh-room-list-inner')) return;

  const heading = readSetting(block, 'heading')
    || block.querySelector('h2')?.textContent.trim()
    || '';
  const rooms = readRooms(block);

  block.replaceChildren();

  if (heading) {
    const title = document.createElement('h2');
    title.className = 'wh-room-list-heading wh-accent-underline';
    title.textContent = heading;
    block.append(title);
  }

  const inner = document.createElement('div');
  inner.className = 'wh-room-list-inner';

  rooms.forEach((room) => {
    const card = document.createElement('article');
    card.className = 'wh-room-list-item';

    if (room.image?.src) {
      const figure = document.createElement('figure');
      figure.className = 'wh-room-list-media';
      figure.append(createOptimizedPicture(room.image.src, room.image.alt || room.name, false, [
        { width: '750' },
      ]));
      card.append(figure);
    }

    const body = document.createElement('div');
    body.className = 'wh-room-list-body';

    const name = document.createElement('h3');
    name.className = 'wh-room-list-name';
    name.textContent = room.name;
    body.append(name);

    if (room.roomsLeft) {
      const left = document.createElement('p');
      left.className = 'wh-room-list-left';
      const count = Number.parseInt(room.roomsLeft, 10);
      left.textContent = count === 1 ? 'Only 1 room left!' : `Only ${room.roomsLeft} rooms left!`;
      body.append(left);
    }

    if (room.description) {
      const description = document.createElement('p');
      description.className = 'wh-room-list-description';
      description.textContent = room.description;
      body.append(description);
    }

    if (room.features.length) {
      const list = document.createElement('ul');
      list.className = 'wh-room-list-features';
      room.features.forEach((feature) => {
        const item = document.createElement('li');
        item.textContent = feature;
        list.append(item);
      });
      body.append(list);
    }

    card.append(body, buildPrice(room));
    inner.append(card);
  });

  if (!rooms.length) {
    const empty = document.createElement('p');
    empty.className = 'wh-room-list-empty';
    empty.textContent = 'No rooms were found that match your criteria. Please revise your search.';
    inner.append(empty);
  }

  block.append(inner);
}
