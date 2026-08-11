import { WH_DEFAULTS, WH_SSO_STORAGE_KEY } from './wh-config.js';
import { sanitizeText } from './wh-common.js';

/**
 * Reads cached Wyndham SSO session from sessionStorage.
 * @returns {object|null}
 */
export function getWhSession() {
  try {
    const raw = sessionStorage.getItem(WH_SSO_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Stores a lightweight SSO session marker after external sign-in redirect.
 * @param {object} session session payload
 */
export function setWhSession(session) {
  try {
    sessionStorage.setItem(WH_SSO_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore storage errors
  }
}

export function clearWhSession() {
  try {
    sessionStorage.removeItem(WH_SSO_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

/**
 * Returns authored or default Wyndham Rewards sign-in URL.
 * @param {string} [signInUrl] optional override from block config
 * @returns {string}
 */
export function resolveSignInUrl(signInUrl) {
  const candidate = sanitizeText(signInUrl, 2000);
  return candidate || WH_DEFAULTS.signInUrl;
}

/**
 * Opens Wyndham SSO sign-in in the same window.
 * @param {string} [signInUrl] optional override
 */
export function redirectToSignIn(signInUrl) {
  window.location.href = resolveSignInUrl(signInUrl);
}

/**
 * Decorates sign-in links with SSO URL when present in header tools.
 * @param {Element} root root element
 * @param {string} [signInUrl] optional override
 */
export function decorateSignInLinks(root, signInUrl) {
  const url = resolveSignInUrl(signInUrl);
  root.querySelectorAll('[data-wh-signin]').forEach((link) => {
    if (link instanceof HTMLAnchorElement) link.href = url;
  });
}
