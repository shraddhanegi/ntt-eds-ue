import fs from 'fs/promises';
import path from 'path';
import { defaultOutputRoot } from '../lib/project-root.mjs';

/**
 * Local storage adapter — mirrors SharePoint layout under drafts/ingest/.
 * @param {object} config
 * @param {string} [config.outputRoot] Absolute output root (default drafts/ingest)
 * @param {string} [config.publicPrefix] URL prefix in generated HTML (default /ingest)
 * @returns {import('./storage-interface.mjs').StorageAdapter}
 */
export function createLocalAdapter(config = {}) {
  const outputRoot = config.outputRoot || defaultOutputRoot(config);
  const publicPrefix = (config.publicPrefix || '/drafts/ingest').replace(/\/$/, '');

  const resolvePath = (relativePath) => path.join(outputRoot, relativePath.replace(/^\//, ''));

  return {
    getPublicPathPrefix() {
      return publicPrefix;
    },

    async ensureFolder(relativePath) {
      const dir = resolvePath(relativePath);
      await fs.mkdir(dir, { recursive: true });
    },

    async uploadAsset(buffer, relativePath) {
      const filePath = resolvePath(relativePath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, buffer);
      const normalized = relativePath.replace(/\\/g, '/').replace(/^\//, '');
      return `${publicPrefix}/${normalized}`;
    },

    async uploadDocument(content, relativePath) {
      const filePath = resolvePath(relativePath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf8');
      const normalized = relativePath.replace(/\\/g, '/').replace(/^\//, '');
      return `${publicPrefix}/${normalized}`;
    },
  };
}
