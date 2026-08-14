import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { defaultOutputRoot, defaultProjectName, resolveProjectRoot } from '../lib/project-root.mjs';

/**
 * Run a shell command and return exit code.
 * @param {string} command Executable
 * @param {string[]} args Arguments
 * @param {object} [options] spawn options
 * @returns {Promise<number>}
 */
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'inherit', shell: true, ...options });
    proc.on('error', reject);
    proc.on('close', (code) => resolve(code ?? 1));
  });
}

/**
 * Resolve AEM staging directory for packaging.
 * @param {object} config Ingest config
 * @returns {string}
 */
export function resolveAemStagingDir(config = {}) {
  const projectRoot = resolveProjectRoot(config);
  const projectName = config.projectName || defaultProjectName(config);
  const configured = config.aem?.outputRoot;
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.join(projectRoot, configured);
  }
  return path.join(projectRoot, 'aem-content', projectName);
}

/**
 * Resolve local ingest output directory.
 * @param {object} config Ingest config
 * @returns {string}
 */
export function resolveLocalOutputDir(config = {}) {
  const projectRoot = resolveProjectRoot(config);
  const configured = config.outputRoot;
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.join(projectRoot, configured);
  }
  return defaultOutputRoot(config);
}

/**
 * Create a ZIP archive from a content folder (pages, nav, footer, themes).
 * @param {string} sourceDir Absolute source folder
 * @param {string} outputZipPath Absolute output zip path
 * @returns {Promise<string>}
 */
export async function createContentPackage(sourceDir, outputZipPath) {
  const stat = await fs.stat(sourceDir).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error(`Content package source not found: ${sourceDir}`);
  }

  await fs.mkdir(path.dirname(outputZipPath), { recursive: true });
  await fs.rm(outputZipPath, { force: true });

  if (process.platform === 'win32') {
    const src = sourceDir.replace(/'/g, "''");
    const dest = outputZipPath.replace(/'/g, "''");
    const ps = `$ErrorActionPreference='Stop'; Compress-Archive -Path '${src}\\*' -DestinationPath '${dest}' -Force`;
    const code = await runCommand('powershell', ['-NoProfile', '-Command', ps]);
    if (code !== 0) throw new Error(`Failed to create zip at ${outputZipPath}`);
  } else {
    const code = await runCommand('zip', ['-r', outputZipPath, '.'], { cwd: sourceDir });
    if (code !== 0) throw new Error('zip command failed — install zip or run on Windows');
  }

  return outputZipPath;
}

/**
 * Package ingested content for AEM Universal Editor upload.
 * @param {object} options
 * @param {'local'|'da'|'aem'|'both'} options.target Ingest target
 * @param {object} [options.config={}] Ingest config
 * @returns {Promise<string|null>} Zip path or null when skipped
 */
export async function packageIngestedContent({ target, config = {} }) {
  const projectName = config.projectName || defaultProjectName(config);
  const useAemStaging = target === 'aem' || target === 'both';
  const sourceDir = useAemStaging ? resolveAemStagingDir(config) : resolveLocalOutputDir(config);

  const zipName = config.aem?.packageZip
    || (useAemStaging ? `${projectName}-aem-package.zip` : `${projectName}-ingest-package.zip`);
  const zipPath = path.isAbsolute(zipName)
    ? zipName
    : path.join(path.dirname(sourceDir), path.basename(zipName));

  await createContentPackage(sourceDir, zipPath);
  return zipPath;
}
