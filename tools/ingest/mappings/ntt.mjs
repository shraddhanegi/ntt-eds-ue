import { convertNttBlocks } from '../lib/import-rules.mjs';

/** @type {import('./types.mjs').DomainMapping} */
export default {
  id: 'ntt',
  matches: (hostname) => (
    hostname.includes('nttdata.com')
    || hostname.includes('ntt.com')
    || hostname.endsWith('.ntt.eu')
  ),
  convertBlocks: convertNttBlocks,
};
