import fetchJson from './fetch-json.js';
import { toSafeSameOriginFetchUrl } from './search-api.js';
import {
  sortProductsClientSide,
  toGraphqlSortInput,
  getDefaultSortKey,
} from './product-list-sort.js';

const DEFAULT_MOCK_ENDPOINT = '/drafts/mock-product-list.json';
const LOCAL_GRAPHQL_TIMEOUT_MS = 8000;

/** App Builder GraphQL proxy (CORS-enabled for *.aem.page). */
export const DEFAULT_APP_BUILDER_GRAPHQL_PROXY = 'https://120642-edsapi-stage.adobeio-static.net/api/v1/web/api-mesh/api-mesh-graphql';

/** Headers allowed on cross-origin API Mesh requests (must match mesh CORS allowedHeaders). */
export const GRAPHQL_REQUEST_HEADERS = [
  'Accept',
  'Content-Type',
  'x-api-key',
];

const PRODUCTS_SELECTION = `
      aggregations {
        attribute_code
        label
        count
        options {
          label
          value
          count
        }
      }
      items {
        id
        name
        sku
        url_key
        price_range {
          minimum_price {
            final_price {
              value
              currency
            }
          }
        }
        small_image {
          url
        }
      }
      total_count
`;

/** Query without filter — App Builder proxy returns 500 when $filter is null. */
export const PRODUCTS_QUERY = `
  query GetProducts($pageSize: Int!, $sort: ProductAttributeSortInput) {
    products(search: "", pageSize: $pageSize, sort: $sort) {
${PRODUCTS_SELECTION}
    }
  }
`;

export const PRODUCTS_QUERY_WITH_FILTER = `
  query GetProducts($pageSize: Int!, $filter: ProductAttributeFilterInput!, $sort: ProductAttributeSortInput) {
    products(search: "", pageSize: $pageSize, filter: $filter, sort: $sort) {
${PRODUCTS_SELECTION}
    }
  }
`;

/**
 * Creates an empty selected-filters state object.
 * @returns {{ attributes: Record<string, string[]>, price: { from: string, to: string } }}
 */
export function createEmptySelectedFilters() {
  return {
    attributes: {},
    price: { from: '', to: '' },
  };
}

/**
 * Parses a numeric price value from user input.
 * @param {string|number} value price input
 * @returns {number|null}
 */
export function parsePriceValue(value) {
  if (value == null || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount;
}

/**
 * Parses a Venia/Magento price bucket value (e.g. "0_30").
 * @param {string} value price bucket value
 * @returns {{ from: string, to: string }|null}
 */
export function parsePriceBucketValue(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return null;

  const parts = candidate.split('_');
  if (parts.length !== 2) return null;

  const from = parsePriceValue(parts[0]);
  const to = parsePriceValue(parts[1]);
  if (from == null || to == null) return null;

  return { from: String(from), to: String(to) };
}

/**
 * Builds a Venia/Magento GraphQL price filter from min/max values.
 * @param {string|number|null|undefined} minPrice lowest price (inclusive)
 * @param {string|number|null|undefined} maxPrice highest price (inclusive)
 * @returns {{ price: { from?: string, to?: string } }|null}
 */
export function buildPriceFilter(minPrice, maxPrice) {
  const min = parsePriceValue(minPrice);
  const max = parsePriceValue(maxPrice);

  if (min == null && max == null) return null;
  if (min != null && max != null && min > max) return null;

  const price = {};
  if (min != null) price.from = String(min);
  if (max != null) price.to = String(max);

  return { price };
}

function sanitizeText(value, maxLength = 500) {
  if (value == null) return '';
  return String(value).trim().slice(0, maxLength);
}

/**
 * Builds a Venia ProductAttributeFilterInput from selected filter state.
 * @param {object} selectedFilters selected filter state
 * @param {object} [config] product list configuration
 * @returns {object|null}
 */
export function buildProductFilter(selectedFilters = createEmptySelectedFilters(), config = {}) {
  const filter = {};

  const categorySelections = (selectedFilters?.attributes?.category_id || [])
    .map((value) => sanitizeText(value, 64))
    .filter(Boolean);

  if (categorySelections.length === 1) {
    filter.category_id = { eq: categorySelections[0] };
  } else if (categorySelections.length > 1) {
    filter.category_id = { in: categorySelections };
  } else {
    const categoryId = sanitizeText(config?.categoryId, 64);
    if (categoryId) {
      filter.category_id = { eq: categoryId };
    }
  }

  Object.entries(selectedFilters?.attributes || {}).forEach(([attributeCode, values]) => {
    const safeCode = sanitizeText(attributeCode, 64);
    if (!safeCode || safeCode === 'price' || safeCode === 'category_id') return;

    const normalizedValues = (Array.isArray(values) ? values : [])
      .map((value) => sanitizeText(value, 64))
      .filter(Boolean);

    if (!normalizedValues.length) return;

    if (normalizedValues.length === 1) {
      filter[safeCode] = { eq: normalizedValues[0] };
    } else {
      filter[safeCode] = { in: normalizedValues };
    }
  });

  const priceFilter = buildPriceFilter(
    selectedFilters?.price?.from,
    selectedFilters?.price?.to,
  );
  if (priceFilter?.price) {
    filter.price = priceFilter.price;
  }

  return Object.keys(filter).length ? filter : null;
}

export function getPriceBoundsFromAggregations(aggregations) {
  const priceAgg = aggregations?.find((agg) => agg.attributeCode === 'price');
  let min = Infinity;
  let max = -Infinity;

  (priceAgg?.options || []).forEach((option) => {
    const bucket = parsePriceBucketValue(option.value);
    if (!bucket) return;
    min = Math.min(min, Number(bucket.from));
    max = Math.max(max, Number(bucket.to));
  });

  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    return { min: 0, max: 100 };
  }

  return { min, max };
}

