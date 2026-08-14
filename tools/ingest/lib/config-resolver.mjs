/**
 * Resolve ${ENV_VAR} placeholders in config strings.
 * @param {string} value Config value
 * @returns {string}
 */
export function resolveEnvValue(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] || '');
}

/**
 * Resolve all env placeholders in a sharepoint config object.
 * @param {object} spConfig SharePoint config section
 * @returns {object}
 */
export function resolveSharePointConfig(spConfig = {}) {
  const resolved = {};
  Object.entries(spConfig).forEach(([key, value]) => {
    resolved[key] = typeof value === 'string' ? resolveEnvValue(value) : value;
  });
  return resolved;
}

/**
 * Validate required SharePoint credentials are present.
 * @param {object} spConfig Resolved SharePoint config
 */
export function assertSharePointConfig(spConfig) {
  const required = ['tenantId', 'clientId', 'clientSecret', 'siteId', 'driveId'];
  const missing = required.filter((key) => !spConfig[key]);
  if (missing.length) {
    throw new Error(
      `SharePoint upload requires env vars: ${missing.map((k) => {
        const map = {
          tenantId: 'AZURE_TENANT_ID',
          clientId: 'AZURE_CLIENT_ID',
          clientSecret: 'AZURE_CLIENT_SECRET',
          siteId: 'SP_SITE_ID',
          driveId: 'SP_DRIVE_ID',
        };
        return map[k];
      }).join(', ')}`,
    );
  }
}
