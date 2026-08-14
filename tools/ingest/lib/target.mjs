import path from 'path';
import { createLocalAdapter } from '../adapters/local.mjs';
import { createSharePointAdapter } from '../adapters/sharepoint.mjs';
import { createAemAdapter } from '../adapters/aem.mjs';
import { createCompositeAdapter } from '../adapters/composite.mjs';
import { assertSharePointConfig, resolveSharePointConfig } from './config-resolver.mjs';
import { defaultOutputRoot, defaultProjectName } from './project-root.mjs';

/** Supported ingest storage targets. */
export const VALID_TARGETS = ['local', 'da', 'aem', 'both'];

/** CLI aliases for backward compatibility. */
export const TARGET_ALIASES = {
  sharepoint: 'da',
  ue: 'aem',
  'document-authoring': 'da',
  'universal-editor': 'aem',
};

/**
 * Normalize and validate --target value.
 * @param {string} raw Raw CLI value
 * @returns {'local'|'da'|'aem'|'both'}
 */
export function normalizeTarget(raw) {
  const value = String(raw || '').toLowerCase().trim();
  const normalized = TARGET_ALIASES[value] || value;
  if (!VALID_TARGETS.includes(normalized)) {
    throw new Error(
      `Invalid --target "${raw}". Required. Use one of: ${VALID_TARGETS.join(', ')} `
      + '(aliases: sharepoint→da, ue→aem)',
    );
  }
  return normalized;
}

/**
 * Human-readable label for logging.
 * @param {'local'|'da'|'aem'|'both'} target
 * @returns {string}
 */
export function targetLabel(target) {
  const labels = {
    local: 'local drafts (dev preview)',
    da: 'Document Authoring (SharePoint → da.live)',
    aem: 'Universal Editor (AEM content staging)',
    both: 'Document Authoring + Universal Editor',
  };
  return labels[target] || target;
}

/**
 * Whether theme CSS should be mirrored to styles/themes/ for local preview.
 * @param {'local'|'da'|'aem'|'both'} target
 * @returns {boolean}
 */
export function shouldMirrorThemeToRepo(target) {
  return target === 'local' || target === 'aem' || target === 'both';
}

/**
 * Resolve public path prefix shared by DA and AEM when uploading to both.
 * @param {object} config Ingest config
 * @returns {string}
 */
function resolveSharedPublicPrefix(config) {
  const spPrefix = resolveSharePointConfig(config.sharepoint || {}).publicPrefix;
  const aemPrefix = config.aem?.publicPrefix;
  const fallback = `/${config.projectName || defaultProjectName(config)}`;
  return (spPrefix || aemPrefix || config.publicPrefix || fallback).replace(/\/$/, '');
}

/**
 * Assert both targets use the same public URL prefix in generated HTML.
 * @param {object} config Ingest config
 */
function assertDualTargetPaths(config) {
  const spConfig = resolveSharePointConfig(config.sharepoint || {});
  const spPrefix = (spConfig.publicPrefix ?? `/${spConfig.rootFolder || config.projectName}`).replace(/\/$/, '');
  const aemPrefix = (config.aem?.publicPrefix || spPrefix).replace(/\/$/, '');
  if (spPrefix !== aemPrefix) {
    throw new Error(
      `For --target=both, sharepoint.publicPrefix (${spPrefix}) must match aem.publicPrefix (${aemPrefix})`,
    );
  }
}

/**
 * Create storage adapter(s) for the requested authoring target.
 * @param {'local'|'da'|'aem'|'both'} target
 * @param {object} config Ingest config
 * @returns {import('../adapters/storage-interface.mjs').StorageAdapter}
 */
export function createStorageForTarget(target, config = {}) {
  const outputRoot = config.outputRoot || defaultOutputRoot(config);
  const publicPrefix = (config.publicPrefix || '/drafts/ingest').replace(/\/$/, '');

  switch (target) {
    case 'local':
      return createLocalAdapter({ outputRoot, publicPrefix });

    case 'da': {
      assertSharePointConfig(resolveSharePointConfig(config.sharepoint || {}));
      return createSharePointAdapter(config);
    }

    case 'aem':
      return createAemAdapter(config, {
        outputRoot,
        publicPrefix: resolveSharedPublicPrefix(config),
      });

    case 'both': {
      assertSharePointConfig(resolveSharePointConfig(config.sharepoint || {}));
      assertDualTargetPaths(config);
      const sharedPrefix = resolveSharedPublicPrefix(config);
      return createCompositeAdapter([
        createSharePointAdapter(config),
        createAemAdapter(config, { publicPrefix: sharedPrefix }),
      ], sharedPrefix);
    }

    default:
      throw new Error(`Unsupported target "${target}"`);
  }
}