function buildProductsQueryRequest(config, productFilter, sortKey) {
  const hasFilter = Boolean(productFilter && Object.keys(productFilter).length);
  const sort = toGraphqlSortInput(sortKey);

  if (hasFilter) {
    return {
      query: PRODUCTS_QUERY_WITH_FILTER,
      variables: {
        pageSize: config.pageSize,
        filter: productFilter,
        sort,
      },
    };
  }

  return {
    query: PRODUCTS_QUERY,
    variables: {
      pageSize: config.pageSize,
      sort,
    },
  };
}

/**
 * Sanitizes an author-configured GraphQL endpoint URL.
 * @param {string} value endpoint URL from block authoring
 * @returns {string}
 */
export function toSafeGraphqlEndpoint(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return '';

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:') return '';
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * Uses the GraphQL endpoint authored on the block (resolved in product-list-config.js).
 * @param {object} config product list configuration
 * @returns {string}
 */
export function resolveGraphqlEndpoint(config) {
  return toSafeGraphqlEndpoint(config?.graphqlEndpoint);
}

/**
 * Returns true when the URL targets Adobe API Mesh GraphQL (browser CORS blocked).
 * @param {string} url GraphQL endpoint
 * @returns {boolean}
 */
export function isMeshGraphqlEndpoint(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === 'edge-sandbox-graph.adobe.io' || hostname === 'edge-graph.adobe.io';
  } catch {
    return false;
  }
}

/**
 * Validates an App Builder web action URL used as a GraphQL proxy.
 * @param {string} value proxy URL from block authoring
 * @returns {string}
 */
