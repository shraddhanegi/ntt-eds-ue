import { spawnSync } from 'child_process';
import { resolveEnvValue } from '../lib/config-resolver.mjs';
import { resolveProjectRoot } from '../lib/project-root.mjs';

/**
 * Resolve AEM import credentials from env or config.
 * @param {object} config Ingest config
 * @returns {{ token: string, target: string }}
 */
export function resolveAemPushConfig(config = {}) {
  const aem = config.aem || {};
  const token = resolveEnvValue(aem.importToken || '') || process.env.AEM_IMPORT_TOKEN || '';
  const target = resolveEnvValue(aem.importTarget || '') || process.env.AEM_TARGET || '';
  return { token, target };
}

/**
 * Upload content package ZIP to AEM Cloud via aem-import-helper.
 * @param {string} zipPath Absolute path to package zip
 * @param {object} [config={}] Ingest config
 * @returns {boolean} True when upload command succeeded
 */
export function pushAemPackage(zipPath, config = {}) {
  const { token, target } = resolveAemPushConfig(config);
  if (!token || !target) {
    throw new Error('AEM push requires AEM_IMPORT_TOKEN and AEM_TARGET in .env or config.aem');
  }

  const result = spawnSync(
    'npx',
    [
      'aem-import-helper',
      'aem',
      'upload',
      `--zip=${zipPath}`,
      `--token=${token}`,
      `--target=${target}`,
    ],
    { stdio: 'inherit', shell: true, cwd: resolveProjectRoot(config) },
  );

  return result.status === 0;
}
