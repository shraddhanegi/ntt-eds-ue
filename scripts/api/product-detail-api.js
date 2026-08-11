import fetchJson from './fetch-json.js';
import {
  buildGraphqlHeaders,
  toSafeMockEndpoint,
  DEFAULT_APP_BUILDER_GRAPHQL_PROXY,
} from './product-list-api.js';

const DEFAULT_MOCK_ENDPOINT = '/drafts/mock-product-detail.json';

/** App Builder proxy for product detail requests (CORS-enabled for *.aem.page). */
export const DEFAULT_APP_BUILDER_PRODUCT_DETAIL_PROXY = 'https://120642-edsapi-stage.adobeio-static.net/api/v1/web/api-mesh/api-mesh-product-detail';

const PRODUCT_DETAIL_QUERY = `
  query ProductDetailBySku($sku: String!) {
    products(filter: { sku: { eq: $sku } }) {
      items {
        sku
        name
        url_key
        stock_status
        categories { name url_path }
        description { html }
        short_description { html }
        image { url label }
        media_gallery { url label }
        price_range {
          minimum_price {
            final_price { value currency }
            regular_price { value currency }
          }
        }
      }
    }
  }
`;

function sanitizeText(value, maxLength = 500) {
  if (value == null) return '';
  return String(value).trim().slice(0, maxLength);
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
 * Validates an App Builder web action URL for product detail requests.
 * @param {string} value proxy URL from block authoring
 * @returns {string}
 */
export function toSafeProductDetailProxyUrl(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return '';

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:') return '';
    const host = url.hostname;
    const isAppBuilderHost = host.endsWith('.adobeio-static.net') || host.endsWith('.adobeioruntime.net');
    if (!isAppBuilderHost) return '';
    if (!url.pathname.includes('api-mesh-product-detail')) return '';
    return url.origin + url.pathname;
  } catch {
    return '';
  }
}

/**
 * Reads the product SKU from the page URL query string.
 * @param {string} [queryParam='sku'] query parameter name
 * @returns {string}
 */
export function readSkuFromUrl(queryParam = 'sku') {
  const safeParam = sanitizeText(queryParam, 64) || 'sku';
  const params = new URLSearchParams(window.location.search);
  return sanitizeText(params.get(safeParam), 64);
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
 * Extracts a product record from API or GraphQL payloads.
 * @param {object} payload API response
 * @returns {object|null}
 */
export function extractProductPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;

  if (payload.error?.body?.error) return null;

  const body = payload.body ?? payload;

  if (body?.error) return null;

  if (body?.sku && body?.name) return body;

  const graphqlItem = body?.data?.products?.items?.[0]
    || body?.products?.items?.[0]
    || payload?.data?.products?.items?.[0];
  if (graphqlItem) return graphqlItem;

  return null;
}

/**
 * Normalizes a Commerce/Venia product detail record.
 * @param {object} item raw product item
 * @returns {object|null}
 */
export function normalizeProductDetail(item) {
  if (!item || typeof item !== 'object') return null;

  const finalPrice = item.price_range?.minimum_price?.final_price;
  const regularPrice = item.price_range?.minimum_price?.regular_price;
  const imageUrl = sanitizeUrl(item.image?.url);
  const gallery = (item.media_gallery || [])
    .map((entry) => ({
      label: sanitizeText(entry?.label, 120),
      url: sanitizeUrl(entry?.url),
    }))
    .filter((entry) => entry.url);

  const categories = (item.categories || [])
    .map((category) => ({
      name: sanitizeText(category?.name, 120),
      urlPath: sanitizeText(category?.url_path, 200),
    }))
    .filter((category) => category.name);

  return {
    sku: sanitizeText(item.sku, 64),
    name: sanitizeText(item.name, 200),
    urlKey: sanitizeText(item.url_key, 200),
    stockStatus: sanitizeText(item.stock_status, 32),
    imageUrl: imageUrl || gallery[0]?.url || '',
    imageLabel: sanitizeText(item.image?.label, 120) || sanitizeText(item.name, 200),
    gallery,
    categories,
    descriptionHtml: item.description?.html || '',
    shortDescriptionHtml: item.short_description?.html || '',
    priceLabel: formatPrice(finalPrice),
    regularPriceLabel: formatPrice(regularPrice),
    onSale: Boolean(
      finalPrice?.value != null
      && regularPrice?.value != null
      && Number(finalPrice.value) < Number(regularPrice.value),
    ),
  };
}