export function toSafeAppBuilderProxyUrl(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return '';

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:') return '';
    const host = url.hostname;
    const isAppBuilderHost = host.endsWith('.adobeio-static.net') || host.endsWith('.adobeioruntime.net');
    if (!isAppBuilderHost) return '';
    if (!url.pathname.includes('api-mesh-graphql')) return '';
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * Resolves an optional GraphQL proxy endpoint (App Builder or same-origin).
 * @param {string} value proxy URL from block authoring
 * @returns {string}
 */
export function resolveGraphqlProxyEndpoint(value) {
  const appBuilderProxy = toSafeAppBuilderProxyUrl(value);
  if (appBuilderProxy) return appBuilderProxy;
  return toSafeSameOriginFetchUrl(value, '');
}

/**
 * Picks the proxy URL to use: authored value, or App Builder default for Mesh endpoints.
 * @param {object} config product list configuration
 * @returns {string}
 */
export function resolveEffectiveGraphqlProxy(config) {
  const authored = resolveGraphqlProxyEndpoint(config?.graphqlProxyEndpoint);
  if (authored) return authored;

  const endpoint = resolveGraphqlEndpoint(config);
  if (endpoint && isMeshGraphqlEndpoint(endpoint)) {
    return DEFAULT_APP_BUILDER_GRAPHQL_PROXY;
  }

  return '';
}

function sanitizeUrl(value) {
  const candidate = sanitizeText(value, 2000);
  if (!candidate) return '';

  if (candidate.startsWith('/') && !candidate.startsWith('//')) {
    return candidate;
  }

  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * Builds CORS-safe request headers for API Mesh GraphQL calls.
 * @param {object} config product list configuration
 * @returns {Record<string, string>}
 */
export function buildGraphqlHeaders(config) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  const safeApiKey = sanitizeText(config?.graphqlApiKey, 256);
  if (safeApiKey) {
    headers['x-api-key'] = safeApiKey;
  }

  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => GRAPHQL_REQUEST_HEADERS
      .some((allowed) => allowed.toLowerCase() === name.toLowerCase())),
  );
}

/**
 * Restricts mock API targets to the current origin.
 * @param {string} value mock endpoint URL or path
 * @returns {string}
 */
