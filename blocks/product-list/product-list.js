import {
  buildProductFilter,
  createEmptySelectedFilters,
  loadProducts,
} from '../../scripts/api/product-list-api.js';
import {
  SORT_OPTIONS,
  getSortKeyFromUrl,
  updateSortInUrl,
} from '../../scripts/api/product-list-sort.js';
import readProductListConfig from './product-list-config.js';
import createFilterSidebar from './product-list-filters.js';

function renderStatus(message, isError = false) {
  const status = document.createElement('p');
  status.className = 'product-list-status';
  status.setAttribute('role', 'status');
  if (isError) status.classList.add('is-error');
  status.textContent = message;
  return status;
}

function buildProductDetailUrl(baseUrl, sku) {
  const safeBaseUrl = String(baseUrl || '').trim();
  const safeSku = String(sku || '').trim();
  if (!safeBaseUrl || !safeSku) return '';

  try {
    const url = new URL(safeBaseUrl, window.location.origin);
    url.searchParams.set('sku', safeSku);
    return url.toString();
  } catch {
    return '';
  }
}

function createProductCard(product, productDetailPageUrl) {
  const detailUrl = buildProductDetailUrl(productDetailPageUrl, product.sku);
  const card = detailUrl ? document.createElement('a') : document.createElement('article');
  card.className = 'product-list-card';

  if (detailUrl) {
    card.href = detailUrl;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.setAttribute('aria-label', `View details for ${product.name || product.sku || 'product'}`);
  }

  if (product.imageUrl) {
    const media = document.createElement('div');
    media.className = 'product-list-card-media';

    const img = document.createElement('img');
    img.src = product.imageUrl;
    img.alt = product.imageAlt || product.name || 'Product image';
    img.loading = 'lazy';
    media.append(img);
    card.append(media);
  }

  const body = document.createElement('div');
  body.className = 'product-list-card-body';

  if (product.name) {
    const title = document.createElement('h3');
    title.className = 'product-list-card-title';
    title.textContent = product.name;
    body.append(title);
  }

  if (product.sku) {
    const sku = document.createElement('p');
    sku.className = 'product-list-card-sku';
    sku.textContent = `SKU: ${product.sku}`;
    body.append(sku);
  }

  if (product.priceLabel) {
    const price = document.createElement('p');
    price.className = 'product-list-card-price';
    price.textContent = product.priceLabel;
    body.append(price);
  }

  card.append(body);
  return card;
}

function createProductGrid(items, productDetailPageUrl) {
  const grid = document.createElement('div');
  grid.className = 'product-list-grid';
  grid.setAttribute('role', 'list');

  items.forEach((product) => {
    const card = createProductCard(product, productDetailPageUrl);
    card.setAttribute('role', 'listitem');
    grid.append(card);
  });

  return grid;
}

function getSortOption(key) {
  return SORT_OPTIONS.find((option) => option.key === key) || SORT_OPTIONS[0];
}

