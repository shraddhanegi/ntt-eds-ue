/**
 * Wyndham site-specific import rules — map scraped markup to wh-* EDS blocks.
 * @see drafts/whydhams/home.plain.html for block contracts
 */

function absoluteSrc(img, baseUrl) {
  const src = img.getAttribute('src') || img.src || '';
  if (!src || src.startsWith('data:')) return src;
  if (!baseUrl) return src;
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}

function createPicture(img, document, baseUrl) {
  const pic = document.createElement('picture');
  const image = document.createElement('img');
  image.src = absoluteSrc(img, baseUrl);
  image.alt = img.getAttribute('alt') || '';
  pic.append(image);
  return pic;
}

function appendKvRow(block, document, key, value, options = {}) {
  const row = document.createElement('div');
  const keyCell = document.createElement('div');
  keyCell.textContent = key;
  const valCell = document.createElement('div');

  if (options.node) {
    valCell.append(options.node);
  } else if (options.asLink && value) {
    const p = document.createElement('p');
    const a = document.createElement('a');
    a.href = value;
    a.textContent = options.linkLabel || 'Link';
    p.append(a);
    valCell.append(p);
  } else {
    const p = document.createElement('p');
    p.textContent = value || '';
    valCell.append(p);
  }

  row.append(keyCell, valCell);
  block.append(row);
}

function appendCellsRow(block, document, cells) {
  const row = document.createElement('div');
  cells.forEach((cell) => {
    const cellDiv = document.createElement('div');
    if (typeof cell === 'string') {
      cellDiv.textContent = cell;
    } else if (cell instanceof document.defaultView.Node) {
      cellDiv.append(cell);
    }
    row.append(cellDiv);
  });
  block.append(row);
}

function readHeadlineText(el) {
  if (!el) return '';
  return el.textContent.replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} url Source page URL
 * @returns {boolean}
 */
