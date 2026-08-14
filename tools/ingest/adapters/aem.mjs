import fs from 'fs/promises';
import path from 'path';
import { defaultProjectName, resolveProjectRoot } from '../lib/project-root.mjs';

/**
 * Universal Editor (AEM) storage adapter — stages content locally for AEM import.
 * Generated HTML uses aem.publicPrefix paths (same structure as da.live content).
 *
 * Push staged content to AEM Cloud with:
 *   npx aem-import-helper aem upload --zip=... --token=$AEM_IMPORT_TOKEN --target=$AEM_TARGET
 *
 * @param {object} config Ingest config
 * @param {object} [overrides]
 * @param {string} [overrides.outputRoot] Absolute staging root
 * @param {string} [overrides.publicPrefix] URL prefix in generated HTML
 * @returns {import('./storage-interface.mjs').StorageAdapter}
 */
export function createAemAdapter(config = {}, overrides = {}) {
  const projectRoot = resolveProjectRoot(config);
  const projectName = config.projectName || defaultProjectName(config);
  const aemConfig = config.aem || {};
  const configuredRoot = overrides.outputRoot || aemConfig.outputRoot;
  let outputRoot = path.join(projectRoot, 'aem-content', projectName);
  if (configuredRoot) {
    outputRoot = path.isAbsolute(configuredRoot)
      ? configuredRoot
      : path.join(projectRoot, configuredRoot);
  }
  const publicPrefix = (overrides.publicPrefix
    || aemConfig.publicPrefix
    || `/${projectName}`).replace(/\/$/, '');

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
