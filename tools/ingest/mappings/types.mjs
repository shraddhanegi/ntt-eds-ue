/**
 * @typedef {object} DomainMapping
 * @property {string} id Mapping identifier (used in ingest reports)
 * @property {(hostname: string, url: string) => boolean} matches
 * @property {(main: Element, document: Document, url: string, WebImporter: object) => void} convertBlocks
 */

export {};
