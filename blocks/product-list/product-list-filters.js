import {
  getPriceBoundsFromAggregations,
  parsePriceValue,
} from '../../scripts/api/product-list-api.js';

const FILTER_COUNT_TO_OPEN = 3;
const FILTER_ITEMS_TO_SHOW = 5;
const PRICE_SLIDER_DEBOUNCE_MS = 350;

function cloneSelectedFilters(selectedFilters) {
  return {
    attributes: Object.fromEntries(
      Object.entries(selectedFilters?.attributes || {}).map(([key, values]) => [key, [...values]]),
    ),
    price: {
      from: selectedFilters?.price?.from || '',
      to: selectedFilters?.price?.to || '',
    },
  };
}

function getSelectedValues(selectedFilters, attributeCode) {
  return selectedFilters?.attributes?.[attributeCode] || [];
}

function isOptionSelected(selectedFilters, attributeCode, value) {
  return getSelectedValues(selectedFilters, attributeCode).includes(value);
}

function toggleAttributeValue(selectedFilters, attributeCode, value, checked) {
  const next = cloneSelectedFilters(selectedFilters);
  const current = new Set(next.attributes[attributeCode] || []);

  if (checked) {
    current.add(value);
  } else {
    current.delete(value);
  }

  if (current.size) {
    next.attributes[attributeCode] = [...current];
  } else {
    delete next.attributes[attributeCode];
  }

  return next;
}

function setPriceRange(selectedFilters, from, to) {
  const next = cloneSelectedFilters(selectedFilters);
  next.price = { from: from || '', to: to || '' };
  return next;
}

