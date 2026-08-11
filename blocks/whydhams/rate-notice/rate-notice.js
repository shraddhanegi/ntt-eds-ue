import { readSetting } from '../../../scripts/whydham/wh-common.js';

const VARIANTS = new Set(['info', 'warning']);

/**
 * Decorates the Wyndham rate notice, used for resort fee and rate disclaimers.
 * @param {Element} block rate notice block element
 */
export default function decorate(block) {
  const message = readSetting(block, 'message')
    || [...block.querySelectorAll('p')].map((p) => p.textContent.trim()).filter(Boolean).join(' ');
  const variant = readSetting(block, 'variant', 'info').toLowerCase();

  block.replaceChildren();
  if (!message) return;

  block.classList.add(`wh-rate-notice-${VARIANTS.has(variant) ? variant : 'info'}`);

  const inner = document.createElement('div');
  inner.className = 'wh-rate-notice-inner';
  const text = document.createElement('p');
  text.className = 'wh-rate-notice-text';
  text.textContent = message;
  inner.append(text);
  block.append(inner);
}
