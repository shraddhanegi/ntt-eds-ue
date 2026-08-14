/**
 * Storage adapter contract for ingest pipeline.
 * Assets upload before HTML compile; HTML uploads last.
 */

/**
 * @typedef {object} StorageAdapter
 * @property {(relativePath: string) => Promise<void>} ensureFolder
 * @property {(buffer: Buffer, relativePath: string, contentType?: string) => Promise<string>} uploadAsset
 * @property {(content: string, relativePath: string) => Promise<string>} uploadDocument
 * @property {() => string} getPublicPathPrefix Public URL path prefix for asset refs in HTML
 */

export {};
