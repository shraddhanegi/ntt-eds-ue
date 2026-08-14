/**
 * Upload the same assets and documents to multiple storage backends (e.g. DA + UE).
 * All adapters must agree on getPublicPathPrefix() — enforced at creation time.
 *
 * @param {import('./storage-interface.mjs').StorageAdapter[]} adapters
 * @param {string} publicPrefix Shared public path prefix for generated HTML
 * @returns {import('./storage-interface.mjs').StorageAdapter}
 */
export function createCompositeAdapter(adapters, publicPrefix) {
  if (!adapters?.length) {
    throw new Error('Composite storage adapter requires at least one backend');
  }

  const prefixes = adapters.map((adapter) => adapter.getPublicPathPrefix());
  const unique = [...new Set(prefixes)];
  if (unique.length > 1) {
    throw new Error(
      `Composite adapter backends disagree on publicPrefix: ${unique.join(', ')}`,
    );
  }

  const resolvedPrefix = publicPrefix || unique[0];

  return {
    getPublicPathPrefix() {
      return resolvedPrefix;
    },

    async ensureFolder(relativePath) {
      await Promise.all(adapters.map((adapter) => adapter.ensureFolder(relativePath)));
    },

    async uploadAsset(buffer, relativePath, contentType) {
      const results = await Promise.all(
        adapters.map((adapter) => adapter.uploadAsset(buffer, relativePath, contentType)),
      );
      return results[0];
    },

    async uploadDocument(content, relativePath) {
      const results = await Promise.all(
        adapters.map((adapter) => adapter.uploadDocument(content, relativePath)),
      );
      return results[0];
    },
  };
}
