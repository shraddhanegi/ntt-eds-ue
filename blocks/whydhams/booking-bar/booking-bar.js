import { readSetting } from '../../../scripts/whydham/wh-common.js';

/** Booking engine date format, for example 8/11/2026. */
function toEngineDate(value) {
  const [year, month, day] = (value || '').split('-');
  if (!year || !month || !day) return '';
  return `${Number(month)}/${Number(day)}/${Number(year)}`;
}

/** Converts a booking engine date back to the value an input[type=date] wants. */
function toInputDate(value) {
  const parts = (value || '').split('/');
  if (parts.length !== 3) return '';
  const [month, day, year] = parts.map(Number);
  if (!month || !day || !year) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function createField(label, control) {
  const field = document.createElement('div');
  field.className = 'wh-booking-bar-field';
  const caption = document.createElement('label');
  caption.className = 'wh-booking-bar-label';
  caption.setAttribute('for', control.id);
  caption.textContent = label;
  field.append(caption, control);
  return field;
}

function createSelect(id, values, selected) {
  const select = document.createElement('select');
  select.className = 'wh-booking-bar-control';
  select.id = id;
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = String(value);
    if (String(value) === String(selected)) option.selected = true;
    select.append(option);
  });
  return select;
}

function createDate(id, value) {
  const input = document.createElement('input');
  input.className = 'wh-booking-bar-control';
  input.type = 'date';
  input.id = id;
  if (value) input.value = value;
  return input;
}

function range(from, to) {
  return Array.from({ length: to - from + 1 }, (unused, index) => from + index);
}

/**
 * Decorates the Wyndham booking bar. The authored URL supplies the booking
 * engine and its property parameters; the form only overrides the stay details.
 * @param {Element} block booking bar block element
 */
export default function decorate(block) {
  const bookingUrl = readSetting(block, 'bookingUrl');
  const submitLabel = readSetting(block, 'submitLabel', 'Update');
  const heading = readSetting(block, 'heading');

  block.replaceChildren();
  if (!bookingUrl) return;

  let authored;
  try {
    authored = new URL(bookingUrl);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('wh-booking-bar: invalid booking URL', bookingUrl);
    return;
  }

  const params = authored.searchParams;

  const form = document.createElement('form');
  form.className = 'wh-booking-bar-form';
  form.setAttribute('aria-label', heading || 'Search rooms and rates');

  const inner = document.createElement('div');
  inner.className = 'wh-booking-bar-inner';

  const checkIn = createDate('wh-check-in', toInputDate(params.get('checkInDate')));
  const checkOut = createDate('wh-check-out', toInputDate(params.get('checkOutDate')));
  const rooms = createSelect('wh-rooms', range(1, 9), params.get('rooms') || 1);
  const adults = createSelect('wh-adults', range(1, 8), params.get('adults') || 1);
  const children = createSelect('wh-children', range(0, 8), params.get('children') || 0);

  inner.append(
    createField('Check In', checkIn),
    createField('Checkout', checkOut),
    createField('Rooms', rooms),
    createField('Adults', adults),
    createField('Children', children),
  );

  const points = document.createElement('div');
  points.className = 'wh-booking-bar-field wh-booking-bar-points';
  const pointsInput = document.createElement('input');
  pointsInput.type = 'checkbox';
  pointsInput.id = 'wh-use-points';
  pointsInput.checked = params.get('useWRPoints') === 'true';
  const pointsLabel = document.createElement('label');
  pointsLabel.setAttribute('for', pointsInput.id);
  pointsLabel.textContent = 'Use Wyndham Rewards Points';
  points.append(pointsInput, pointsLabel);
  inner.append(points);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'wh-btn wh-booking-bar-submit';
  submit.textContent = submitLabel;
  inner.append(submit);

  form.append(inner);

  const status = document.createElement('p');
  status.className = 'wh-booking-bar-status';
  status.setAttribute('role', 'status');
  form.append(status);

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    if (checkIn.value && checkOut.value && checkOut.value <= checkIn.value) {
      status.textContent = 'Checkout must be after check in.';
      checkOut.focus();
      return;
    }
    status.textContent = '';

    const target = new URL(authored.href);
    const search = target.searchParams;
    if (checkIn.value) search.set('checkInDate', toEngineDate(checkIn.value));
    if (checkOut.value) search.set('checkOutDate', toEngineDate(checkOut.value));
    search.set('rooms', rooms.value);
    search.set('adults', adults.value);
    search.set('children', children.value);
    search.set('useWRPoints', String(pointsInput.checked));

    // The engine expects literal slashes in its date parameters.
    target.search = search.toString().replace(/%2F/g, '/');

    window.open(target.href, '_blank', 'noopener');
  });

  if (heading) {
    const title = document.createElement('h2');
    title.className = 'wh-booking-bar-heading';
    title.textContent = heading;
    block.append(title);
  }

  block.append(form);
}