function formatCurrency(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '$0';

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${value}`;
  }
}

function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn(...args), delay);
  };
}

function isPriceFilterActive(selectedFilters, bounds) {
  const from = parsePriceValue(selectedFilters?.price?.from);
  const to = parsePriceValue(selectedFilters?.price?.to);

  if (from == null && to == null) return false;
  if (from != null && from > bounds.min) return true;
  if (to != null && to < bounds.max) return true;
  return false;
}

function hasActiveFilters(selectedFilters, priceBounds) {
  const hasAttributes = Object.values(selectedFilters?.attributes || {})
    .some((values) => values.length);
  return hasAttributes || isPriceFilterActive(selectedFilters, priceBounds);
}

function createClearAllButton(onClear) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'product-list-filter-clear-all';
  button.textContent = 'Clear all';
  button.addEventListener('click', onClear);
  return button;
}

function createFilterOption(attributeCode, option, selectedFilters, onChange) {
  const item = document.createElement('li');
  item.className = 'product-list-filter-item';

  const label = document.createElement('label');
  label.className = 'product-list-filter-option';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'product-list-filter-checkbox';
  input.name = `filter-${attributeCode}`;
  input.value = option.value;
  input.checked = isOptionSelected(selectedFilters, attributeCode, option.value);

  input.addEventListener('change', () => {
    onChange(toggleAttributeValue(
      selectedFilters,
      attributeCode,
      option.value,
      input.checked,
    ));
  });

  const text = document.createElement('span');
  text.className = 'product-list-filter-option-label';
  text.textContent = option.label;

  const count = document.createElement('span');
  count.className = 'product-list-filter-option-count';
  count.textContent = String(option.count);

  label.append(input, text, count);
  item.append(label);
  return item;
}

function createPriceRangeSlider(aggregation, selectedFilters, onChange) {
  const bounds = getPriceBoundsFromAggregations([aggregation]);
  const container = document.createElement('div');
  container.className = 'product-list-price-slider';

  const values = document.createElement('div');
  values.className = 'product-list-price-slider-values';

  const minLabel = document.createElement('span');
  minLabel.className = 'product-list-price-slider-value';

  const maxLabel = document.createElement('span');
  maxLabel.className = 'product-list-price-slider-value';

  values.append(minLabel, maxLabel);

  const slider = document.createElement('div');
  slider.className = 'product-list-price-slider-track';

  const range = document.createElement('div');
  range.className = 'product-list-price-slider-range';

  const minInput = document.createElement('input');
  minInput.type = 'range';
  minInput.className = 'product-list-price-slider-thumb product-list-price-slider-thumb-min';
  minInput.min = String(bounds.min);
  minInput.max = String(bounds.max);
  minInput.step = '1';
  minInput.value = String(parsePriceValue(selectedFilters?.price?.from) ?? bounds.min);
  minInput.setAttribute('aria-label', 'Minimum price');

  const maxInput = document.createElement('input');
  maxInput.type = 'range';
  maxInput.className = 'product-list-price-slider-thumb product-list-price-slider-thumb-max';
  maxInput.min = String(bounds.min);
  maxInput.max = String(bounds.max);
  maxInput.step = '1';
  maxInput.value = String(parsePriceValue(selectedFilters?.price?.to) ?? bounds.max);
  maxInput.setAttribute('aria-label', 'Maximum price');

  slider.append(range, minInput, maxInput);
  container.append(values, slider);

  const getPercent = (value) => Math.round(
    ((value - bounds.min) / (bounds.max - bounds.min)) * 100,
  );

  const updateRangeVisual = () => {
    const minVal = Number(minInput.value);
    const maxVal = Number(maxInput.value);
    const minPercent = getPercent(minVal);
    const maxPercent = getPercent(maxVal);

    range.style.left = `${minPercent}%`;
    range.style.width = `${maxPercent - minPercent}%`;
    minLabel.textContent = formatCurrency(minVal);
    maxLabel.textContent = formatCurrency(maxVal);
  };

  const applyPriceFilter = debounce(() => {
    const minVal = Number(minInput.value);
    const maxVal = Number(maxInput.value);

    if (minVal <= bounds.min && maxVal >= bounds.max) {
      onChange(setPriceRange(selectedFilters, '', ''));
      return;
    }

    onChange(setPriceRange(selectedFilters, String(minVal), String(maxVal)));
  }, PRICE_SLIDER_DEBOUNCE_MS);

  minInput.addEventListener('input', () => {
    if (Number(minInput.value) >= Number(maxInput.value)) {
      minInput.value = String(Number(maxInput.value) - 1);
    }
    updateRangeVisual();
    applyPriceFilter();
  });

  maxInput.addEventListener('input', () => {
    if (Number(maxInput.value) <= Number(minInput.value)) {
      maxInput.value = String(Number(minInput.value) + 1);
    }
    updateRangeVisual();
    applyPriceFilter();
  });

  updateRangeVisual();
  return container;
}

function createFilterBlock(aggregation, index, selectedFilters, onChange) {
  const block = document.createElement('li');
  block.className = 'product-list-filter-block';

  const details = document.createElement('details');
  details.className = 'product-list-filter-block-details';
  details.open = index < FILTER_COUNT_TO_OPEN;

  const summary = document.createElement('summary');
  summary.className = 'product-list-filter-block-trigger';
  summary.textContent = aggregation.label;

  details.append(summary);

  if (aggregation.attributeCode === 'price') {
    details.append(createPriceRangeSlider(aggregation, selectedFilters, onChange));
  } else {
    const list = document.createElement('ul');
    list.className = 'product-list-filter-list';
    list.setAttribute('role', 'group');
    list.setAttribute('aria-label', aggregation.label);

    const hiddenItems = [];

    aggregation.options.forEach((option, optionIndex) => {
      const item = createFilterOption(
        aggregation.attributeCode,
        option,
        selectedFilters,
        onChange,
      );

      if (optionIndex < FILTER_ITEMS_TO_SHOW) {
        list.append(item);
      } else {
        item.hidden = true;
        hiddenItems.push(item);
        list.append(item);
      }
    });

    if (hiddenItems.length) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'product-list-filter-show-more';
      toggle.textContent = 'Show more';

      toggle.addEventListener('click', () => {
        const expanded = toggle.dataset.expanded === 'true';
        hiddenItems.forEach((item) => {
          item.hidden = expanded;
        });
        toggle.dataset.expanded = expanded ? 'false' : 'true';
        toggle.textContent = expanded ? 'Show more' : 'Show less';
      });

      list.append(toggle);
    }

    details.append(list);
  }

  block.append(details);
  return block;
}

/**
 * Builds a Venia-style filter sidebar from GraphQL aggregations.
 * @param {object[]} aggregations normalized aggregations
 * @param {object} selectedFilters current filter state
 * @param {Function} onChange callback when filters change
 * @param {Function} onClear callback to clear all filters
 * @returns {HTMLElement}
 */
export default function createFilterSidebar(aggregations, selectedFilters, onChange, onClear) {
  const priceBounds = getPriceBoundsFromAggregations(aggregations);
  const sidebar = document.createElement('aside');
  sidebar.className = 'product-list-filter-sidebar';
  sidebar.setAttribute('aria-label', 'Product filters');

  const header = document.createElement('div');
  header.className = 'product-list-filter-sidebar-header';

  const title = document.createElement('h3');
  title.className = 'product-list-filter-sidebar-title';
  title.textContent = 'Filters';

  header.append(title);

  if (hasActiveFilters(selectedFilters, priceBounds)) {
    header.append(createClearAllButton(onClear));
  }

  const blocks = document.createElement('ul');
  blocks.className = 'product-list-filter-blocks';

  (aggregations || []).forEach((aggregation, index) => {
    if (aggregation.attributeCode === 'price' || aggregation?.options?.length) {
      blocks.append(createFilterBlock(aggregation, index, selectedFilters, onChange));
    }
  });

  if (!blocks.children.length) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'product-list-filter-empty';
    emptyItem.textContent = 'No filter options available.';
    blocks.append(emptyItem);
  }

  sidebar.append(header, blocks);
  return sidebar;
}