export function isWyndhamHost(url) {
  try {
    return /wyndham/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function buildWhHeroBlock(source, document, baseUrl) {
  const block = document.createElement('div');
  block.className = 'wh-hero-container';

  const headlineEl = source.querySelector('.headline, h1, h2');
  appendKvRow(block, document, 'headline', readHeadlineText(headlineEl));

  const videoSrc = source.querySelector('video source[src]')?.getAttribute('src')
    || source.querySelector('a[href$=".mp4"]')?.getAttribute('href');
  if (videoSrc) {
    appendKvRow(block, document, 'videoUrl', videoSrc, {
      asLink: true,
      linkLabel: 'Hero video',
    });
  }

  const poster = source.querySelector('video[poster], .header-video img, img');
  if (poster && poster.tagName === 'IMG') {
    appendKvRow(block, document, 'posterImage', '', {
      node: createPicture(poster, document, baseUrl),
    });
  }

  return block;
}

function buildWhIntroBlock(source, document, baseUrl) {
  const block = document.createElement('div');
  block.className = 'wh-intro-container';

  const imgWrap = source.querySelector('.block-img');
  const alignment = imgWrap?.className.includes('right') ? 'right' : 'left';
  appendKvRow(block, document, 'imageAlignment', alignment);

  const imageRow = document.createElement('div');
  imageRow.setAttribute('data-wh-image', '');
  const imageCell = document.createElement('div');
  const img = source.querySelector('.block-img img');
  if (img) imageCell.append(createPicture(img, document, baseUrl));
  imageRow.append(imageCell);
  block.append(imageRow);

  const copyRow = document.createElement('div');
  copyRow.setAttribute('data-wh-copy', '');
  const copyCell = document.createElement('div');
  source.querySelectorAll('.block-copy h1, .block-copy p').forEach((node) => {
    copyCell.append(node.cloneNode(true));
  });
  copyRow.append(copyCell);
  block.append(copyRow);

  return block;
}

function buildWhIconsBlock(source, document, baseUrl) {
  const block = document.createElement('div');
  block.className = 'wh-icons';

  source.querySelectorAll('.icons__items.item, .icons__items .item').forEach((item) => {
    const label = item.querySelector('.icons__text')?.textContent.trim() || '';
    const link = item.querySelector('.icons__logos a[href], a.icons__logos');
    const img = item.querySelector('.icons__logos img, img');

    const cells = [document.createElement('div')];
    cells[0].textContent = '';

    const labelCell = document.createElement('div');
    const labelP = document.createElement('p');
    labelP.textContent = label;
    labelCell.append(labelP);
    cells.push(labelCell);

    const mediaCell = document.createElement('div');
    if (link && img) {
      const p = document.createElement('p');
      const a = document.createElement('a');
      a.href = link.getAttribute('href') || '';
      a.append(createPicture(img, document, baseUrl));
      p.append(a);
      mediaCell.append(p);
    } else if (img) {
      mediaCell.append(createPicture(img, document, baseUrl));
    }
    cells.push(mediaCell);

    appendCellsRow(block, document, cells);
  });

  return block;
}

function buildWhQuadItemRow(document, baseUrl, {
  title, image, description, ctaHref, ctaLabel,
}) {
  const cells = [];

  const titleCell = document.createElement('div');
  titleCell.textContent = title || '';
  cells.push(titleCell);

  const imageCell = document.createElement('div');
  if (image) imageCell.append(createPicture(image, document, baseUrl));
  cells.push(imageCell);

  const copyCell = document.createElement('div');
  if (description) {
    const p = document.createElement('p');
    p.textContent = description;
    copyCell.append(p);
  }
  if (ctaHref) {
    const p = document.createElement('p');
    const a = document.createElement('a');
    a.href = ctaHref;
    a.textContent = ctaLabel || 'Learn More';
    p.append(a);
    copyCell.append(p);
  }
  cells.push(copyCell);

  return cells;
}

function buildWhQuadBlock(source, document, baseUrl) {
  const block = document.createElement('div');
  block.className = 'wh-quad';

  const heading = source.querySelector('h2')?.textContent.trim();
  if (heading) appendKvRow(block, document, 'heading', heading);

  source.querySelectorAll('.columns-new__item').forEach((item) => {
    const title = item.querySelector('.title-columns, .title-image, h2')?.textContent.trim() || '';
    const img = item.querySelector('figure img, img');
    const paragraphs = [...item.querySelectorAll('.columns-new__text p')]
      .map((p) => p.textContent.trim())
      .filter(Boolean);
    const cta = item.querySelector('.columns-new__text a[href], a.btn');
    appendCellsRow(block, document, buildWhQuadItemRow(document, baseUrl, {
      title,
      image: img,
      description: paragraphs.join(' '),
      ctaHref: cta?.getAttribute('href'),
      ctaLabel: cta?.textContent.trim(),
    }));
  });

  return block;
}

function buildWhQuadOfferBlock(source, document, baseUrl) {
  const block = document.createElement('div');
  block.className = 'wh-quad';

  const title = source.querySelector('._title-content, ._title, .Quad_head strong')?.textContent.trim()
    || source.querySelector('._title')?.textContent.trim()
    || '';
  const subtitle = source.querySelector('._subtitle-content')?.textContent.trim();
  const img = source.querySelector('figure img, .Quad_container img');
  const description = source.querySelector('._copy-content, .Quad_body p')?.textContent.trim() || '';
  const cta = source.querySelector('._cta a[href], .Quad_body a[href]');
  const fullDescription = [subtitle, description].filter(Boolean).join(' ');

  appendCellsRow(block, document, buildWhQuadItemRow(document, baseUrl, {
    title,
    image: img,
    description: fullDescription,
    ctaHref: cta?.getAttribute('href'),
    ctaLabel: cta?.textContent.trim() || 'Book Now',
  }));

  return block;
}

function buildWhQuadAlternateBlock(source, document, baseUrl) {
  const block = document.createElement('div');
  block.className = 'wh-quad-alternate';

  const heading = source.querySelector('h2')?.textContent.trim();
  if (heading) appendKvRow(block, document, 'heading', heading);

  source.querySelectorAll('.columns-altern__item').forEach((item, index) => {
    const title = item.querySelector('.columns-altern__text h2, .columns-altern__text h3')
      ?.textContent.trim() || '';
    const img = item.querySelector('figure img, img');
    const paragraphs = [...item.querySelectorAll('.columns-altern__text p')]
      .map((p) => p.textContent.trim())
      .filter(Boolean);
    const cta = item.querySelector('.columns-altern__text a[href], a.btn');
    const alignment = index % 2 === 0 ? 'left' : 'right';

    appendCellsRow(block, document, [
      alignment,
      (() => {
        const cell = document.createElement('div');
        if (img) cell.append(createPicture(img, document, baseUrl));
        return cell;
      })(),
      (() => {
        const cell = document.createElement('div');
        if (title) {
          const h = document.createElement('h3');
          h.textContent = title;
          cell.append(h);
        }
        paragraphs.forEach((text) => {
          const p = document.createElement('p');
          p.textContent = text;
          cell.append(p);
        });
        if (cta) {
          const p = document.createElement('p');
          const a = document.createElement('a');
          a.href = cta.getAttribute('href') || '';
          a.textContent = cta.textContent.trim() || 'View More';
          p.append(a);
          cell.append(p);
        }
        return cell;
      })(),
    ]);
  });

  return block;
}

function buildWhTestimonialsBlock(source, document) {
  const block = document.createElement('div');
  block.className = 'wh-testimonials';

  const heading = source.querySelector('h2')?.textContent.trim() || 'Our Guests Say It Best';
  appendKvRow(block, document, 'heading', heading);

  source.querySelectorAll('.awards-new__item').forEach((item) => {
    appendCellsRow(block, document, [
      item.querySelector('.awards-title')?.textContent.trim() || '',
      item.querySelector('blockquote')?.textContent.trim() || '',
      item.querySelector('cite')?.textContent.trim() || '',
    ]);
  });

  return block;
}

function buildWhRoomDineSpaBlock(source, document, baseUrl) {
  const block = document.createElement('div');
  block.className = 'wh-quad wh-quad-feature-tiles';

  const scope = source.matches('.home-room-dine-spa, section.home-room-dine-spa')
    ? source
    : source.querySelector('.home-room-dine-spa, section.home-room-dine-spa') || source;

  const tiles = scope.querySelectorAll('.show-object, .col-sm-4, [class*="col-sm-"]');
  const seen = new Set();

  tiles.forEach((col) => {
    const img = col.querySelector('img');
    const title = readHeadlineText(col.querySelector('.title h2, h2'));
    const cta = col.querySelector('.title a.btn, .title a[href], a.btn, a[href]');
    const key = `${title}|${img?.getAttribute('src') || ''}`;
    if (!title && !img) return;
    if (seen.has(key)) return;
    seen.add(key);

    appendCellsRow(block, document, buildWhQuadItemRow(document, baseUrl, {
      title,
      image: img,
      description: '',
      ctaHref: cta?.getAttribute('href'),
      ctaLabel: cta?.textContent.trim(),
    }));
  });

  return block;
}

function buildWhMapBlock(source, document, baseUrl) {
  const block = document.createElement('div');
  block.className = 'wh-intro-container wh-map-intro';

  const scope = source.matches('.home-map, section.home-map')
    ? source
    : source.querySelector('.home-map, section.home-map') || source;

  appendKvRow(block, document, 'imageAlignment', 'right');

  const imageRow = document.createElement('div');
  imageRow.setAttribute('data-wh-image', '');
  const imageCell = document.createElement('div');
  const img = scope.querySelector('img.map-inset, .map-inset');
  if (img) imageCell.append(createPicture(img, document, baseUrl));
  imageRow.append(imageCell);
  block.append(imageRow);

  const copyRow = document.createElement('div');
  copyRow.setAttribute('data-wh-copy', '');
  const copyCell = document.createElement('div');
  const copyRoot = scope.querySelector('[class*="col-sm"], [class*="col-md"], [class*="col-lg"]')
    || scope.querySelector('.container > div')
    || scope;

  const heading = copyRoot.querySelector('h2');
  if (heading) copyCell.append(heading.cloneNode(true));

  copyRoot.querySelectorAll('p').forEach((p) => {
    if (p.closest('form, .email-signup, .social-media')) return;
    copyCell.append(p.cloneNode(true));
  });

  const cta = copyRoot.querySelector('a.btn, a.btn-white, a[href*="explore"]');
  if (cta && !copyCell.querySelector('a[href]')) {
    const p = document.createElement('p');
    p.append(cta.cloneNode(true));
    copyCell.append(p);
  } else if (cta && !copyCell.querySelector(`a[href="${cta.getAttribute('href')}"]`)) {
    const p = document.createElement('p');
    p.append(cta.cloneNode(true));
    copyCell.append(p);
  }

  copyRow.append(copyCell);
  block.append(copyRow);

  return block;
}

function buildWhGalleryBlock(source, document, baseUrl) {
  const block = document.createElement('div');
  block.className = 'wh-quad wh-quad-gallery';

  const heading = source.querySelector('h2')?.textContent.trim() || 'Gallery';
  appendKvRow(block, document, 'heading', heading);

  source.querySelectorAll('[class*="gallery-inset"]').forEach((item) => {
    const anchor = item.querySelector('a[href]');
    const bgDiv = item.querySelector('[style*="background-image"]');
    const bgMatch = bgDiv?.getAttribute('style')?.match(/url\(["']?([^"')]+)/);
    const imgUrl = anchor?.getAttribute('href') || bgMatch?.[1];
    if (!imgUrl) return;

    const img = document.createElement('img');
    img.src = imgUrl;
    img.alt = anchor?.getAttribute('aria-label') || 'Gallery image';

    appendCellsRow(block, document, buildWhQuadItemRow(document, baseUrl, {
      title: '',
      image: img,
      description: '',
      ctaHref: anchor?.getAttribute('href'),
      ctaLabel: 'View',
    }));
  });

  const viewMore = source.querySelector('a.btn');
  if (viewMore) {
    appendCellsRow(block, document, [
      'Gallery CTA',
      document.createElement('div'),
      (() => {
        const cell = document.createElement('div');
        const p = document.createElement('p');
        const a = document.createElement('a');
        a.href = viewMore.href;
        a.textContent = viewMore.textContent.trim() || 'View More';
        a.className = 'btn';
        p.append(a);
        cell.append(p);
        return cell;
      })(),
    ]);
  }

  return block;
}

function replaceSection(main, selector, builder) {
  [...main.querySelectorAll(selector)].forEach((el) => {
    if (!el.isConnected) return;
    const section = el.closest('section') || el;
    if (!section.isConnected) return;
    section.replaceWith(builder(section));
  });
}

/**
 * Convert Wyndham scraped sections into wh-* block markup.
 * @param {Element} main Main content root
 * @param {Document} document Document
 * @param {string} url Source page URL
 */
export function convertWyndhamBlocks(main, document, url) {
  if (!isWyndhamHost(url)) return;

  replaceSection(main, 'section.hero-container, .hero-container.top-content', (s) => (
    buildWhHeroBlock(s, document, url)
  ));

  replaceSection(main, 'section.Quad, .Quad', (s) => (
    buildWhQuadOfferBlock(s, document, url)
  ));

  replaceSection(main, 'section.intro-container, .intro-container.intro-content', (s) => (
    buildWhIntroBlock(s, document, url)
  ));

  replaceSection(main, 'section.icons, .icons', (s) => (
    buildWhIconsBlock(s, document, url)
  ));

  replaceSection(main, 'section.columns-new, .columns-new', (s) => (
    buildWhQuadBlock(s, document, url)
  ));

  replaceSection(main, 'section.awards-new, .awards-new', (s) => (
    buildWhTestimonialsBlock(s, document)
  ));

  replaceSection(main, 'section.columns-altern, .columns-altern', (s) => (
    buildWhQuadAlternateBlock(s, document, url)
  ));

  replaceSection(main, 'section.home-room-dine-spa, .home-room-dine-spa', (s) => (
    buildWhRoomDineSpaBlock(s, document, url)
  ));

  replaceSection(main, 'section.home-map, .home-map', (s) => (
    buildWhMapBlock(s, document, url)
  ));

  replaceSection(main, 'section.home-gallery, .home-gallery, section.shortcode-gallery, .shortcode-gallery', (s) => (
    buildWhGalleryBlock(s, document, url)
  ));

  main.querySelectorAll('[id^="_quad_teleport"], ._quad-container').forEach((wrapper) => {
    const whBlock = wrapper.querySelector('[class*="wh-"]');
    if (whBlock) {
      wrapper.replaceWith(whBlock);
      return;
    }
    wrapper.remove();
  });

  main.querySelectorAll('.bonage, .slick-dots').forEach((el) => el.remove());
}
