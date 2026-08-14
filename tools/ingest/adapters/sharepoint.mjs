import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js';
import { assertSharePointConfig, resolveSharePointConfig } from '../lib/config-resolver.mjs';
import { defaultProjectName } from '../lib/project-root.mjs';

const MIME_TYPES = {
  html: 'text/html',
  plain: 'text/html',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
};

/**
 * Guess MIME type from file path.
 * @param {string} filePath File path
 * @returns {string}
 */
function mimeFromPath(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Create authenticated Microsoft Graph client.
 * @param {object} spConfig Resolved SharePoint config
 * @returns {Client}
 */
function createGraphClient(spConfig) {
  const credential = new ClientSecretCredential(
    spConfig.tenantId,
    spConfig.clientId,
    spConfig.clientSecret,
  );
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  });
  return Client.initWithMiddleware({ authProvider });
}

/**
 * SharePoint storage adapter — uploads via Microsoft Graph drive API.
 * Files land under {rootFolder}/{relativePath} in the document library synced to da.live.
 *
 * @param {object} config Ingest config (projectName + sharepoint section)
 * @returns {import('./storage-interface.mjs').StorageAdapter}
 */
export function createSharePointAdapter(config = {}) {
  const spConfig = resolveSharePointConfig(config.sharepoint || {});
  assertSharePointConfig(spConfig);

  const projectName = config.projectName || defaultProjectName(config);
  const rootFolder = (spConfig.rootFolder || projectName).replace(/^\/|\/$/g, '');
  const publicPrefix = (spConfig.publicPrefix ?? `/${rootFolder}`).replace(/\/$/, '');
  const client = createGraphClient(spConfig);
  const { siteId, driveId } = spConfig;

  /**
   * Map ingest-relative path to SharePoint drive path.
   * @param {string} relativePath e.g. pages/slug/media/foo.jpg
   * @returns {string}
   */
  const toDrivePath = (relativePath) => {
    const normalized = relativePath.replace(/\\/g, '/').replace(/^\//, '');
    return `${rootFolder}/${normalized}`.replace(/\/+/g, '/');
  };

  /**
   * Public path written into generated HTML for da.live resolution.
   * @param {string} relativePath Ingest-relative path
   * @returns {string}
   */
  const toPublicPath = (relativePath) => {
    const normalized = relativePath.replace(/\\/g, '/').replace(/^\//, '');
    return `${publicPrefix}/${normalized}`.replace(/\/+/g, '/');
  };

  return {
    getPublicPathPrefix() {
      return publicPrefix;
    },

    async ensureFolder() {
      // Microsoft Graph creates parent folders automatically on content upload.
    },

    async uploadAsset(buffer, relativePath) {
      const drivePath = toDrivePath(relativePath);
      const contentType = mimeFromPath(relativePath);

      await client
        .api(`/sites/${siteId}/drives/${driveId}/root:/${drivePath}:/content`)
        .header('Content-Type', contentType)
        .put(buffer);

      return toPublicPath(relativePath);
    },

    async uploadDocument(content, relativePath) {
      const drivePath = toDrivePath(relativePath);
      const buffer = Buffer.from(content, 'utf8');

      await client
        .api(`/sites/${siteId}/drives/${driveId}/root:/${drivePath}:/content`)
        .header('Content-Type', 'text/html; charset=utf-8')
        .put(buffer);

      return toPublicPath(relativePath);
    },
  };
}
