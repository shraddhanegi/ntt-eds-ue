import { loadCSS } from '../aem.js';

/** Maps block class names to nested paths under blocks/whydhams/. */
export const WH_BLOCK_PATHS = {
  'wh-logo': 'whydhams/logo/logo',
  'wh-header': 'whydhams/header/header',
  'wh-hero-container': 'whydhams/hero-container/hero-container',
  'wh-intro-container': 'whydhams/intro-container/intro-container',
  'wh-icons': 'whydhams/icons/icons',
  'wh-quad': 'whydhams/quad/quad',
  'wh-quad-alternate': 'whydhams/quad-alternate/quad-alternate',
  'wh-testimonials': 'whydhams/testimonials/testimonials',
};

export function isWhBlockName(name) {
  return Boolean(WH_BLOCK_PATHS[name]);
}

/**
 * Claims Wyndham blocks so the core loader does not look for them at
 * /blocks/{className}/, and activates the Wyndham theme.
 * @param {Element} root container element
 */
export function decorateWhBlocks(root) {
  let found = false;

  Object.keys(WH_BLOCK_PATHS).forEach((className) => {
    root.querySelectorAll(`div.${className}:not([data-wh-block])`).forEach((block) => {
      found = true;
      block.dataset.whBlock = className;

      // A block status other than "initialized" keeps aem.js from claiming the block,
      // and omitting the "block" class keeps it out of the core section loader.
      block.dataset.blockStatus = 'wh-pending';

      const wrapper = block.parentElement;
      if (wrapper && wrapper !== block) wrapper.classList.add(`${className}-wrapper`);
    });
  });

  if (!found) return;
  document.body.classList.add('whydham');
  loadCSS(`${window.hlx.codeBasePath}/styles/whydham.css`);
}

/**
 * Loads JS and CSS for a Wyndham block.
 * @param {Element} block block element
 */
export async function loadWhBlock(block) {
  const blockName = block.dataset.whBlock;
  const blockPath = WH_BLOCK_PATHS[blockName];
  if (!blockPath) return block;

  const status = block.dataset.blockStatus;
  if (status === 'loading' || status === 'loaded') return block;

  block.dataset.blockStatus = 'loading';
  const cssLoaded = loadCSS(`${window.hlx.codeBasePath}/blocks/${blockPath}.css`);

  try {
    const mod = await import(`${window.hlx.codeBasePath}/blocks/${blockPath}.js`);
    if (mod.default) await mod.default(block);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`failed to load Wyndham block ${blockName}`, error);
  }

  await cssLoaded;
  block.dataset.blockStatus = 'loaded';
  return block;
}

/**
 * Loads every claimed Wyndham block inside a container.
 * @param {Document|Element} root document or container element
 */
export async function loadWhBlocks(root = document) {
  const blocks = [...root.querySelectorAll('[data-wh-block]')];
  await Promise.all(blocks.map((block) => loadWhBlock(block)));
}
