import { getItemRows, readSetting } from '../../../scripts/whydham/wh-common.js';

function readSlides(block) {
  return getItemRows(block).filter((row) => {
    const key = row.children[0]?.textContent.trim().toLowerCase();
    return key !== 'heading';
  }).map((row) => {
    const cells = [...row.children];
    return {
      eyebrow: cells[0]?.textContent.trim() || '',
      quote: cells[1]?.textContent.trim() || row.querySelector('blockquote')?.textContent.trim() || '',
      cite: cells[2]?.textContent.trim() || row.querySelector('cite')?.textContent.trim() || '',
    };
  }).filter((slide) => slide.quote);
}

/**
 * Decorates the Wyndham testimonials carousel block.
 * @param {Element} block testimonials block element
 */
export default function decorate(block) {
  if (block.querySelector('.wh-testimonials-inner')) return;

  block.classList.add('awards-new');
  const heading = readSetting(block, 'heading', 'Our Guests Say It Best');
  const slides = readSlides(block);

  const inner = document.createElement('div');
  inner.className = 'container wh-testimonials-inner';

  const title = document.createElement('h2');
  title.textContent = heading;
  inner.append(title);

  const track = document.createElement('div');
  track.className = 'wh-testimonials-track';
  track.setAttribute('role', 'region');
  track.setAttribute('aria-label', heading);

  slides.forEach((slide, index) => {
    const article = document.createElement('article');
    article.className = 'awards-new__item wh-testimonials-item';
    if (index === 0) article.classList.add('is-active');

    if (slide.eyebrow) {
      const eyebrow = document.createElement('div');
      eyebrow.className = 'awards-title wh-testimonials-eyebrow';
      eyebrow.textContent = slide.eyebrow;
      article.append(eyebrow);
    }

    const quote = document.createElement('blockquote');
    quote.textContent = slide.quote;
    article.append(quote);

    if (slide.cite) {
      const cite = document.createElement('cite');
      cite.textContent = slide.cite;
      article.append(cite);
    }

    track.append(article);
  });

  if (slides.length > 1) {
    const controls = document.createElement('div');
    controls.className = 'wh-testimonials-controls';
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'wh-testimonials-prev';
    prev.setAttribute('aria-label', 'Previous testimonial');
    prev.textContent = '‹';
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'wh-testimonials-next';
    next.setAttribute('aria-label', 'Next testimonial');
    next.textContent = '›';

    let activeIndex = 0;
    const items = () => [...track.querySelectorAll('.wh-testimonials-item')];
    const show = (index) => {
      const list = items();
      activeIndex = (index + list.length) % list.length;
      list.forEach((item, i) => item.classList.toggle('is-active', i === activeIndex));
    };
    prev.addEventListener('click', () => show(activeIndex - 1));
    next.addEventListener('click', () => show(activeIndex + 1));
    controls.append(prev, next);
    inner.append(track, controls);
  } else {
    inner.append(track);
  }

  block.replaceChildren(inner);
}
