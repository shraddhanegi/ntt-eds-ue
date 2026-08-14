/**
 * Sanitize asset filenames for DAM / SharePoint upload.
 * @param {string} name Raw filename or URL segment
 * @returns {string}
 */
export function sanitizeFilename(name) {
  const base = String(name || 'asset')
    .split(/[/?#]/).pop()
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/[%20_]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'asset';
}

/**
 * Pick file extension from URL or content-type.
 * @param {string} url Source URL
 * @param {string} [contentType] Response content-type
 * @returns {string}
 */
export function inferExtension(url, contentType = '') {
  const fromUrl = url.match(/\.(jpe?g|png|gif|webp|svg|mp4)(\?|$)/i);
  if (fromUrl) return fromUrl[1].toLowerCase().replace('jpeg', 'jpg');
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  if (contentType.includes('svg')) return 'svg';
  if (contentType.includes('mp4')) return 'mp4';
  if (contentType.includes('webm')) return 'webm';
  return 'jpg';
}
