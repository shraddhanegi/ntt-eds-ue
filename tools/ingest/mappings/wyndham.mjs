import { convertWyndhamBlocks, isWyndhamHost } from '../lib/wyndham-rules.mjs';

/** @type {import('./types.mjs').DomainMapping} */
export default {
  id: 'wyndham',
  matches: (hostname) => isWyndhamHost(`https://${hostname}/`),
  convertBlocks: convertWyndhamBlocks,
};
