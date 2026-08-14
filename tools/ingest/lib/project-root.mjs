import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const libDir = path.dirname(fileURLToPath(import.meta.url));
/** Absolute path to the ingest package root (tools/ingest when embedded, or node_modules/@ntt/eds-url-ingest). */
export const packageRoot = path.resolve(libDir, '..');

/**
 * Resolve the host EDS project root (where drafts/, styles/, fstab live).
 * Priority: config.projectRoot → EDS_PROJECT_ROOT env → process.cwd()
 * @param {object} [config={}] Ingest config
 * @returns {string}
 */
export function resolveProjectRoot(config = {}) {
  if (config.projectRoot) {
    return path.resolve(config.projectRoot);
  }
  if (process.env.EDS_PROJECT_ROOT) {
    return path.resolve(process.env.EDS_PROJECT_ROOT);
  }
  return process.cwd();
}

/**
 * Default ingest output folder under the host project.
 * @param {object} [config={}] Ingest config
 * @returns {string}
 */
export function defaultOutputRoot(config = {}) {
  return path.join(resolveProjectRoot(config), 'drafts', 'ingest');
}

/**
 * Host project themes directory (styles/themes/).
 * @param {object} [config={}] Ingest config
 * @returns {string}
 */
export function projectThemesDir(config = {}) {
  return path.join(resolveProjectRoot(config), 'styles', 'themes');
}

/**
 * Path to bundled author UI static files.
 * @returns {string}
 */
export function uiStaticDir() {
  return path.join(packageRoot, 'ui');
}

/**
 * Infer project name from host package.json when not configured.
 * @param {object} [config={}] Ingest config
 * @returns {string}
 */
export function defaultProjectName(config = {}) {
  if (config.projectName) return config.projectName;
  try {
    const pkgPath = path.join(resolveProjectRoot(config), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.name?.replace(/^@/, '').replace(/\//g, '-') || 'eds-site';
  } catch {
    return 'eds-site';
  }
}