async function parseProxyResponse(response) {
  if (!response.ok) return null;

  let json;
  try {
    json = await response.json();
  } catch {
    return null;
  }

  if (json?.error) return null;

  const rawProduct = extractProductPayload(json);
  if (!rawProduct) return null;

  return normalizeProductDetail(rawProduct);
}

async function fetchProductDetailViaRestProxy(proxyEndpoint, sku, config) {
  const requestUrl = new URL(proxyEndpoint);
  requestUrl.searchParams.set('sku', sku);

  const getResponse = await fetch(requestUrl.toString(), {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    headers: { Accept: 'application/json' },
  });

  const fromGet = await parseProxyResponse(getResponse);
  if (fromGet) return fromGet;

  const headers = buildGraphqlHeaders(config);
  const postResponse = await fetch(proxyEndpoint, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    headers,
    body: JSON.stringify({ sku }),
  });

  return parseProxyResponse(postResponse);
}

async function fetchProductDetailViaGraphqlProxy(sku, config) {
  const headers = buildGraphqlHeaders(config);

  const response = await fetch(DEFAULT_APP_BUILDER_GRAPHQL_PROXY, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    headers,
    body: JSON.stringify({
      query: PRODUCT_DETAIL_QUERY,
      variables: { sku },
    }),
  });

  return parseProxyResponse(response);
}

/**
 * Fetches a single product by SKU from the App Builder product detail proxy.
 * @param {object} config product detail configuration
 * @param {string} sku product SKU
 * @returns {Promise<object|null>}
 */
export async function fetchProductDetail(config, sku) {
  const safeSku = sanitizeText(sku, 64);
  if (!safeSku) return null;

  const proxyEndpoint = toSafeProductDetailProxyUrl(config?.productDetailProxyEndpoint)
    || DEFAULT_APP_BUILDER_PRODUCT_DETAIL_PROXY;

  const fromRest = await fetchProductDetailViaRestProxy(proxyEndpoint, safeSku, config);
  if (fromRest) return fromRest;

  return fetchProductDetailViaGraphqlProxy(safeSku, config);
}

/**
 * Loads a product from mock JSON for local development.
 * @param {string} mockEndpoint mock API URL
 * @param {string} sku product SKU
 * @returns {Promise<object|null>}
 */
export async function fetchProductDetailFromMock(mockEndpoint, sku) {
  const safeEndpoint = toSafeMockEndpoint(mockEndpoint);
  const safeSku = sanitizeText(sku, 64);
  if (!safeEndpoint || !safeSku) return null;

  const data = await fetchJson(safeEndpoint);
  const rawProduct = extractProductPayload(data);
  if (!rawProduct) return null;

  const normalized = normalizeProductDetail(rawProduct);
  if (!normalized) return null;

  if (normalized.sku.toLowerCase() !== safeSku.toLowerCase()) return null;

  return normalized;
}

/**
 * Loads product detail from API Mesh with localhost mock fallback.
 * @param {object} config product detail configuration
 * @param {string} sku product SKU
 * @returns {Promise<object|null>}
 */
export async function loadProductDetail(config, sku) {
  const apiResult = await fetchProductDetail(config, sku);
  if (apiResult) return apiResult;

  const mockEndpoint = config.mockApiEndpoint || DEFAULT_MOCK_ENDPOINT;
  if (window.location.hostname.includes('localhost')) {
    return fetchProductDetailFromMock(mockEndpoint, sku);
  }

  return null;
}