export function toSafeMockEndpoint(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return '';

  try {
    const url = new URL(candidate, window.location.origin);
    if (url.origin !== window.location.origin) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function isLocalDevHost() {
  const { hostname } = window.location;
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function isUsableProductResult(result) {
  if (!result) return false;
  return Boolean(result.items?.length || result.aggregations?.length);
}

async function fetchWithTimeout(url, options, timeoutMs = LOCAL_GRAPHQL_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function isCrossOriginUrl(url) {
  try {
    return new URL(url).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function parseGraphqlResponse(json) {
  if (!json) return null;
  if (json?.errors?.length) {
    return { errors: json.errors };
  }
  return json;
}

async function postGraphqlDirect(endpoint, query, variables, config) {
  const headers = buildGraphqlHeaders(config);

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) return null;

  const json = await response.json();
  return parseGraphqlResponse(json);
}

async function postGraphqlViaAppBuilderProxy(proxyEndpoint, query, variables, config) {
  const headers = buildGraphqlHeaders(config);

  const response = await fetchWithTimeout(proxyEndpoint, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) return null;

  const json = await response.json();
  const payload = json?.body ?? json;
  if (payload?.errors?.length) {
    return { errors: payload.errors };
  }

  if (payload?.products) {
    return { data: payload };
  }

  return parseGraphqlResponse(payload);
}

async function postGraphqlViaProxy(proxyEndpoint, endpoint, query, variables, config) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  const response = await fetchWithTimeout(proxyEndpoint, {
    method: 'POST',
    mode: 'cors',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({
      endpoint,
      query,
      variables,
      apiKey: sanitizeText(config?.graphqlApiKey, 256) || undefined,
    }),
  });

  if (!response.ok) return null;

  const json = await response.json();
  return parseGraphqlResponse(json);
}

/**
 * Executes a GraphQL query using a same-origin proxy or direct cross-origin fetch.
 * @param {object} config product list configuration
 * @param {string} query GraphQL query
 * @param {object} variables query variables
 * @returns {Promise<object|null>}
 */
export async function executeGraphqlQuery(config, query, variables) {
  const endpoint = resolveGraphqlEndpoint(config);
  if (!endpoint) return null;

  const proxyEndpoint = resolveEffectiveGraphqlProxy(config);

  if (proxyEndpoint && toSafeAppBuilderProxyUrl(proxyEndpoint)) {
    const proxied = await postGraphqlViaAppBuilderProxy(proxyEndpoint, query, variables, config);
    if (proxied) return proxied;
  }

  if (proxyEndpoint && !toSafeAppBuilderProxyUrl(proxyEndpoint)) {
    const proxied = await postGraphqlViaProxy(proxyEndpoint, endpoint, query, variables, config);
    if (proxied) return proxied;
  }

  if (isCrossOriginUrl(endpoint) && isMeshGraphqlEndpoint(endpoint)) {
    return null;
  }

  if (!isCrossOriginUrl(endpoint)) {
    return postGraphqlDirect(endpoint, query, variables, config);
  }

  try {
    const direct = await postGraphqlDirect(endpoint, query, variables, config);
    if (direct) return direct;
  } catch {
    // Fall through when direct CORS/network fetch fails.
  }

  return null;
}

function formatPrice(price) {
  if (!price || price.value == null) return '';
  const amount = Number(price.value);
  if (!Number.isFinite(amount)) return '';

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: price.currency || 'USD',
    }).format(amount);
  } catch {
    return `${amount} ${price.currency || ''}`.trim();
  }
}

/**
 * Normalizes a Commerce/Venia product item from GraphQL.
 * @param {object} item raw product item
 * @returns {object|null}
 */
export function normalizeProduct(item) {
  if (!item || typeof item !== 'object') return null;

  const price = item.price_range?.minimum_price?.final_price;
  const imageUrl = sanitizeUrl(item.small_image?.url);
  const brandLabel = sanitizeText(
    item.brand?.label || item.brand || '',
    200,
  );

  return {
    id: sanitizeText(item.id, 64),
    name: sanitizeText(item.name, 200),
    sku: sanitizeText(item.sku, 64),
    urlKey: sanitizeText(item.url_key, 200),
    imageUrl,
    imageAlt: sanitizeText(item.name, 200),
    priceValue: parsePriceValue(price?.value),
    priceLabel: formatPrice(price),
    brandLabel,
    categoryId: sanitizeText(item.category_id, 64),
    color: sanitizeText(item.color, 64),
    size: sanitizeText(item.size, 64),
  };
}

/**
 * Normalizes a Venia aggregation bucket from GraphQL.
 * @param {object} aggregation raw aggregation
 * @returns {object|null}
 */
export function normalizeAggregation(aggregation) {
  if (!aggregation || typeof aggregation !== 'object') return null;

  const attributeCode = sanitizeText(aggregation.attribute_code, 64);
  if (!attributeCode) return null;

  const options = (aggregation.options || [])
    .map((option) => ({
      label: sanitizeText(option?.label, 120),
      value: sanitizeText(option?.value, 64),
      count: Number(option?.count) || 0,
    }))
    .filter((option) => option.label && option.value);

  return {
    attributeCode,
    label: sanitizeText(aggregation.label, 120) || attributeCode,
    count: Number(aggregation.count) || options.length,
    options,
  };
}

/**
 * Extracts aggregations from a GraphQL response.
 * @param {object} data parsed GraphQL JSON
 * @returns {object[]}
 */
export function extractAggregations(data) {
  const aggregations = data?.data?.products?.aggregations || [];
  return aggregations.map(normalizeAggregation).filter(Boolean);
}

function matchesAttributeFilter(product, attributeCode, values) {
  if (!values?.length) return true;

  const productValue = sanitizeText(product?.[attributeCode] || product?.[attributeCode.replace(/_([a-z])/g, (_, c) => c.toUpperCase())], 64);
  if (!productValue) return false;

  return values.includes(productValue);
}

/**
 * Returns true when a product matches the selected Venia filter state.
 * @param {object} product normalized product
 * @param {object|null} productFilter GraphQL filter object
 * @returns {boolean}
 */
export function matchesProductFilter(product, productFilter) {
  if (!productFilter) return true;

  if (productFilter.price) {
    const amount = product?.priceValue;
    if (amount == null) return false;

    const min = parsePriceValue(productFilter.price.from);
    const max = parsePriceValue(productFilter.price.to);

    if (min != null && amount < min) return false;
    if (max != null && amount > max) return false;
  }

  return Object.entries(productFilter).every(([attributeCode, clause]) => {
    if (attributeCode === 'price') return true;

    const productField = attributeCode === 'category_id' ? 'categoryId' : attributeCode;

    if (clause?.eq != null) {
      return matchesAttributeFilter(product, productField, [String(clause.eq)]);
    }

    if (Array.isArray(clause?.in)) {
      return matchesAttributeFilter(product, productField, clause.in.map(String));
    }

    return true;
  });
}

/**
 * Extracts product items from a GraphQL response.
 * @param {object} data parsed GraphQL JSON
 * @returns {{ items: object[], totalCount: number }}
 */
export function extractProducts(data) {
  const items = data?.data?.products?.items || [];
  const totalCount = Number(data?.data?.products?.total_count) || items.length;

  return {
    items: items.map(normalizeProduct).filter(Boolean),
    totalCount,
  };
}

/**
 * Fetches products and aggregations from API Mesh GraphQL.
 * @param {object} config product list configuration
 * @param {object|null} [productFilter] Venia ProductAttributeFilterInput
 * @param {string} [sortKey] sort key
 * @returns {Promise<{
 *   items: object[],
 *   totalCount: number,
 *   aggregations: object[],
 *   source: string,
 *   sortWarning?: string
 * }|null>}
 */
export async function fetchProducts(
  config,
  productFilter = null,
  sortKey = getDefaultSortKey(),
) {
  const { query, variables } = buildProductsQueryRequest(config, productFilter, sortKey);
  let data = await executeGraphqlQuery(config, query, variables);

  let sortWarning;
  if (data?.errors?.length && sortKey === 'brand') {
    sortWarning = 'Brand sort is unavailable; showing products sorted by name.';
    const fallbackRequest = buildProductsQueryRequest(config, productFilter, 'name');
    data = await executeGraphqlQuery(config, fallbackRequest.query, fallbackRequest.variables);
  }

  if (!data || data?.errors?.length) return null;

  const { items, totalCount } = extractProducts(data);
  const aggregations = extractAggregations(data);
  const source = resolveEffectiveGraphqlProxy(config) ? 'proxy' : 'graphql';

  return {
    items,
    totalCount,
    aggregations,
    source,
    sortWarning,
  };
}

/**
 * Fetches products from a same-origin mock JSON endpoint.
 * @param {string} mockEndpoint mock API URL
 * @param {object|null} [productFilter] Venia ProductAttributeFilterInput
 * @param {string} [sortKey] sort key
 * @param {number} [pageSize] max items to return
 * @returns {Promise<{
 *   items: object[], totalCount: number, aggregations: object[], source: string
 * }|null>}
 */
export async function fetchProductsFromMock(
  mockEndpoint,
  productFilter = null,
  sortKey = getDefaultSortKey(),
  pageSize = 12,
) {
  const safeEndpoint = toSafeMockEndpoint(mockEndpoint);
  if (!safeEndpoint) return null;

  const data = await fetchJson(safeEndpoint);
  if (!data) return null;

  const { items } = extractProducts(data);
  const filteredItems = productFilter
    ? items.filter((product) => matchesProductFilter(product, productFilter))
    : items;
  const sortedItems = sortProductsClientSide(filteredItems, sortKey);
  const aggregations = extractAggregations(data);
  const safePageSize = Math.max(1, Math.min(Number(pageSize) || 12, 48));

  return {
    items: sortedItems.slice(0, safePageSize),
    totalCount: filteredItems.length,
    aggregations,
    source: 'mock',
  };
}

/**
 * Loads products from App Builder GraphQL proxy with optional localhost mock fallback.
 * @param {object} config product list configuration
 * @param {object|null} [productFilter] Venia ProductAttributeFilterInput
 * @param {string} [sortKey] sort key
 * @returns {Promise<{
 *   items: object[],
 *   totalCount: number,
 *   aggregations: object[],
 *   source: string,
 *   sortWarning?: string
 * }|null>}
 */
export async function loadProducts(
  config,
  productFilter = null,
  sortKey = getDefaultSortKey(),
) {
  const mockEndpoint = config.mockApiEndpoint || DEFAULT_MOCK_ENDPOINT;

  let graphqlResult = null;
  try {
    graphqlResult = await fetchProducts(config, productFilter, sortKey);
  } catch {
    graphqlResult = null;
  }

  if (isUsableProductResult(graphqlResult)) {
    return graphqlResult;
  }

  if (isLocalDevHost()) {
    return fetchProductsFromMock(mockEndpoint, productFilter, sortKey, config.pageSize);
  }

  return graphqlResult;
}
