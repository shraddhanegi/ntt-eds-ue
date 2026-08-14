/**
 * Collect absolute media URLs (images, video, animated assets) from DOM.
 * @param {Element} root Root element
 * @param {string} baseUrl Page base URL
 * @returns {string[]}
 */
export function collectMediaUrls(root, baseUrl) {
  const urls = new Set();

  const addUrl = (raw) => {
    if (!raw || raw.startsWith('data:')) return;
    try {
      urls.add(new URL(raw, baseUrl).href);
    } catch {
      urls.add(raw);
    }
  };

  root.querySelectorAll('img[src]').forEach((img) => addUrl(img.getAttribute('src')));
  root.querySelectorAll('video[src], video source[src]').forEach((el) => addUrl(el.getAttribute('src')));
  root.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href') || '';
    if (/\.(gif|mp4|webm|mov)(\?|$)/i.test(href)) addUrl(href);
  });

  return [...urls];
}

/** @deprecated Use collectMediaUrls */
export const collectImageUrls = collectMediaUrls;
