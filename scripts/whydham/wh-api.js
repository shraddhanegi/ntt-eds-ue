import fetchJson from '../api/fetch-json.js';
import { sanitizeText } from './wh-common.js';

/**
 * Wyndham booking / content API wrapper.
 * Extend endpoints when App Builder or Synxis integration is available.
 */
export async function whFetch(endpoint, options = {}) {
  const safeEndpoint = sanitizeText(endpoint, 2000);
  if (!safeEndpoint) return null;

  try {
    const response = await fetch(safeEndpoint, {
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function whFetchJson(endpoint) {
  return fetchJson(endpoint);
}
