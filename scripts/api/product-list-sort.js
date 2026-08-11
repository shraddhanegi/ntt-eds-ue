export const SORT_OPTIONS = [
  { key: 'best_match', label: 'Best Match', sort: { relevance: 'DESC' } },
  { key: 'brand', label: 'Brand', sort: { brand: 'ASC' } },
  { key: 'position', label: 'Position', sort: { position: 'ASC' } },
  { key: 'price_desc', label: 'Price: High to Low', sort: { price: 'DESC' } },
  { key: 'price_asc', label: 'Price: Low to High', sort: { price: 'ASC' } },
  { key: 'name', label: 'Product Name', sort: { name: 'ASC' } },
];

const SORT_KEYS = new Set(SORT_OPTIONS.map((option) => option.key));

/**
 * Default sort key for the product list.
 * @returns {string}
 */
export function getDefaultSortKey() {
  return 'best_match';
}

/**
 * Validates a sort key from URL or UI state.
 * @param {string} key sort key
 * @returns {boolean}
 */
export function isValidSortKey(key) {
  return SORT_KEYS.has(key);
}

/**
 * Resolves sort key from URL search params or default.
 * @returns {string}
 */
export function getSortKeyFromUrl() {
  const key = new URLSearchParams(window.location.search).get('sort') || '';
  return isValidSortKey(key) ? key : getDefaultSortKey();
}

/**
 * Maps a sort key to Magento GraphQL ProductAttributeSortInput.
 * @param {string} sortKey sort key
 * @returns {object}
 */
export function toGraphqlSortInput(sortKey) {
  const option = SORT_OPTIONS.find((entry) => entry.key === sortKey);
  return option?.sort || SORT_OPTIONS[0].sort;
}

/**
 * Updates the URL ?sort= param without reloading the page.
 * @param {string} sortKey sort key
 */
export function updateSortInUrl(sortKey) {
  const url = new URL(window.location.href);
  if (sortKey === getDefaultSortKey()) {
    url.searchParams.delete('sort');
  } else {
    url.searchParams.set('sort', sortKey);
  }
  window.history.replaceState({}, '', url);
}

/**
 * Client-side sort for mock data when GraphQL is unavailable.
 * @param {object[]} items normalized product items
 * @param {string} sortKey sort key
 * @returns {object[]}
 */
export function sortProductsClientSide(items, sortKey) {
  const list = [...items];

  switch (sortKey) {
    case 'brand':
      return list.sort((a, b) => (a.brandLabel || '').localeCompare(b.brandLabel || ''));
    case 'position':
      return list.sort((a, b) => Number(a.id) - Number(b.id));
    case 'price_desc':
      return list.sort((a, b) => (b.priceValue ?? 0) - (a.priceValue ?? 0));
    case 'price_asc':
      return list.sort((a, b) => (a.priceValue ?? 0) - (b.priceValue ?? 0));
    case 'name':
      return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    case 'best_match':
    default:
      return list;
  }
}
