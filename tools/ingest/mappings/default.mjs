import { convertNttBlocks } from '../lib/import-rules.mjs';

/** @type {import('./types.mjs').DomainMapping} */
export default {
  id: 'default',
  matches: () => true,
  convertBlocks: convertNttBlocks,
};
