/**
 * WCAG 2.1 relative luminance and contrast utilities.
 */

/**
 * @param {string} hex #rrggbb
 * @returns {number} 0–1
 */
function relativeLuminance(hex) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return 0.5;
  const channels = [0, 2, 4].map((i) => {
    const val = parseInt(normalized.slice(i, i + 2), 16) / 255;
    return val <= 0.03928 ? val / 12.92 : ((val + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/**
 * @param {string} fg Foreground hex
 * @param {string} bg Background hex
 * @returns {number}
 */
export function contrastRatio(fg, bg) {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pick readable text color for a background (AA 4.5:1).
 * @param {string} bgHex Background color
 * @param {string} [preferredText] Preferred text color
 * @param {string} [fallbackText] Fallback if contrast fails
 * @returns {string}
 */
export function ensureReadableText(bgHex, preferredText = '#333333', fallbackText = '#ffffff') {
  if (!bgHex || !bgHex.startsWith('#')) return preferredText;
  if (contrastRatio(preferredText, bgHex) >= 4.5) return preferredText;
  if (contrastRatio(fallbackText, bgHex) >= 4.5) return fallbackText;
  return contrastRatio('#000000', bgHex) >= contrastRatio('#ffffff', bgHex) ? '#000000' : '#ffffff';
}

/**
 * Normalize rgb()/hex string to #rrggbb.
 * @param {string|null} color CSS color value
 * @returns {string|null}
 */
export function normalizeHex(color) {
  if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null;
  if (color.startsWith('#')) {
    if (color.length === 4) {
      return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
    }
    return color.slice(0, 7);
  }
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  const hex = [match[1], match[2], match[3]]
    .map((n) => parseInt(n, 10).toString(16).padStart(2, '0'))
    .join('');
  return `#${hex}`;
}

/**
 * Darken a hex color by mixing with black.
 * @param {string} hex Color
 * @param {number} amount 0–1
 * @returns {string}
 */
export function darkenHex(hex, amount = 0.15) {
  const normalized = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(normalized.slice(i, i + 2), 16));
  const mixed = channels.map((c) => Math.round(c * (1 - amount)));
  return `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
