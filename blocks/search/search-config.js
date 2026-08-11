import {
  sanitizeSearchQueryParam,
  toSafeSameOriginFetchUrl,
  toSafeSameOriginPath,
  toSafeSuggestFetchUrl,
} from '../../scripts/api/search-api.js';

const DEFAULTS = {
  recentSearchLimit: 3,
  trendingLimit: 5,
  searchQueryParam: 'q',
  queryIndexSource: '/query-index.json',
  suggestApiEndpoint: 'https://120642-edsapi-stage.adobeio-static.net/api/v1/web/api-mesh/api-mesh-graphql',
};

const MAX_LIST_LIMIT = 50;

const CONFIG_KEY_ALIASES = {
  resultpageurl: 'resultPageUrl',
  searchresultspage: 'resultPageUrl',
  queryindexsource: 'queryIndexSource',
  queryindex: 'queryIndexSource',
  trendingapiendpoint: 'trendingApiEndpoint',
  trendinglimit: 'trendingLimit',
  recentsearchlimit: 'recentSearchLimit',
  suggestapiendpoint: 'suggestApiEndpoint',
  autosuggestapiendpoint: 'suggestApiEndpoint',
  searchqueryparam: 'searchQueryParam',
};

function normalizeConfigKey(key) {
  return key.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function readFieldText(field) {
  if (!field) return '';
  const link = field.querySelector('a[href]');
  if (link) return link.href;
  return field.textContent.trim();
}

function readFieldNumber(field, fallback, max = MAX_LIST_LIMIT) {
  const value = Number.parseInt(readFieldText(field), 10);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(value, max);
}

function readKeyValueConfig(block) {
  const config = {};
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (cells.length < 2) return;
    const key = cells[0].textContent.trim();
    const value = readFieldText(cells[1]);
    if (!key || !value) return;

    const configKey = CONFIG_KEY_ALIASES[normalizeConfigKey(key)];
    if (!configKey) return;

    if (configKey === 'trendingLimit' || configKey === 'recentSearchLimit') {
      config[configKey] = Number.parseInt(value, 10);
    } else {
      config[configKey] = value;
    }
  });
  return config;
}

/**
 * Reads authored search block configuration.
 * @param {Element} block search block element
 * @returns {object} search configuration
 */
export default function readSearchConfig(block) {
  const keyValueConfig = readKeyValueConfig(block);

  const config = {
    resultPageUrl: readFieldText(block.querySelector('[data-aue-prop="resultPageUrl"]'))
      || keyValueConfig.resultPageUrl
      || readFieldText(block.querySelector('[data-aue-prop="searchUrl"]')),
    queryIndexSource: readFieldText(block.querySelector('[data-aue-prop="queryIndexSource"]'))
      || keyValueConfig.queryIndexSource
      || DEFAULTS.queryIndexSource,
    trendingApiEndpoint: readFieldText(block.querySelector('[data-aue-prop="trendingApiEndpoint"]'))
      || keyValueConfig.trendingApiEndpoint,
    trendingLimit: readFieldNumber(
      block.querySelector('[data-aue-prop="trendingLimit"]'),
      keyValueConfig.trendingLimit || DEFAULTS.trendingLimit,
    ),
    recentSearchLimit: readFieldNumber(
      block.querySelector('[data-aue-prop="recentSearchLimit"]'),
      keyValueConfig.recentSearchLimit || DEFAULTS.recentSearchLimit,
    ),
    suggestApiEndpoint: readFieldText(block.querySelector('[data-aue-prop="suggestApiEndpoint"]'))
      || keyValueConfig.suggestApiEndpoint
      || DEFAULTS.suggestApiEndpoint,
    searchQueryParam: readFieldText(block.querySelector('[data-aue-prop="searchQueryParam"]'))
      || keyValueConfig.searchQueryParam
      || DEFAULTS.searchQueryParam,
  };

  return {
    ...config,
    resultPageUrl: toSafeSameOriginPath(config.resultPageUrl, ''),
    queryIndexSource: toSafeSameOriginFetchUrl(config.queryIndexSource, DEFAULTS.queryIndexSource),
    trendingApiEndpoint: toSafeSameOriginFetchUrl(config.trendingApiEndpoint, ''),
    suggestApiEndpoint: toSafeSuggestFetchUrl(
      config.suggestApiEndpoint,
      DEFAULTS.suggestApiEndpoint,
    ),
    searchQueryParam: sanitizeSearchQueryParam(config.searchQueryParam, DEFAULTS.searchQueryParam),
    trendingLimit: Math.min(config.trendingLimit || DEFAULTS.trendingLimit, MAX_LIST_LIMIT),
    recentSearchLimit: Math.min(
      config.recentSearchLimit || DEFAULTS.recentSearchLimit,
      MAX_LIST_LIMIT,
    ),
  };
}