function createSortDropdown(currentSortKey, onChange) {
  let selectedKey = currentSortKey;
  let isOpen = false;
  let outsideClickHandler = null;

  const control = document.createElement('div');
  control.className = 'product-list-sort-control';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'product-list-sort-trigger';
  trigger.id = 'product-list-sort-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', 'Sort products');

  const prefix = document.createElement('span');
  prefix.className = 'product-list-sort-prefix';
  prefix.textContent = 'Sort By';

  const value = document.createElement('span');
  value.className = 'product-list-sort-value';
  value.textContent = getSortOption(selectedKey).label;

  const arrow = document.createElement('span');
  arrow.className = 'product-list-sort-arrow';
  arrow.setAttribute('aria-hidden', 'true');

  trigger.append(prefix, value, arrow);

  const menu = document.createElement('ul');
  menu.className = 'product-list-sort-menu';
  menu.id = 'product-list-sort-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-labelledby', 'product-list-sort-trigger');
  menu.hidden = true;

  const setOpen = (open) => {
    isOpen = open;
    trigger.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    control.classList.toggle('is-open', open);

    if (outsideClickHandler) {
      document.removeEventListener('click', outsideClickHandler);
      outsideClickHandler = null;
    }

    if (open) {
      outsideClickHandler = (event) => {
        if (!control.contains(event.target)) setOpen(false);
      };
      requestAnimationFrame(() => {
        document.addEventListener('click', outsideClickHandler);
      });
    }
  };

  function renderOptions() {
    menu.replaceChildren();
    SORT_OPTIONS.forEach((option) => {
      const isSelected = option.key === selectedKey;
      const item = document.createElement('li');
      item.className = 'product-list-sort-option';
      item.setAttribute('role', 'option');
      item.setAttribute('data-sort-key', option.key);
      item.setAttribute('aria-selected', String(isSelected));
      item.tabIndex = -1;
      if (isSelected) item.classList.add('is-selected');

      const label = document.createElement('span');
      label.className = 'product-list-sort-option-label';
      label.textContent = option.label;

      const check = document.createElement('span');
      check.className = 'product-list-sort-option-check';
      check.setAttribute('aria-hidden', 'true');

      item.append(label, check);
      menu.append(item);
    });
  }

  function selectOption(key) {
    selectedKey = key;
    value.textContent = getSortOption(key).label;
    renderOptions();
    setOpen(false);
    onChange(key);
  }

  menu.addEventListener('click', (event) => {
    const item = event.target.closest('.product-list-sort-option');
    if (!item?.dataset?.sortKey) return;
    selectOption(item.dataset.sortKey);
  });

  const focusOptionAt = (index) => {
    const options = [...menu.querySelectorAll('.product-list-sort-option')];
    if (!options.length) return;
    const nextIndex = Math.max(0, Math.min(index, options.length - 1));
    options[nextIndex].focus();
  };

  trigger.addEventListener('click', () => setOpen(!isOpen));

  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isOpen) {
        setOpen(true);
        const selectedIndex = SORT_OPTIONS.findIndex((option) => option.key === selectedKey);
        focusOptionAt(selectedIndex >= 0 ? selectedIndex : 0);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  });

  menu.addEventListener('keydown', (event) => {
    const options = [...menu.querySelectorAll('.product-list-sort-option')];
    const currentIndex = options.indexOf(document.activeElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusOptionAt(currentIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusOptionAt(currentIndex - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const key = document.activeElement?.dataset?.sortKey;
      if (key) selectOption(key);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      trigger.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  });

  renderOptions();
  control.append(trigger, menu);
  return control;
}

function createSortToolbar(currentSortKey, totalCount, onChange) {
  const toolbar = document.createElement('div');
  toolbar.className = 'product-list-toolbar';

  const meta = document.createElement('p');
  meta.className = 'product-list-meta';
  meta.setAttribute('data-product-list-meta', 'true');
  meta.textContent = `${totalCount} Item${totalCount === 1 ? '' : 's'}`;
  toolbar.append(meta);

  const sortWrap = document.createElement('div');
  sortWrap.className = 'product-list-sort-wrap';
  sortWrap.append(createSortDropdown(currentSortKey, onChange));
  toolbar.append(sortWrap);

  return toolbar;
}

function createResultsHeader(heading) {
  const header = document.createElement('div');
  header.className = 'product-list-header';

  const title = document.createElement('h2');
  title.className = 'product-list-heading';
  title.textContent = heading;

  header.append(title);
  return header;
}

function setGridLoading(block, isLoading) {
  const grid = block.querySelector('.product-list-grid');
  const trigger = block.querySelector('.product-list-sort-trigger');
  if (grid) grid.classList.toggle('is-loading', isLoading);
  if (trigger) trigger.disabled = isLoading;
}

function renderCatalog(block, config, result, selectedFilters, sortKey, handlers) {
  block.replaceChildren();

  const wrapper = document.createElement('div');
  wrapper.className = 'product-list-content';

  const layout = document.createElement('div');
  layout.className = 'product-list-layout';

  const main = document.createElement('div');
  main.className = 'product-list-main';

  main.append(createResultsHeader(config.heading));

  const toolbar = createSortToolbar(sortKey, result.totalCount, handlers.onSortChange);
  if (result.sortWarning) {
    const warning = document.createElement('p');
    warning.className = 'product-list-sort-warning';
    warning.setAttribute('role', 'status');
    warning.textContent = result.sortWarning;
    toolbar.prepend(warning);
  }
  main.append(toolbar);

  if (result.items.length) {
    main.append(createProductGrid(result.items, config.productDetailPageUrl));
  } else {
    main.append(renderStatus('No products match the selected filters.', true));
  }

  layout.append(
    createFilterSidebar(
      result.aggregations,
      selectedFilters,
      handlers.onFilterChange,
      handlers.onClearFilters,
    ),
    main,
  );

  wrapper.append(layout);
  block.append(wrapper);
}

async function loadAndRenderCatalog(
  block,
  config,
  selectedFilters,
  sortKey,
  handlers,
  isReload = false,
) {
  if (!isReload) {
    block.replaceChildren(renderStatus('Loading products...'));
  } else {
    setGridLoading(block, true);
  }

  try {
    const productFilter = buildProductFilter(selectedFilters, config);
    const result = await loadProducts(config, productFilter, sortKey);

    if (!result) {
      block.replaceChildren(renderStatus(
        'Unable to load products. Check the GraphQL proxy endpoint and network connection.',
        true,
      ));
      return;
    }

    renderCatalog(block, config, result, selectedFilters, sortKey, handlers);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('product-list failed to load catalog', error);
    block.replaceChildren(renderStatus('Unable to load products.', true));
  }
}

/**
 * Loads and decorates the product list block.
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  if (block.querySelector('.product-list-content')) return;

  const config = readProductListConfig(block);
  let sortKey = getSortKeyFromUrl();

  const selectedFilters = createEmptySelectedFilters();
  if (config.minPrice || config.maxPrice) {
    selectedFilters.price = {
      from: config.minPrice || '',
      to: config.maxPrice || '',
    };
  }

  const handlers = {
    onFilterChange: (nextFilters) => {
      selectedFilters.attributes = nextFilters.attributes;
      selectedFilters.price = nextFilters.price;
      loadAndRenderCatalog(block, config, selectedFilters, sortKey, handlers, true);
    },
    onClearFilters: () => {
      selectedFilters.attributes = {};
      selectedFilters.price = { from: '', to: '' };
      loadAndRenderCatalog(block, config, selectedFilters, sortKey, handlers, true);
    },
    onSortChange: (nextSortKey) => {
      sortKey = nextSortKey;
      updateSortInUrl(sortKey);
      loadAndRenderCatalog(block, config, selectedFilters, sortKey, handlers, true);
    },
  };

  await loadAndRenderCatalog(block, config, selectedFilters, sortKey, handlers);
}
